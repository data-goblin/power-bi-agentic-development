// daxlib: CLI for browsing, downloading, and installing DAX library
// packages from daxlib.org into Power BI Desktop semantic models.
//
// Standalone operations (search, info, versions, functions, download)
// work without Power BI Desktop. Model operations (add, update, remove,
// installed) shell out to PowerShell for TOM/TmdlSerializer access.

use std::env;
use std::fs;
use std::path::Path;
use std::process::{self, Command};


// #region Types

struct DaxFunction {
    name: String,
    doc_comment: String,
    raw_text: String,
}

struct ParsedArgs {
    command: String,
    positional: Vec<String>,
    port: Option<u16>,
    version: Option<String>,
    functions: Vec<String>,
    output: Option<String>,
    #[allow(dead_code)]
    json: bool,
}

// #endregion


// #region Constants

const GITHUB_RAW: &str = "https://raw.githubusercontent.com/daxlib/daxlib/main/packages";
const GITHUB_API: &str = "https://api.github.com/repos/daxlib/daxlib";

// #endregion


// #region HTTP

fn http_get(url: &str) -> Result<String, String> {
    // Fetches a URL via `gh` CLI (authenticated, 5000 req/hr).
    // For GitHub API URLs, uses `gh api`. For raw content URLs, uses `gh api`
    // with the full URL. Falls back to curl if gh is unavailable.
    let output = if url.contains("api.github.com") {
        // Strip the base to get the API path: /repos/daxlib/daxlib/...
        let path = url.strip_prefix("https://api.github.com")
            .unwrap_or(url);
        Command::new("gh")
            .args(["api", path, "--cache", "1h"])
            .output()
    } else {
        // Raw content or other URLs: gh handles these too
        Command::new("gh")
            .args(["api", url, "--cache", "1h"])
            .output()
    };

    match output {
        Ok(out) if out.status.success() => {
            String::from_utf8(out.stdout)
                .map_err(|e| format!("Invalid UTF-8 in response: {e}"))
        }
        Ok(out) => {
            let stderr = String::from_utf8_lossy(&out.stderr);
            Err(format!("Request failed: {stderr}"))
        }
        Err(_) => {
            // Fallback to curl if gh not available
            let out = Command::new("curl")
                .args(["-sSf", "-L", "-H", "User-Agent: daxlib-cli", url])
                .output()
                .map_err(|e| format!("Neither gh nor curl available: {e}"))?;

            if !out.status.success() {
                let stderr = String::from_utf8_lossy(&out.stderr);
                return Err(format!("HTTP request failed: {stderr}"));
            }

            String::from_utf8(out.stdout)
                .map_err(|e| format!("Invalid UTF-8 in response: {e}"))
        }
    }
}

// #endregion


// #region Registry

fn semver_tuple(s: &str) -> (u32, u32, u32) {
    // Parses a semver string into (major, minor, patch), stripping pre-release suffix.
    let clean = s.split('-').next().unwrap_or(s);
    let parts: Vec<u32> = clean.split('.').filter_map(|p| p.parse().ok()).collect();
    (
        *parts.first().unwrap_or(&0),
        *parts.get(1).unwrap_or(&0),
        *parts.get(2).unwrap_or(&0),
    )
}


fn package_letter(id: &str) -> String {
    // Returns the first character of a package ID, lowercased.
    // Used to construct GitHub paths: packages/{letter}/{id}/...
    id.chars().next().unwrap_or('_').to_lowercase().to_string()
}


fn resolve_latest_stable(id: &str) -> Result<String, String> {
    // Queries GitHub API for all versions of a package, returns the
    // highest non-prerelease version. Pre-release versions contain
    // a hyphen (e.g. "0.1.0-beta"). Falls back to all versions if
    // no stable releases exist.
    let versions = list_versions(id)?;

    let stable: Vec<String> = versions.iter().filter(|v| !v.contains('-')).cloned().collect();
    let candidates = if stable.is_empty() { &versions } else { &stable };

    if candidates.is_empty() {
        return Err(format!("No versions found for '{id}'"));
    }

    // Sort by semver components descending
    let mut sorted = candidates.clone();
    sorted.sort_by(|a, b| {
        semver_tuple(b).cmp(&semver_tuple(a))
    });

    Ok(sorted[0].clone())
}


fn list_versions(id: &str) -> Result<Vec<String>, String> {
    // Lists all published versions for a package by querying the
    // GitHub Contents API. Returns version strings sorted newest first.
    let letter = package_letter(id);
    let url = format!("{GITHUB_API}/contents/packages/{letter}/{}", id.to_lowercase());
    let body = http_get(&url)?;

    let json: serde_json::Value = serde_json::from_str(&body)
        .map_err(|_| format!("Package '{id}' not found in daxlib registry"))?;

    let arr = json.as_array()
        .ok_or_else(|| format!("Unexpected response for '{id}'"))?;

    let mut versions: Vec<String> = arr.iter()
        .filter(|item| item["type"].as_str() == Some("dir"))
        .filter_map(|item| item["name"].as_str().map(String::from))
        .collect();

    versions.sort_by(|a, b| semver_tuple(b).cmp(&semver_tuple(a)));

    Ok(versions)
}


fn fetch_manifest(id: &str, version: &str) -> Result<serde_json::Value, String> {
    // Downloads and parses the manifest.daxlib JSON for a specific
    // package version from the GitHub raw content URL.
    let letter = package_letter(id);
    let url = format!("{GITHUB_RAW}/{letter}/{}/{version}/manifest.daxlib", id.to_lowercase());
    let body = http_get(&url)?;

    serde_json::from_str(&body)
        .map_err(|_| format!("Failed to parse manifest for {id} v{version}"))
}


fn fetch_functions_tmdl(id: &str, version: &str) -> Result<String, String> {
    // Downloads the functions.tmdl file for a specific package version.
    // Returns the raw TMDL text content.
    let letter = package_letter(id);
    let url = format!("{GITHUB_RAW}/{letter}/{}/{version}/lib/functions.tmdl", id.to_lowercase());
    http_get(&url)
}


fn search_packages(query: &str) -> Result<Vec<String>, String> {
    // Searches for packages matching a query string by fetching the
    // repository tree and filtering package paths. Matches against
    // the package ID (case-insensitive substring match).
    let url = format!("{GITHUB_API}/git/trees/main?recursive=1");
    let body = http_get(&url)?;

    let json: serde_json::Value = serde_json::from_str(&body)
        .map_err(|_| "Failed to parse repository tree".to_string())?;

    let tree = json["tree"].as_array()
        .ok_or("Invalid tree response")?;

    let query_lower = query.to_lowercase();
    let mut packages: Vec<String> = Vec::new();

    for item in tree {
        let path = match item["path"].as_str() {
            Some(p) => p,
            None => continue,
        };

        // Match manifest.daxlib files: packages/{letter}/{id}/{ver}/manifest.daxlib
        if !path.ends_with("/manifest.daxlib") { continue; }

        let parts: Vec<&str> = path.split('/').collect();
        if parts.len() != 5 || parts[0] != "packages" { continue; }

        let pkg_id = parts[2];
        if pkg_id.to_lowercase().contains(&query_lower) && !packages.contains(&pkg_id.to_string()) {
            packages.push(pkg_id.to_string());
        }
    }

    packages.sort();
    Ok(packages)
}

// #endregion


// #region TMDL Parser

fn parse_functions(tmdl: &str) -> Vec<DaxFunction> {
    // Parses a functions.tmdl file into individual DaxFunction blocks.
    // Each function includes its preceding doc comments (/// lines),
    // the function declaration, parameter list, expression body, and
    // trailing annotations. Boundaries are detected by the start of
    // a new `/// ` or `function ` line at the root indentation level.
    let lines: Vec<&str> = tmdl.lines().collect();
    let mut functions: Vec<DaxFunction> = Vec::new();
    let mut current_block: Vec<&str> = Vec::new();
    let mut current_doc: Vec<&str> = Vec::new();
    let mut in_function = false;

    for line in &lines {
        let trimmed = line.trim();

        // New doc comment block (might precede a function)
        if trimmed.starts_with("///") && !in_function {
            if !current_block.is_empty() {
                // Finish previous function
                if let Some(f) = build_function(&current_block, &current_doc) {
                    functions.push(f);
                }
                current_block.clear();
                current_doc.clear();
            }
            current_doc.push(line);
            continue;
        }

        // Function declaration at root level
        if trimmed.starts_with("function ") && !line.starts_with('\t') {
            if !current_block.is_empty() {
                if let Some(f) = build_function(&current_block, &current_doc) {
                    functions.push(f);
                }
                current_doc.clear();
            }
            current_block = vec![line];
            in_function = true;
            continue;
        }

        // New doc comment while in a function = end of current function
        if trimmed.starts_with("///") && in_function {
            if let Some(f) = build_function(&current_block, &current_doc) {
                functions.push(f);
            }
            current_block.clear();
            current_doc = vec![line];
            in_function = false;
            continue;
        }

        if in_function {
            current_block.push(line);
        } else if !trimmed.is_empty() && !trimmed.starts_with("///") {
            // Non-doc, non-function line outside a function block
            // (shouldn't happen in well-formed TMDL, but handle gracefully)
            current_doc.clear();
        }
    }

    // Final function
    if !current_block.is_empty() {
        if let Some(f) = build_function(&current_block, &current_doc) {
            functions.push(f);
        }
    }

    functions
}


fn build_function(block: &[&str], doc: &[&str]) -> Option<DaxFunction> {
    // Constructs a DaxFunction from raw text lines. Extracts the
    // function name from the declaration line (function 'Name' =).
    // Returns None if the name cannot be parsed.
    let decl = block.first()?;
    let name = extract_function_name(decl)?;

    let doc_text = doc.iter()
        .map(|l| l.trim().trim_start_matches("///").trim())
        .collect::<Vec<_>>()
        .join("\n");

    let mut raw_parts: Vec<&str> = Vec::new();
    raw_parts.extend_from_slice(doc);
    raw_parts.extend_from_slice(block);
    let raw_text = raw_parts.join("\n");

    Some(DaxFunction {
        name,
        doc_comment: doc_text,
        raw_text,
    })
}


fn extract_function_name(line: &str) -> Option<String> {
    // Extracts the function name from a TMDL function declaration.
    // Handles both quoted ('Name') and unquoted (Name) formats.
    let trimmed = line.trim();
    if !trimmed.starts_with("function ") { return None; }

    let after = &trimmed["function ".len()..];

    if after.starts_with('\'') {
        // Quoted name: function 'Package.Name' =
        let end = after[1..].find('\'')?;
        Some(after[1..1 + end].to_string())
    } else {
        // Unquoted name: function Name =
        let end = after.find(|c: char| c.is_whitespace() || c == '=')?;
        Some(after[..end].trim().to_string())
    }
}


fn extract_params_signature(block: &str) -> String {
    // Extracts a compact parameter signature from a function block.
    // Returns "(param1: TYPE, param2: TYPE, ...)" or "()" if no params found.
    let mut params: Vec<String> = Vec::new();
    let mut in_params = false;

    for line in block.lines() {
        let trimmed = line.trim();

        if trimmed == "(" || trimmed.ends_with("(") {
            in_params = true;
            continue;
        }

        if in_params {
            if trimmed.starts_with(')') {
                break;
            }

            // Skip comment-only lines inside params
            if trimmed.starts_with("//") { continue; }

            // Clean up: remove trailing comma, inline comments
            let clean = trimmed.split("//").next().unwrap_or(trimmed).trim();
            let clean = clean.trim_end_matches(',').trim();

            if !clean.is_empty() {
                params.push(clean.to_string());
            }
        }
    }

    if params.is_empty() {
        "()".to_string()
    } else {
        format!("({})", params.join(", "))
    }
}


fn filter_functions(tmdl: &str, names: &[String]) -> String {
    // Filters a functions.tmdl to include only the specified functions.
    // Returns a new TMDL string containing just the matched function blocks.
    // Matching is case-insensitive and supports partial names (suffix match).
    let functions = parse_functions(tmdl);
    let mut output: Vec<String> = Vec::new();

    for func in &functions {
        let func_lower = func.name.to_lowercase();
        let matched = names.iter().any(|n| {
            let n_lower = n.to_lowercase();
            func_lower == n_lower || func_lower.ends_with(&format!(".{n_lower}"))
        });

        if matched {
            output.push(func.raw_text.clone());
        }
    }

    output.join("\n\n")
}

// #endregion


// #region daxlib-tom Helper

fn find_daxlib_tom() -> Option<String> {
    // Locates the daxlib-tom .csproj project directory (run via `dotnet run`).
    // Search order:
    // 1. Sibling scripts/daxlib-tom/ (packaged skill layout: bin/ -> ../scripts/daxlib-tom/)
    // 2. Ancestor walk (dev layout: tools/daxlib-tom/)
    // 3. DAXLIB_TOM_DIR env var
    let exe = env::current_exe().ok()?;
    let exe_dir = exe.parent()?;

    let has_csproj = |dir: &Path| dir.join("daxlib-tom.csproj").exists();

    // 1. Skill layout: bin/<platform>/daxlib -> ../../scripts/daxlib-tom/
    for ancestor in exe_dir.ancestors().take(4) {
        let candidate = ancestor.join("scripts").join("daxlib-tom");
        if has_csproj(&candidate) {
            return Some(candidate.to_string_lossy().to_string());
        }
    }

    // 2. Dev layout: tools/daxlib/target/release/ -> tools/daxlib-tom/
    for ancestor in exe_dir.ancestors().take(5) {
        let candidate = ancestor.join("daxlib-tom");
        if has_csproj(&candidate) {
            return Some(candidate.to_string_lossy().to_string());
        }
    }

    // 3. Env var
    if let Ok(dir) = env::var("DAXLIB_TOM_DIR") {
        if has_csproj(Path::new(&dir)) { return Some(dir); }
    }

    None
}


fn detect_parallels_vm() -> Option<String> {
    // On macOS, finds the first running Parallels VM name.
    // Override with DAXLIB_VM env var.
    if let Ok(vm) = env::var("DAXLIB_VM") {
        return Some(vm);
    }

    // Use JSON-like output to handle VM names with spaces.
    // `prlctl list -j` returns JSON; parse name from running VMs.
    let output = Command::new("prlctl")
        .args(["list", "--all", "-j"])
        .output()
        .ok()?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    if let Ok(json) = serde_json::from_str::<serde_json::Value>(&stdout) {
        if let Some(arr) = json.as_array() {
            for vm in arr {
                if vm["status"].as_str() == Some("running") {
                    return vm["name"].as_str().map(String::from);
                }
            }
        }
    }

    None
}


fn macos_to_unc(path: &str) -> String {
    // Converts a macOS path to a Parallels shared folder UNC path.
    // /Users/<user>/... -> \\Mac\Home\...
    // /tmp/... -> written to ~/Desktop/ instead (caller handles this)
    let home = env::var("HOME").unwrap_or_else(|_| "/Users/unknown".to_string());
    if path.starts_with(&home) {
        let relative = &path[home.len()..];
        format!("\\\\Mac\\Home{}", relative.replace('/', "\\"))
    } else {
        eprintln!("Path '{}' is outside $HOME and cannot be mapped to a Parallels shared folder.", path);
        eprintln!("Move the file under your home directory or set DAXLIB_TOM_DIR.");
        process::exit(1);
    }
}


fn escape_cmd_arg(s: &str) -> String {
    // Escapes cmd.exe metacharacters inside double-quoted args.
    s.replace('"', "\\\"")
        .replace('&', "^&")
        .replace('|', "^|")
        .replace('<', "^<")
        .replace('>', "^>")
        .replace('^', "^^")
        .replace('%', "%%")
}


fn run_daxlib_tom(args: &[&str]) -> Result<(), i32> {
    // Runs daxlib-tom via `dotnet run`. On Windows, calls dotnet directly.
    // On macOS, wraps in prlctl exec to run inside the Parallels VM.
    // Returns Err(exit_code) on failure so callers can clean up.
    let project_dir = find_daxlib_tom().ok_or_else(|| {
        eprintln!("Cannot find daxlib-tom project.");
        eprintln!("Set DAXLIB_TOM_DIR to the project directory.");
        1
    })?;

    if cfg!(target_os = "windows") {
        let mut cmd = Command::new("dotnet");
        cmd.arg("run").arg("--project").arg(&project_dir)
            .arg("-c").arg("Release").arg("--");
        for arg in args { cmd.arg(arg); }

        let status = cmd.status().map_err(|e| {
            eprintln!("Failed to run dotnet: {e}");
            1
        })?;

        if !status.success() { return Err(status.code().unwrap_or(1)); }
    } else {
        let vm = detect_parallels_vm().ok_or_else(|| {
            eprintln!("No running Parallels VM found.");
            eprintln!("Set DAXLIB_VM to the VM name.");
            1
        })?;

        let unc_project = macos_to_unc(&project_dir);

        let converted_args: Vec<String> = args.iter().map(|a| {
            if a.starts_with('/') && (a.ends_with(".tmdl") || a.contains("/daxlib")) {
                macos_to_unc(a)
            } else {
                a.to_string()
            }
        }).collect();

        let dotnet_cmd = format!(
            "dotnet run --project \"{}\" -c Release -- {}",
            escape_cmd_arg(&unc_project),
            converted_args.iter()
                .map(|a| format!("\"{}\"", escape_cmd_arg(a)))
                .collect::<Vec<_>>()
                .join(" ")
        );

        let status = Command::new("prlctl")
            .args(["exec", &vm, "cmd.exe", "/c", &dotnet_cmd])
            .status()
            .map_err(|e| {
                eprintln!("Failed to run prlctl: {e}");
                1
            })?;

        if !status.success() { return Err(status.code().unwrap_or(1)); }
    }

    Ok(())
}

// #endregion


// #region Commands

fn cmd_search(args: &ParsedArgs) {
    // Searches the daxlib registry for packages matching the query.
    // Fetches the repo tree with a single API call and filters by
    // case-insensitive substring match on package IDs.
    let query = args.positional.first().unwrap_or_else(|| {
        eprintln!("Usage: daxlib search <query>");
        process::exit(1);
    });

    eprintln!("Searching for '{query}'...");

    match search_packages(query) {
        Ok(packages) => {
            if packages.is_empty() {
                println!("No packages found matching '{query}'");
            } else {
                println!("{} package(s) found:", packages.len());
                println!();
                for pkg in &packages {
                    // Try to fetch manifest for description
                    if let Ok(versions) = list_versions(pkg) {
                        if let Some(ver) = versions.first() {
                            if let Ok(manifest) = fetch_manifest(pkg, ver) {
                                let desc = manifest["description"].as_str().unwrap_or("");
                                let tags = manifest["tags"].as_str().unwrap_or("");
                                println!("  {pkg}  v{ver}");
                                if !desc.is_empty() {
                                    println!("    {desc}");
                                }
                                if !tags.is_empty() {
                                    println!("    tags: {tags}");
                                }
                                println!();
                                continue;
                            }
                        }
                    }
                    println!("  {pkg}");
                }
            }
        }
        Err(e) => {
            eprintln!("Error: {e}");
            process::exit(1);
        }
    }
}


fn cmd_info(args: &ParsedArgs) {
    // Shows detailed information about a package: manifest metadata,
    // available versions, and function count in the latest version.
    let id = args.positional.first().unwrap_or_else(|| {
        eprintln!("Usage: daxlib info <package-id> [--version <ver>]");
        process::exit(1);
    });

    let version = match &args.version {
        Some(v) => v.clone(),
        None => match resolve_latest_stable(id) {
            Ok(v) => v,
            Err(e) => { eprintln!("Error: {e}"); process::exit(1); }
        },
    };

    let manifest = match fetch_manifest(id, &version) {
        Ok(m) => m,
        Err(e) => { eprintln!("Error: {e}"); process::exit(1); }
    };

    let field = |key: &str| manifest[key].as_str().unwrap_or("-").to_string();

    println!("Package:     {}", field("id"));
    println!("Version:     {}", field("version"));
    println!("Authors:     {}", field("authors"));
    println!("Description: {}", field("description"));
    println!("Tags:        {}", field("tags"));

    if manifest["projectUrl"].is_string() {
        println!("Project:     {}", field("projectUrl"));
    }
    if manifest["repositoryUrl"].is_string() {
        println!("Repository:  {}", field("repositoryUrl"));
    }
    if manifest["releaseNotes"].is_string() {
        println!("Notes:       {}", field("releaseNotes"));
    }

    // Show function count
    if let Ok(tmdl) = fetch_functions_tmdl(id, &version) {
        let fns = parse_functions(&tmdl);
        println!();
        println!("Functions:   {}", fns.len());
    }
}


fn cmd_versions(args: &ParsedArgs) {
    // Lists all published versions for a package, newest first.
    // Pre-release versions are marked with a (pre) suffix.
    let id = args.positional.first().unwrap_or_else(|| {
        eprintln!("Usage: daxlib versions <package-id>");
        process::exit(1);
    });

    match list_versions(id) {
        Ok(versions) => {
            println!("Versions for {id}:");
            for v in &versions {
                let pre = if v.contains('-') { " (pre)" } else { "" };
                println!("  {v}{pre}");
            }
        }
        Err(e) => {
            eprintln!("Error: {e}");
            process::exit(1);
        }
    }
}


fn cmd_functions(args: &ParsedArgs) {
    // Lists all functions in a package with their parameter signatures.
    // Downloads and parses the functions.tmdl for the specified version.
    let id = args.positional.first().unwrap_or_else(|| {
        eprintln!("Usage: daxlib functions <package-id> [--version <ver>]");
        process::exit(1);
    });

    let version = match &args.version {
        Some(v) => v.clone(),
        None => match resolve_latest_stable(id) {
            Ok(v) => v,
            Err(e) => { eprintln!("Error: {e}"); process::exit(1); }
        },
    };

    eprintln!("Fetching {id} v{version}...");

    let tmdl = match fetch_functions_tmdl(id, &version) {
        Ok(t) => t,
        Err(e) => { eprintln!("Error: {e}"); process::exit(1); }
    };

    let functions = parse_functions(&tmdl);
    println!("{id} v{version} -- {} function(s):", functions.len());
    println!();

    for func in &functions {
        let sig = extract_params_signature(&func.raw_text);
        println!("  {}{sig}", func.name);

        // Show first line of doc comment if present
        let first_line = func.doc_comment.lines().next().unwrap_or("");
        if !first_line.is_empty() {
            println!("    {first_line}");
        }
        println!();
    }
}


fn cmd_download(args: &ParsedArgs) {
    // Downloads functions.tmdl for a package, optionally filtered to
    // specific functions. Writes to the output directory (default: cwd).
    let id = args.positional.first().unwrap_or_else(|| {
        eprintln!("Usage: daxlib download <package-id> [--version <ver>] [--fn name[,name]] [--output <dir>]");
        process::exit(1);
    });

    let version = match &args.version {
        Some(v) => v.clone(),
        None => match resolve_latest_stable(id) {
            Ok(v) => v,
            Err(e) => { eprintln!("Error: {e}"); process::exit(1); }
        },
    };

    eprintln!("Downloading {id} v{version}...");

    let tmdl = match fetch_functions_tmdl(id, &version) {
        Ok(t) => t,
        Err(e) => { eprintln!("Error: {e}"); process::exit(1); }
    };

    let output_content = if args.functions.is_empty() {
        tmdl
    } else {
        let filtered = filter_functions(&tmdl, &args.functions);
        if filtered.is_empty() {
            eprintln!("No matching functions found. Available:");
            for f in parse_functions(&tmdl) {
                eprintln!("  {}", f.name);
            }
            process::exit(1);
        }
        filtered
    };

    let out_dir = args.output.as_deref().unwrap_or(".");
    let filename = format!("{}.functions.tmdl", id.to_lowercase());
    let out_path = Path::new(out_dir).join(&filename);

    fs::write(&out_path, &output_content).unwrap_or_else(|e| {
        eprintln!("Error writing {}: {e}", out_path.display());
        process::exit(1);
    });

    let fns = parse_functions(&output_content);
    println!("Wrote {} ({} functions) to {}", filename, fns.len(), out_path.display());
}


fn cmd_add(args: &ParsedArgs) {
    // Installs a daxlib package (or specific functions) into a PBI
    // Desktop model. Downloads TMDL, optionally filters, writes to
    // a temp file, and calls daxlib-tom for TOM installation.
    let id = args.positional.first().unwrap_or_else(|| {
        eprintln!("Usage: daxlib add <package-id> --port <port> [--version <ver>] [--fn name[,name]]");
        process::exit(1);
    });

    let port = args.port.unwrap_or_else(|| {
        eprintln!("--port is required for add");
        process::exit(1);
    });

    let version = match &args.version {
        Some(v) => v.clone(),
        None => match resolve_latest_stable(id) {
            Ok(v) => v,
            Err(e) => { eprintln!("Error: {e}"); process::exit(1); }
        },
    };

    eprintln!("Downloading {id} v{version}...");

    let tmdl = match fetch_functions_tmdl(id, &version) {
        Ok(t) => t,
        Err(e) => { eprintln!("Error: {e}"); process::exit(1); }
    };

    let install_tmdl = if args.functions.is_empty() {
        tmdl
    } else {
        let filtered = filter_functions(&tmdl, &args.functions);
        if filtered.is_empty() {
            eprintln!("No matching functions found.");
            process::exit(1);
        }
        filtered
    };

    let temp = write_temp_tmdl(&install_tmdl);
    let port_str = port.to_string();
    let mut tom_args: Vec<&str> = vec!["add", &port_str, &temp.0];
    let fn_arg = args.functions.join(",");
    if !args.functions.is_empty() {
        tom_args.push("--fn");
        tom_args.push(&fn_arg);
    }
    if let Err(code) = run_daxlib_tom(&tom_args) {
        drop(temp); // explicit cleanup before exit
        process::exit(code);
    }
}


fn cmd_update(args: &ParsedArgs) {
    // Updates an installed daxlib package to a new version. Removes
    // all existing functions for the package, then installs the new version.
    let id = args.positional.first().unwrap_or_else(|| {
        eprintln!("Usage: daxlib update <package-id> --port <port> [--version <ver>]");
        process::exit(1);
    });

    let port = args.port.unwrap_or_else(|| {
        eprintln!("--port is required for update");
        process::exit(1);
    });

    let version = match &args.version {
        Some(v) => v.clone(),
        None => match resolve_latest_stable(id) {
            Ok(v) => v,
            Err(e) => { eprintln!("Error: {e}"); process::exit(1); }
        },
    };

    eprintln!("Updating {id} to v{version}...");

    let tmdl = match fetch_functions_tmdl(id, &version) {
        Ok(t) => t,
        Err(e) => { eprintln!("Error: {e}"); process::exit(1); }
    };

    let temp = write_temp_tmdl(&tmdl);
    let port_str = port.to_string();
    if let Err(code) = run_daxlib_tom(&["update", &port_str, id, &temp.0]) {
        drop(temp);
        process::exit(code);
    }
}


fn cmd_remove(args: &ParsedArgs) {
    // Removes a daxlib package (or specific functions) from a PBI
    // Desktop model. If --fn is specified, only removes those functions.
    let id = args.positional.first().unwrap_or_else(|| {
        eprintln!("Usage: daxlib remove <package-id> --port <port> [--fn name[,name]]");
        process::exit(1);
    });

    let port = args.port.unwrap_or_else(|| {
        eprintln!("--port is required for remove");
        process::exit(1);
    });

    let port_str = port.to_string();
    let mut tom_args: Vec<&str> = vec!["remove", &port_str, id];
    let fn_arg = args.functions.join(",");
    if !args.functions.is_empty() {
        tom_args.push("--fn");
        tom_args.push(&fn_arg);
    }
    if let Err(code) = run_daxlib_tom(&tom_args) {
        process::exit(code);
    }
}


fn cmd_installed(args: &ParsedArgs) {
    // Lists all installed daxlib packages in a PBI Desktop model
    // by scanning UDF annotations via daxlib-tom.
    let port = args.port.unwrap_or_else(|| {
        eprintln!("--port is required for installed");
        process::exit(1);
    });

    let port_str = port.to_string();
    if let Err(code) = run_daxlib_tom(&["installed", &port_str]) {
        process::exit(code);
    }
}

// #endregion


// #region Execution

struct TempFile(String);

impl Drop for TempFile {
    fn drop(&mut self) {
        let _ = fs::remove_file(&self.0);
    }
}


fn write_temp_tmdl(tmdl: &str) -> TempFile {
    // Writes TMDL content to a temp file. On macOS, uses home directory
    // (shared with Parallels VM) instead of /tmp/ (not shared).
    let temp_dir = if cfg!(target_os = "macos") {
        env::var("HOME").map(|h| Path::new(&h).join(".daxlib-tmp")).unwrap_or_else(|_| env::temp_dir())
    } else {
        env::temp_dir()
    };

    let _ = fs::create_dir_all(&temp_dir);
    let temp_path = temp_dir.join(format!("daxlib_{}.tmdl", std::process::id()));
    fs::write(&temp_path, tmdl).unwrap_or_else(|e| {
        eprintln!("Error writing temp file: {e}");
        process::exit(1);
    });
    TempFile(temp_path.to_string_lossy().to_string())
}

// #endregion


// #region Arg Parsing

fn parse_args() -> ParsedArgs {
    // Parses CLI arguments into a structured ParsedArgs.
    // Supports: --port, --version, --fn (comma-separated), --output, --json
    let args: Vec<String> = env::args().skip(1).collect();

    if args.is_empty() {
        print_usage();
        process::exit(1);
    }

    let command = args[0].clone();
    let mut positional: Vec<String> = Vec::new();
    let mut port: Option<u16> = None;
    let mut version: Option<String> = None;
    let mut functions: Vec<String> = Vec::new();
    let mut output: Option<String> = None;
    let mut json = false;

    let mut i = 1;
    while i < args.len() {
        match args[i].as_str() {
            "--port" | "-p" => {
                i += 1;
                port = Some(args.get(i).and_then(|v| v.parse().ok()).unwrap_or_else(|| {
                    eprintln!("--port requires a number");
                    process::exit(1);
                }));
            }
            "--version" | "-v" => {
                i += 1;
                version = args.get(i).cloned();
            }
            "--fn" | "-f" => {
                i += 1;
                if let Some(val) = args.get(i) {
                    for name in val.split(',') {
                        let trimmed = name.trim().to_string();
                        if !trimmed.is_empty() {
                            functions.push(trimmed);
                        }
                    }
                }
            }
            "--output" | "-o" => {
                i += 1;
                output = args.get(i).cloned();
            }
            "--json" => { json = true; }
            "--help" | "-h" => {
                print_usage();
                process::exit(0);
            }
            other => {
                if other.starts_with('-') {
                    eprintln!("Unknown flag: {other}");
                    process::exit(1);
                }
                positional.push(other.to_string());
            }
        }
        i += 1;
    }

    ParsedArgs { command, positional, port, version, functions, output, json }
}

// #endregion


// #region Main

fn print_usage() {
    eprintln!("daxlib 0.1.0");
    eprintln!("CLI for DAX library packages from daxlib.org");
    eprintln!();
    eprintln!("USAGE:");
    eprintln!("  daxlib <command> [options]");
    eprintln!();
    eprintln!("COMMANDS (standalone):");
    eprintln!("  search <query>              Search packages by name");
    eprintln!("  info <package>              Show package details");
    eprintln!("  versions <package>          List available versions");
    eprintln!("  functions <package>         List functions with signatures");
    eprintln!("  download <package>          Download functions.tmdl");
    eprintln!();
    eprintln!("COMMANDS (require PBI Desktop):");
    eprintln!("  add <package> --port <p>    Install package into model");
    eprintln!("  update <package> --port <p> Update package in model");
    eprintln!("  remove <package> --port <p> Remove package from model");
    eprintln!("  installed --port <p>        List installed packages");
    eprintln!();
    eprintln!("OPTIONS:");
    eprintln!("  --port, -p <port>           PBI Desktop AS port");
    eprintln!("  --version, -v <ver>         Package version (default: latest stable)");
    eprintln!("  --fn, -f <name[,name]>      Specific function(s) to add/remove/download");
    eprintln!("  --output, -o <dir>          Output directory for download");
    eprintln!("  --json                      JSON output (where supported)");
    eprintln!();
    eprintln!("EXAMPLES:");
    eprintln!("  daxlib search svg");
    eprintln!("  daxlib info DaxLib.SVG");
    eprintln!("  daxlib functions PowerofBI.IBCS");
    eprintln!("  daxlib download DaxLib.SVG --fn \"DaxLib.SVG.Element.Rect,DaxLib.SVG.SVG\"");
    eprintln!("  daxlib add DaxLib.SVG --port 54321");
    eprintln!("  daxlib add DaxLib.SVG --port 54321 --fn \"DaxLib.SVG.Element.Rect\"");
    eprintln!("  daxlib update PowerofBI.IBCS --port 54321 --version 0.11.0");
    eprintln!("  daxlib remove DaxLib.SVG --port 54321 --fn \"DaxLib.SVG.Color.Theme\"");
    eprintln!("  daxlib installed --port 54321");
}


fn main() {
    let args = parse_args();

    match args.command.as_str() {
        "search"    => cmd_search(&args),
        "info"      => cmd_info(&args),
        "versions"  => cmd_versions(&args),
        "functions" => cmd_functions(&args),
        "download"  => cmd_download(&args),
        "add"       => cmd_add(&args),
        "update"    => cmd_update(&args),
        "remove"    => cmd_remove(&args),
        "installed" => cmd_installed(&args),
        other => {
            eprintln!("Unknown command: {other}");
            eprintln!();
            print_usage();
            process::exit(1);
        }
    }
}

// #endregion
