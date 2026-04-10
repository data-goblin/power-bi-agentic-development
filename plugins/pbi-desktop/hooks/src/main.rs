// pbi-hooks: Validation hooks for Power BI Desktop TOM/ADOMD workflows
//
// Subcommands:
//   validate-dax      - Check DAX table/column/measure references against cached model metadata
//   validate-measure  - Ensure new measures have DisplayFolder, Description, FormatString
//   refresh-cache     - Re-snapshot model metadata after TOM connect or modification
//   check-ri          - Check referential integrity after relationship/column changes
//
// All subcommands read hook JSON from stdin and follow Claude Code hook conventions:
//   exit 0 = OK or not applicable
//   exit 2 = blocking error (stderr shown to Claude)

use std::env;
use std::fs;
use std::io::{self, Read};
use std::path::{Path, PathBuf};
use std::process::{self, Command};


// #region JSON helpers

/// Minimal JSON string value extractor. Returns the value for a given key in a flat JSON object.
/// Handles escaped quotes within string values.
fn json_get_str(json: &str, key: &str) -> Option<String> {
    let pattern = format!("\"{}\"", key);
    let pos = json.find(&pattern)?;
    let after_key = &json[pos + pattern.len()..];

    // Skip whitespace and colon
    let after_colon = after_key.trim_start().strip_prefix(':')?;
    let trimmed = after_colon.trim_start();

    if trimmed.starts_with('"') {
        // String value: extract until unescaped closing quote
        let content = &trimmed[1..];
        let mut result = String::new();
        let mut chars = content.chars();
        while let Some(ch) = chars.next() {
            if ch == '\\' {
                if let Some(escaped) = chars.next() {
                    match escaped {
                        'n' => result.push('\n'),
                        't' => result.push('\t'),
                        '"' => result.push('"'),
                        '\\' => result.push('\\'),
                        '/' => result.push('/'),
                        'u' => {
                            let hex: String = chars.by_ref().take(4).collect();
                            if let Ok(cp) = u32::from_str_radix(&hex, 16) {
                                if let Some(c) = char::from_u32(cp) {
                                    result.push(c);
                                }
                            }
                        }
                        _ => {
                            result.push('\\');
                            result.push(escaped);
                        }
                    }
                }
            } else if ch == '"' {
                break;
            } else {
                result.push(ch);
            }
        }
        Some(result)
    } else if trimmed.starts_with("null") {
        None
    } else {
        // Number or other literal
        let end = trimmed.find(|c: char| c == ',' || c == '}' || c == ']').unwrap_or(trimmed.len());
        Some(trimmed[..end].trim().to_string())
    }
}

/// Extract nested tool_input.command from hook stdin JSON
fn extract_command(stdin: &str) -> Option<String> {
    let tool_input = {
        let key = "\"tool_input\"";
        let pos = stdin.find(key)?;
        let after = &stdin[pos + key.len()..];
        let colon = after.find(':')?;
        &stdin[pos + key.len() + colon + 1..]
    };
    json_get_str(tool_input, "command")
}

/// Extract tool_name from hook stdin JSON
fn extract_tool_name(stdin: &str) -> Option<String> {
    json_get_str(stdin, "tool_name")
}

/// If the command is a `-File <path>.ps1` invocation, read the .ps1 file
/// and return its contents. Otherwise return the command text as-is.
/// This allows hooks to inspect .ps1 file contents for trigger patterns.
fn resolve_command_text(command: &str) -> String {
    // Look for -File "path.ps1" or -File path.ps1 in the command
    let lower = command.to_ascii_lowercase();
    if !lower.contains("-file") { return command.to_string(); }

    // Extract the .ps1 path after -File
    let path = extract_ps1_path(command);
    if let Some(p) = path {
        // Try to read the file; on macOS the path might be a local path,
        // on Windows via Parallels it might be a UNC path
        if let Ok(contents) = fs::read_to_string(&p) {
            return contents;
        }
    }

    command.to_string()
}

fn extract_ps1_path(command: &str) -> Option<String> {
    // Find -File (case-insensitive) and extract the following path
    let lower = command.to_ascii_lowercase();
    let pos = lower.find("-file")?;
    let after = command[pos + 5..].trim_start();

    // Handle quoted path: -File "path.ps1" or -File \"path.ps1\"
    let path = if after.starts_with('"') || after.starts_with("\\\"") {
        let start = after.find(|c: char| c != '"' && c != '\\')? ;
        let rest = &after[start..];
        let end = rest.find(|c: char| c == '"' || c == '\\').unwrap_or(rest.len());
        rest[..end].to_string()
    } else {
        // Unquoted: take until whitespace
        let end = after.find(|c: char| c.is_whitespace()).unwrap_or(after.len());
        after[..end].to_string()
    };

    // Only return if it looks like a .ps1 file
    if path.to_ascii_lowercase().ends_with(".ps1") {
        Some(path)
    } else {
        None
    }
}

// #endregion


// #region Config

fn config_is_enabled(config_path: &Path, key: &str) -> bool {
    if let Ok(content) = fs::read_to_string(config_path) {
        for line in content.lines() {
            let trimmed = line.trim();
            if trimmed.starts_with(key) {
                if let Some(rest) = trimmed.strip_prefix(key) {
                    let rest = rest.trim_start().strip_prefix(':').unwrap_or(rest).trim();
                    return rest != "false";
                }
            }
        }
    }
    true // default enabled
}

// #endregion


// #region Model metadata

struct TableMeta {
    name: String,
    columns: Vec<String>,
    measures: Vec<String>,
}

struct ModelMeta {
    port: String,
    compat_level: u32,
    max_compat_level: u32,
    tables: Vec<TableMeta>,
}

/// Parse the model-metadata.json file. Minimal parser; no serde dependency.
fn parse_metadata(path: &Path) -> Option<ModelMeta> {
    let raw = fs::read_to_string(path).ok()?;

    // Strip UTF-8 BOM if present (PowerShell writes BOM with UTF8 encoding)
    let content = raw.strip_prefix('\u{feff}').unwrap_or(&raw);

    // Validate it's parseable JSON (quick check)
    if !content.trim_start().starts_with('{') {
        return None;
    }

    let port = json_get_str(&content, "port").unwrap_or_default();

    let mut tables = Vec::new();
    // Find each table object by looking for "name" keys inside "tables" array
    // This is a pragmatic parser that walks the tables array structure
    let tables_start = content.find("\"tables\"")?;
    let arr_start = content[tables_start..].find('[')? + tables_start;
    let table_region = &content[arr_start..];

    // Split on table boundaries: each table starts with {"measures" or {"name" or {"columns"
    // We look for the pattern: "name":"<table_name>" followed by "columns":[...] and "measures":[...]
    let mut depth = 0;
    let mut obj_start = None;
    let bytes = table_region.as_bytes();

    let mut i = 0;
    while i < bytes.len() {
        match bytes[i] {
            b'[' => { depth += 1; }
            b']' => {
                depth -= 1;
                if depth == 0 { break; }
            }
            b'{' => {
                if depth == 1 {
                    obj_start = Some(i);
                }
                depth += 1;
            }
            b'}' => {
                depth -= 1;
                if depth == 1 {
                    if let Some(start) = obj_start {
                        let obj = &table_region[start..=i];
                        if let Some(table) = parse_table_object(obj) {
                            tables.push(table);
                        }
                    }
                    obj_start = None;
                }
            }
            b'"' => {
                // Skip string content
                i += 1;
                while i < bytes.len() {
                    if bytes[i] == b'\\' {
                        i += 1; // skip escaped char
                    } else if bytes[i] == b'"' {
                        break;
                    }
                    i += 1;
                }
            }
            _ => {}
        }
        i += 1;
    }

    let compat_level = json_get_str(content, "compatibilityLevel")
        .and_then(|s| s.parse::<u32>().ok()).unwrap_or(0);
    let max_compat_level = json_get_str(content, "maxCompatibilityLevel")
        .and_then(|s| s.parse::<u32>().ok()).unwrap_or(0);

    Some(ModelMeta { port, compat_level, max_compat_level, tables })
}

fn parse_table_object(obj: &str) -> Option<TableMeta> {
    // Find top-level "name" key (depth 1, not nested inside arrays/objects)
    let name = find_top_level_str(obj, "name")?;

    let mut columns = Vec::new();
    let mut measures = Vec::new();

    // Extract column names from "columns":[{"name":"..."},...]
    if let Some(cols_start) = obj.find("\"columns\"") {
        if let Some(arr_start) = obj[cols_start..].find('[') {
            let region = &obj[cols_start + arr_start..];
            extract_names_from_array(region, &mut columns);
        }
    }

    // Extract measure names from "measures":[{"name":"..."},...]
    if let Some(meas_start) = obj.find("\"measures\"") {
        if let Some(arr_start) = obj[meas_start..].find('[') {
            let region = &obj[meas_start + arr_start..];
            extract_names_from_array(region, &mut measures);
        }
    }

    Some(TableMeta { name, columns, measures })
}

/// Find a string value for a key at the top level of a JSON object (depth 1).
/// Skips nested objects and arrays so it finds the object's own properties, not children's.
fn find_top_level_str(obj: &str, key: &str) -> Option<String> {
    let pattern = format!("\"{}\"", key);
    let bytes = obj.as_bytes();
    let mut depth = 0;
    let mut i = 0;

    while i < bytes.len() {
        match bytes[i] {
            b'{' | b'[' => { depth += 1; }
            b'}' | b']' => { depth -= 1; }
            b'"' => {
                // At depth 1 (inside the top-level object), check if this is our key
                if depth == 1 && obj[i..].starts_with(&pattern) {
                    // Found the key at top level; extract value
                    let after_key = &obj[i + pattern.len()..];
                    let after_colon = after_key.trim_start().strip_prefix(':')?;
                    return json_get_str_from_value(after_colon.trim_start());
                }
                // Skip string content
                i += 1;
                while i < bytes.len() {
                    if bytes[i] == b'\\' { i += 1; }
                    else if bytes[i] == b'"' { break; }
                    i += 1;
                }
            }
            _ => {}
        }
        i += 1;
    }
    None
}

/// Extract a JSON string value starting at the opening quote position
fn json_get_str_from_value(s: &str) -> Option<String> {
    if !s.starts_with('"') { return None; }
    let content = &s[1..];
    let mut result = String::new();
    let mut chars = content.chars();
    while let Some(ch) = chars.next() {
        if ch == '\\' {
            if let Some(escaped) = chars.next() {
                match escaped {
                    'n' => result.push('\n'),
                    't' => result.push('\t'),
                    '"' => result.push('"'),
                    '\\' => result.push('\\'),
                    '/' => result.push('/'),
                    'u' => {
                        let hex: String = chars.by_ref().take(4).collect();
                        if let Ok(cp) = u32::from_str_radix(&hex, 16) {
                            if let Some(c) = char::from_u32(cp) {
                                result.push(c);
                            }
                        }
                    }
                    _ => { result.push('\\'); result.push(escaped); }
                }
            }
        } else if ch == '"' {
            break;
        } else {
            result.push(ch);
        }
    }
    Some(result)
}

fn extract_names_from_array(arr: &str, out: &mut Vec<String>) {
    let mut depth = 0;
    let mut obj_start = None;
    let bytes = arr.as_bytes();
    let mut i = 0;

    while i < bytes.len() {
        match bytes[i] {
            b'[' => { depth += 1; }
            b']' => {
                depth -= 1;
                if depth == 0 { break; }
            }
            b'{' => {
                if depth == 1 { obj_start = Some(i); }
                depth += 1;
            }
            b'}' => {
                depth -= 1;
                if depth == 1 {
                    if let Some(start) = obj_start {
                        let sub = &arr[start..=i];
                        if let Some(name) = json_get_str(sub, "name") {
                            out.push(name);
                        }
                    }
                    obj_start = None;
                }
            }
            b'"' => {
                i += 1;
                while i < bytes.len() {
                    if bytes[i] == b'\\' { i += 1; }
                    else if bytes[i] == b'"' { break; }
                    i += 1;
                }
            }
            _ => {}
        }
        i += 1;
    }
}

// #endregion


// #region DAX reference extraction

struct DaxRef {
    table: String,
    column: String,
}

/// Extract 'Table'[Column] references from command text.
/// Handles both standard ('Table'[Col]) and PS-escaped (''Table''[Col]) forms.
fn extract_table_col_refs(text: &str) -> Vec<DaxRef> {
    let mut refs = Vec::new();
    let bytes = text.as_bytes();
    let len = bytes.len();
    let mut i = 0;

    while i < len {
        // Look for single quote starting a table name
        if bytes[i] == b'\'' {
            // Check for PS-escaped ''Table'' pattern
            let (table_name, end_pos) = if i + 1 < len && bytes[i + 1] == b'\'' {
                // ''Table'' pattern: skip opening '', find closing ''
                extract_ps_escaped_table(text, i)
            } else {
                // 'Table' pattern: standard
                extract_standard_table(text, i)
            };

            if let Some(name) = table_name {
                if !name.is_empty() {
                    // Check if followed by [Column]
                    if let Some(col) = extract_bracket_ref(text, end_pos) {
                        refs.push(DaxRef { table: name, column: col.0 });
                        i = col.1;
                        continue;
                    }
                }
                i = end_pos;
                continue;
            }
        }
        i += 1;
    }

    // Deduplicate
    refs.sort_by(|a, b| (&a.table, &a.column).cmp(&(&b.table, &b.column)));
    refs.dedup_by(|a, b| a.table == b.table && a.column == b.column);
    refs
}

fn extract_standard_table(text: &str, start: usize) -> (Option<String>, usize) {
    // 'Table' -- start is at the opening '
    let content = &text[start + 1..];
    if let Some(end) = content.find('\'') {
        if end > 0 {
            let name = content[..end].to_string();
            return (Some(name), start + 1 + end + 1);
        }
    }
    (None, start + 1)
}

fn extract_ps_escaped_table(text: &str, start: usize) -> (Option<String>, usize) {
    // ''Table'' -- start is at first '
    let content = &text[start + 2..];
    if let Some(end) = content.find("''") {
        if end > 0 {
            let name = content[..end].to_string();
            return (Some(name), start + 2 + end + 2);
        }
    }
    (None, start + 2)
}

fn extract_bracket_ref(text: &str, start: usize) -> Option<(String, usize)> {
    if start >= text.len() { return None; }
    let bytes = text.as_bytes();
    if bytes[start] != b'[' { return None; }

    let content = &text[start + 1..];
    if let Some(end) = content.find(']') {
        let name = content[..end].to_string();
        return Some((name, start + 1 + end + 1));
    }
    None
}

/// Extract standalone [Ref] bracket references (potential measures).
/// Filters out indexers: ["..."], ['...'], [$...], [@...], [0], etc.
fn extract_bracket_refs(text: &str) -> Vec<String> {
    let mut refs = Vec::new();
    let bytes = text.as_bytes();
    let len = bytes.len();
    let mut i = 0;

    while i < len {
        if bytes[i] == b'[' && i + 1 < len {
            let first = bytes[i + 1];
            // Skip indexers
            if first == b'"' || first == b'\'' || first == b'$' || first == b'\\' || first == b'@' {
                // Skip to closing ]
                if let Some(close) = text[i..].find(']') {
                    i += close + 1;
                    continue;
                }
            }

            if let Some(close) = text[i + 1..].find(']') {
                let content = &text[i + 1..i + 1 + close];

                // Skip numeric-only (indexers like [0])
                if !content.is_empty() && !content.chars().all(|c| c.is_ascii_digit()) {
                    refs.push(content.to_string());
                }
                i = i + 1 + close + 1;
                continue;
            }
        }
        i += 1;
    }

    refs.sort();
    refs.dedup();
    refs
}

/// Extract DEFINE MEASURE targets: MEASURE 'Table'[Name] patterns
fn extract_defined_measures(text: &str) -> Vec<String> {
    let mut names = Vec::new();
    let lower = text.to_ascii_lowercase();
    let mut search_from = 0;

    while let Some(pos) = lower[search_from..].find("measure") {
        let abs_pos = search_from + pos;
        let after = &text[abs_pos + 7..];
        let trimmed = after.trim_start();

        // Check if followed by 'Table'[Name] or ''Table''[Name]
        if trimmed.starts_with('\'') {
            let refs = extract_table_col_refs(trimmed);
            if let Some(r) = refs.first() {
                names.push(r.column.clone());
            }
        }
        search_from = abs_pos + 7;
    }

    names
}

// #endregion


// #region Suggestion engine

fn suggest_match(needle: &str, haystack: &[String], max: usize) -> Vec<String> {
    let needle_lower = needle.to_ascii_lowercase();

    // Pass 1: case-insensitive exact
    let exact: Vec<_> = haystack.iter()
        .filter(|h| h.to_ascii_lowercase() == needle_lower)
        .cloned().collect();
    if !exact.is_empty() { return exact.into_iter().take(max).collect(); }

    // Pass 2: needle is substring of item; sort by length (shorter = closer)
    let mut contains: Vec<_> = haystack.iter()
        .filter(|h| h.to_ascii_lowercase().contains(&needle_lower))
        .cloned().collect();
    contains.sort_by_key(|s| s.len());
    if !contains.is_empty() { return contains.into_iter().take(max).collect(); }

    // Pass 3: first word of needle
    if let Some(first_word) = needle.split_whitespace().next() {
        if first_word.len() >= 3 {
            let fw_lower = first_word.to_ascii_lowercase();
            let mut partial: Vec<_> = haystack.iter()
                .filter(|h| h.to_ascii_lowercase().contains(&fw_lower))
                .cloned().collect();
            partial.sort_by_key(|s| s.len());
            if !partial.is_empty() { return partial.into_iter().take(max).collect(); }
        }
    }

    Vec::new()
}

fn format_suggestions(suggestions: &[String]) -> String {
    if suggestions.is_empty() { return String::new(); }
    let quoted: Vec<_> = suggestions.iter().map(|s| format!("'{}'", s)).collect();
    format!(" Did you mean {}?", quoted.join(", "))
}

// #endregion


// #region DAX detection

fn has_dax_context(text: &str) -> bool {
    let lower = text.to_ascii_lowercase();
    let dax_keywords = [
        "evaluate", "summarizecolumns", "calculatetable", "countrows",
        "sumx", "averagex", "maxx", "minx", "addcolumns", "selectcolumns",
        "topn", "commandtext", "expression",
    ];
    for kw in &dax_keywords {
        if lower.contains(kw) { return true; }
    }
    // Also check for 'Table'[Col] pattern
    if text.contains("'") && text.contains('[') {
        let refs = extract_table_col_refs(text);
        if !refs.is_empty() { return true; }
    }
    false
}

// #endregion


// #region Subcommand: validate-dax

fn cmd_validate_dax(stdin: &str, project_dir: &Path, config_path: &Path) {
    if !config_is_enabled(config_path, "dax_validation") {
        process::exit(0);
    }

    let tool_name = extract_tool_name(stdin).unwrap_or_default();
    if tool_name != "Bash" { process::exit(0); }

    let raw_command = match extract_command(stdin) {
        Some(c) if !c.is_empty() => c,
        _ => process::exit(0),
    };

    // If this is a -File .ps1 invocation, read the file contents
    let command_text = resolve_command_text(&raw_command);

    let metadata_path = project_dir.join("tmp/model-metadata.json");
    if !metadata_path.exists() { process::exit(0); }

    let meta = match parse_metadata(&metadata_path) {
        Some(m) => m,
        None => process::exit(0),
    };

    if !has_dax_context(&command_text) { process::exit(0); }

    let mut errors = Vec::new();

    // Extract DEFINE MEASURE names (query-scoped; not in model)
    let defined_measures = extract_defined_measures(&command_text);

    // Validate 'Table'[Column] references
    let table_col_refs = extract_table_col_refs(&command_text);
    let all_table_names: Vec<String> = meta.tables.iter().map(|t| t.name.clone()).collect();

    // Collect DEFINE MEASURE targets (table, column) for exclusion
    let defined_target_pairs: Vec<(String, String)> = {
        let mut targets = Vec::new();
        let lower = command_text.to_ascii_lowercase();
        let mut search_from = 0;
        while let Some(pos) = lower[search_from..].find("measure") {
            let abs_pos = search_from + pos;
            let after = &command_text[abs_pos + 7..];
            let trimmed = after.trim_start();
            if trimmed.starts_with('\'') || trimmed.starts_with("''") {
                let refs = extract_table_col_refs(trimmed);
                if let Some(r) = refs.first() {
                    targets.push((r.table.clone(), r.column.clone()));
                }
            }
            search_from = abs_pos + 7;
        }
        targets
    };

    for dax_ref in &table_col_refs {
        // Skip DEFINE MEASURE targets
        if defined_target_pairs.iter().any(|(t, c)| t == &dax_ref.table && c == &dax_ref.column) {
            continue;
        }

        // Check table exists
        let table = meta.tables.iter().find(|t| t.name == dax_ref.table);
        if table.is_none() {
            let suggestions = suggest_match(&dax_ref.table, &all_table_names, 3);
            let hint = format_suggestions(&suggestions);
            errors.push(format!("Table '{}' does not exist in the model.{}", dax_ref.table, hint));
            continue;
        }

        // Check column exists in table
        let table = table.unwrap();
        if !table.columns.contains(&dax_ref.column) {
            let suggestions = suggest_match(&dax_ref.column, &table.columns, 3);
            let hint = format_suggestions(&suggestions);
            errors.push(format!("Column [{}] does not exist in table '{}'.{}", dax_ref.column, dax_ref.table, hint));
        }
    }

    // Validate unqualified [Ref] bracket references as measures
    let bracket_refs = extract_bracket_refs(&command_text);
    let qualified_cols: Vec<&str> = table_col_refs.iter().map(|r| r.column.as_str()).collect();

    let all_measures: Vec<String> = meta.tables.iter()
        .flat_map(|t| t.measures.iter().cloned())
        .collect();
    let all_columns: Vec<String> = meta.tables.iter()
        .flat_map(|t| t.columns.iter().cloned())
        .collect();

    for ref_name in &bracket_refs {
        // Skip if already checked as table-qualified
        if qualified_cols.contains(&ref_name.as_str()) { continue; }

        // Skip if it's a DEFINE MEASURE name
        if defined_measures.contains(ref_name) { continue; }

        // Check if it's a known measure or column
        if all_measures.contains(ref_name) || all_columns.contains(ref_name) { continue; }

        // Skip string literal aliases (appears as "RefName" in command)
        let quoted = format!("\"{}\"", ref_name);
        if command_text.contains(&quoted) { continue; }

        let mut all_fields = all_measures.clone();
        all_fields.extend(all_columns.iter().cloned());
        all_fields.sort();
        all_fields.dedup();
        let suggestions = suggest_match(ref_name, &all_fields, 3);
        let hint = format_suggestions(&suggestions);
        errors.push(format!("[{}] is not a known measure or column in the model.{}", ref_name, hint));
    }

    if !errors.is_empty() {
        let msg = errors.join(" ");
        eprintln!("DAX validation failed: {} (Set dax_validation: false in {} to disable this check.)",
            msg, config_path.display());
        process::exit(2);
    }
}

// #endregion


// #region Subcommand: validate-measure

fn cmd_validate_measure(stdin: &str, config_path: &Path) {
    if !config_is_enabled(config_path, "measure_metadata") {
        process::exit(0);
    }

    let tool_name = extract_tool_name(stdin).unwrap_or_default();
    if tool_name != "Bash" { process::exit(0); }

    let raw_command = match extract_command(stdin) {
        Some(c) if !c.is_empty() => c,
        _ => process::exit(0),
    };

    let command_text = resolve_command_text(&raw_command);

    if !command_text.contains(".Measures.Add") { process::exit(0); }

    let lower = command_text.to_ascii_lowercase();
    let mut missing = Vec::new();

    if !lower.contains(".displayfolder") || !command_text.contains("=") {
        // More precise: check for .DisplayFolder followed by =
        if !has_property_assignment(&command_text, "DisplayFolder") {
            missing.push("DisplayFolder");
        }
    }

    if !has_property_assignment(&command_text, "Description") {
        missing.push("Description");
    }

    let has_format = has_property_assignment(&command_text, "FormatString")
        || command_text.contains("FormatStringDefinition");

    if !has_format {
        missing.push("FormatString (or FormatStringDefinition)");
    }

    if !missing.is_empty() {
        eprintln!("Measure is missing required metadata: {}. Set these properties before calling .Measures.Add(). (Set measure_metadata: false in {} to disable this check.)",
            missing.join(", "), config_path.display());
        process::exit(2);
    }
}

fn has_property_assignment(text: &str, property: &str) -> bool {
    let lower_text = text.to_ascii_lowercase();
    let lower_prop = property.to_ascii_lowercase();

    // Find .PropertyName followed by whitespace and =
    let pattern = format!(".{}", lower_prop);
    if let Some(pos) = lower_text.find(&pattern) {
        let after = &text[pos + pattern.len()..];
        let trimmed = after.trim_start();
        return trimmed.starts_with('=');
    }
    false
}

// #endregion


// #region Subcommand: refresh-cache

fn cmd_refresh_cache(stdin: &str, project_dir: &Path, config_path: &Path, hook_dir: &Path) {
    if !config_is_enabled(config_path, "metadata_refresh") {
        process::exit(0);
    }

    let tool_name = extract_tool_name(stdin).unwrap_or_default();
    if tool_name != "Bash" { process::exit(0); }

    let command_text = match extract_command(stdin) {
        Some(c) if !c.is_empty() => c,
        _ => process::exit(0),
    };

    // Detect trigger: TOM assembly loading or model modification
    let is_connect = command_text.contains("Microsoft.AnalysisServices");
    let is_modification = ["SaveChanges", ".Measures.Add", ".Columns.Add", ".Tables.Add",
        ".Relationships.Add", ".Measures.Remove", ".Columns.Remove", ".Tables.Remove",
        ".Roles.Add", ".Hierarchies.Add", "RequestRefresh"]
        .iter().any(|p| command_text.contains(p));

    if !is_connect && !is_modification { process::exit(0); }

    // Resolve port
    let metadata_path = project_dir.join("tmp/model-metadata.json");
    let mut port = String::new();

    // Try extracting from command text
    if is_connect {
        if let Some(p) = extract_port_from_text(&command_text) {
            port = p;
        }
    }

    // Fall back to cached metadata
    if port.is_empty() {
        if let Some(meta) = parse_metadata(&metadata_path) {
            port = meta.port;
        }
    }

    if port.is_empty() || port == "null" || !port.chars().all(|c| c.is_ascii_digit()) {
        process::exit(0);
    }

    let snapshot_script = hook_dir.join("snapshot-model.ps1");
    let metadata_out = project_dir.join("tmp/model-metadata.json");

    run_powershell_script(&snapshot_script, &[
        &format!("-Port {}", port),
        &format!("-OutFile \"{}\"", convert_to_exec_path(&metadata_out)),
    ]);
}

fn extract_port_from_text(text: &str) -> Option<String> {
    if let Some(pos) = text.find("localhost:") {
        let after = &text[pos + 10..];
        let port: String = after.chars().take_while(|c| c.is_ascii_digit()).collect();
        if !port.is_empty() { return Some(port); }
    }
    None
}

// #endregion


// #region Subcommand: check-ri

fn cmd_check_ri(stdin: &str, project_dir: &Path, config_path: &Path, hook_dir: &Path) {
    if !config_is_enabled(config_path, "referential_integrity") {
        process::exit(0);
    }

    let tool_name = extract_tool_name(stdin).unwrap_or_default();
    if tool_name != "Bash" { process::exit(0); }

    let command_text = match extract_command(stdin) {
        Some(c) if !c.is_empty() => c,
        _ => process::exit(0),
    };

    // Only run if command involves relationship or column changes
    let relevant = ["Relationship", "FromColumn", "ToColumn", ".Columns.Add", ".Columns.Remove"]
        .iter().any(|p| command_text.contains(p));
    if !relevant { process::exit(0); }

    // Resolve port
    let metadata_path = project_dir.join("tmp/model-metadata.json");
    if !metadata_path.exists() { process::exit(0); }

    let meta = match parse_metadata(&metadata_path) {
        Some(m) => m,
        None => process::exit(0),
    };

    if meta.port.is_empty() || meta.port == "null" || !meta.port.chars().all(|c| c.is_ascii_digit()) {
        process::exit(0);
    }

    let ri_script = hook_dir.join("check-referential-integrity.ps1");
    let output = run_powershell_script_capture(&ri_script, &[&format!("-Port {}", meta.port)]);

    // Filter for real issues only
    let has_issues = output.contains("UNMATCHED_MANY_SIDE")
        || output.contains("SILENT_EXCLUSION")
        || output.contains("ASSUME_RI_RISK");

    if has_issues {
        eprintln!("Referential integrity issues detected:");

        let mut current_header: Option<&str> = None;
        for line in output.lines() {
            if line.starts_with("RI_VIOLATION") {
                current_header = Some(line);
            } else if line.contains("UNMATCHED_MANY_SIDE") || line.contains("SILENT_EXCLUSION") || line.contains("ASSUME_RI_RISK") {
                if let Some(header) = current_header.take() {
                    eprintln!("{}", header);
                }
                eprintln!("{}", line);
            } else if line.contains("UNMATCHED_ONE_SIDE") {
                // Skip informational
                current_header = None;
            }
        }

        eprintln!("(Set referential_integrity: false in {} to disable this check.)", config_path.display());
        process::exit(2);
    }
}

// #endregion


// #region Subcommand: check-compat

/// Compatibility level feature table. Each entry is (min_cl, feature_description).
/// The max CL comes dynamically from the engine (stored in metadata); this table
/// just maps CL numbers to human-readable features.
const CL_FEATURES: &[(u32, &str)] = &[
    (1450, "Incremental refresh policies"),
    (1455, "Dual storage mode; Measure.DataCategory"),
    (1460, "Summarization types; AlternateOf sources"),
    (1465, "Enhanced metadata format; PowerBI_V3 data sources"),
    (1470, "Calculation groups and items"),
    (1475, "DataSourceVariablesOverrideBehavior"),
    (1480, "Query groups; Table.ExcludeFromModelRefresh"),
    (1500, "CalculationItem.Ordinal; query interleaving"),
    (1520, "SourceQueryCulture; field parameters"),
    (1535, "M expression attributes on Model and NamedExpression"),
    (1540, "LineageTag for objects"),
    (1550, "SourceLineageTag for object tracking"),
    (1560, "DiscourageCompositeModels property"),
    (1561, "SecurityFilteringBehavior.None"),
    (1562, "Auto aggregations; Table.SystemManaged"),
    (1563, "InferredPartitionSource; ParquetPartitionSource"),
    (1564, "AutomaticAggregationOptions"),
    (1565, "Hybrid tables (import + DirectQuery partitions)"),
    (1566, "DisableAutoExists for SUMMARIZECOLUMNS"),
    (1567, "ChangedProperties tracking"),
    (1568, "MaxParallelismPerRefresh"),
    (1569, "MaxParallelismPerQuery"),
    (1570, "NamedExpression remote parameter support"),
    (1571, "ObjectTranslation.Altered"),
    (1572, "Table.ExcludeFromAutomaticAggregations"),
    (1601, "FormatStringDefinition (dynamic format strings)"),
    (1603, "DataCoverageDefinition (partition hints)"),
    (1604, "DirectLake mode; EntityPartitionSource.SchemaName"),
    (1605, "Selection expressions for calculation items"),
    (1606, "ValueFilterBehavior; DataSourceVariablesOverrideBehavior"),
    (1700, "SQL Server 2025 parity"),
    (1701, "Custom calendars for time intelligence"),
    (1702, "DAX user-defined functions (UDFs)"),
];

fn cmd_check_compat(stdin: &str, project_dir: &Path, config_path: &Path) {
    // Either compatibility_check or compatibility_auto_upgrade must be enabled
    if !config_is_enabled(config_path, "compatibility_check")
        && !config_is_enabled(config_path, "compatibility_auto_upgrade") {
        process::exit(0);
    }

    let tool_name = extract_tool_name(stdin).unwrap_or_default();
    if tool_name != "Bash" { process::exit(0); }

    let metadata_path = project_dir.join("tmp/model-metadata.json");
    if !metadata_path.exists() { process::exit(0); }

    let meta = match parse_metadata(&metadata_path) {
        Some(m) => m,
        None => process::exit(0),
    };

    let current_cl = meta.compat_level;
    // Ignore sentinel values (engine may report 1000000 or similar)
    let max_cl = if meta.max_compat_level > 0 && meta.max_compat_level < 100000 {
        meta.max_compat_level
    } else {
        // Fall back to highest known CL in our table
        CL_FEATURES.last().map(|&(cl, _)| cl).unwrap_or(0)
    };

    if current_cl == 0 { process::exit(0); }
    if current_cl >= max_cl { process::exit(0); }

    // Collect features available at higher CLs
    let mut missing_features: Vec<(u32, &str)> = Vec::new();
    for &(cl, feature) in CL_FEATURES {
        if cl > current_cl && cl <= max_cl {
            missing_features.push((cl, feature));
        }
    }

    if missing_features.is_empty() { process::exit(0); }

    eprintln!("Model compatibility level is {} (engine supports up to {}). Features available by upgrading:",
        current_cl, max_cl);

    for (cl, feature) in &missing_features {
        eprintln!("  CL {}: {}", cl, feature);
    }

    // Auto-upgrade if enabled
    if config_is_enabled(config_path, "compatibility_auto_upgrade") {
        let port = &meta.port;
        let upgrade_script = format!(
            "$basePath = \"$env:TEMP\\tom_nuget\\Microsoft.AnalysisServices.retail.amd64\\lib\\net45\"; \
             Add-Type -Path \"$basePath\\Microsoft.AnalysisServices.Core.dll\"; \
             Add-Type -Path \"$basePath\\Microsoft.AnalysisServices.Tabular.dll\"; \
             $server = New-Object Microsoft.AnalysisServices.Tabular.Server; \
             $server.Connect(\"Data Source=localhost:{}\"); \
             $server.Databases[0].CompatibilityLevel = {}; \
             $server.Databases[0].Model.SaveChanges(); \
             Write-Output \"Upgraded to CL {}\"; \
             $server.Disconnect()",
            port, max_cl, max_cl
        );
        run_powershell_inline(&upgrade_script);
        eprintln!("Compatibility level auto-upgraded from {} to {}.", current_cl, max_cl);
    } else {
        eprintln!("Check Microsoft documentation for these features to see if any would benefit this model. To upgrade, set $db.CompatibilityLevel = {} via TOM and call $model.SaveChanges(). There are no known downsides to upgrading; only benefits. However, it is irreversible; ask the user before proceeding.", max_cl);
    }

    eprintln!("(Set compatibility_check: false in {} to disable. Set compatibility_auto_upgrade: true to auto-upgrade.)", config_path.display());
    process::exit(2);
}

// #endregion


// #region PowerShell execution

fn run_powershell_inline(script: &str) {
    if let Some(vm_name) = find_parallels_vm() {
        let cmd_str = format!("powershell.exe -NoProfile -ExecutionPolicy Bypass -Command \"{}\"", script);
        let _ = Command::new("prlctl")
            .args(["exec", &vm_name, "cmd.exe", "/c", &cmd_str])
            .output();
    } else if which("powershell.exe") {
        let _ = Command::new("powershell.exe")
            .args(["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", script])
            .output();
    }
}

fn run_powershell_script(script: &Path, extra_args: &[&str]) {
    let exec_path = convert_to_exec_path(script);
    let args_str = extra_args.join(" ");

    if let Some(vm_name) = find_parallels_vm() {
        let cmd_str = format!(
            "powershell.exe -NoProfile -ExecutionPolicy Bypass -File \"{}\" {}",
            exec_path, args_str
        );
        let _ = Command::new("prlctl")
            .args(["exec", &vm_name, "cmd.exe", "/c", &cmd_str])
            .output();
    } else if which("powershell.exe") {
        let _ = Command::new("powershell.exe")
            .args(["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", &exec_path])
            .args(extra_args)
            .output();
    }
    // No VM and no PowerShell: skip silently
}

fn run_powershell_script_capture(script: &Path, extra_args: &[&str]) -> String {
    let exec_path = convert_to_exec_path(script);
    let args_str = extra_args.join(" ");

    if let Some(vm_name) = find_parallels_vm() {
        let cmd_str = format!(
            "powershell.exe -NoProfile -ExecutionPolicy Bypass -File \"{}\" {}",
            exec_path, args_str
        );
        if let Ok(output) = Command::new("prlctl")
            .args(["exec", &vm_name, "cmd.exe", "/c", &cmd_str])
            .output()
        {
            return String::from_utf8_lossy(&output.stdout).to_string();
        }
    } else if which("powershell.exe") {
        if let Ok(output) = Command::new("powershell.exe")
            .args(["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", &exec_path])
            .args(extra_args)
            .output()
        {
            return String::from_utf8_lossy(&output.stdout).to_string();
        }
    }

    String::new()
}

fn find_parallels_vm() -> Option<String> {
    if !which("prlctl") { return None; }
    let output = Command::new("prlctl")
        .args(["list", "--all"])
        .output().ok()?;
    let text = String::from_utf8_lossy(&output.stdout);
    // prlctl list format: UUID STATUS IP_ADDR NAME (NAME can contain spaces)
    // Parse: skip UUID (contains {), skip status word, skip IP, rest is name
    for line in text.lines().skip(1) {
        if line.to_ascii_lowercase().contains("running") {
            let parts: Vec<&str> = line.split_whitespace().collect();
            // UUID=0, STATUS=1, IP=2, NAME=3..end
            if parts.len() >= 4 {
                return Some(parts[3..].join(" "));
            }
        }
    }
    None
}

fn which(cmd: &str) -> bool {
    Command::new("which").arg(cmd).output()
        .map(|o| o.status.success())
        .unwrap_or(false)
}

/// Convert a macOS path to a Parallels UNC path or leave as-is for Windows
fn convert_to_exec_path(path: &Path) -> String {
    let s = path.to_string_lossy();
    if s.starts_with("/Users/") {
        // macOS -> Parallels UNC: /Users/<user>/rest -> \\Mac\Home\rest
        if let Some(rest) = s.strip_prefix("/Users/") {
            if let Some(slash_pos) = rest.find('/') {
                let remainder = &rest[slash_pos + 1..];
                return format!("\\\\Mac\\Home\\{}", remainder.replace('/', "\\"));
            }
        }
    }
    s.to_string()
}

// #endregion


// #region Main

fn main() {
    let args: Vec<String> = env::args().collect();

    if args.len() < 2 {
        eprintln!("Usage: pbi-hooks <subcommand>");
        eprintln!("Subcommands: validate-dax, validate-measure, refresh-cache, check-ri");
        process::exit(1);
    }

    let subcommand = &args[1];

    // Read stdin
    let mut stdin_buf = String::new();
    io::stdin().read_to_string(&mut stdin_buf).unwrap_or_default();

    // Resolve paths
    let project_dir = env::var("CLAUDE_PROJECT_DIR")
        .map(PathBuf::from)
        .unwrap_or_else(|_| env::current_dir().unwrap_or_default());

    let hook_dir = env::var("CLAUDE_PLUGIN_ROOT")
        .map(|p| PathBuf::from(p).join("hooks"))
        .unwrap_or_else(|_| {
            // Fallback: binary is in hooks/ or adjacent
            env::current_exe()
                .unwrap_or_default()
                .parent()
                .unwrap_or(Path::new("."))
                .to_path_buf()
        });

    let config_path = hook_dir.join("config.yaml");

    match subcommand.as_str() {
        "validate-dax" => cmd_validate_dax(&stdin_buf, &project_dir, &config_path),
        "validate-measure" => cmd_validate_measure(&stdin_buf, &config_path),
        "refresh-cache" => cmd_refresh_cache(&stdin_buf, &project_dir, &config_path, &hook_dir),
        "check-ri" => cmd_check_ri(&stdin_buf, &project_dir, &config_path, &hook_dir),
        "check-compat" => cmd_check_compat(&stdin_buf, &project_dir, &config_path),
        _ => {
            eprintln!("Unknown subcommand: {}", subcommand);
            eprintln!("Available: validate-dax, validate-measure, refresh-cache, check-ri, check-compat");
            process::exit(1);
        }
    }
}

// #endregion
