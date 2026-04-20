#!/bin/bash
#
# pbi-hooks.sh: Validation hooks for Power BI Desktop TOM/ADOMD workflows.
# Script-based replacement for the pbi-hooks binary; requires bash 3.2+ and jq.
#
# Subcommands:
#   validate-dax      - Check DAX table/column/measure references against cached model metadata
#   validate-measure  - Ensure new measures have DisplayFolder, Description, FormatString
#   refresh-cache     - Re-snapshot model metadata after TOM connect or modification
#   check-ri          - Check referential integrity after relationship/column changes
#   check-compat      - Report features available at higher compatibility levels
#
# All subcommands read hook JSON from stdin and follow Claude Code hook conventions:
#   exit 0 = OK or not applicable
#   exit 2 = blocking error (stderr shown to Claude)


# #region Setup

set -uo pipefail

SUBCOMMAND="${1:-}"
if [[ -z "$SUBCOMMAND" ]]; then
    exit 0
fi

HOOK_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)"
CONFIG_PATH="$HOOK_DIR/config.yaml"
PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"
METADATA_PATH="$PROJECT_DIR/tmp/model-metadata.json"
COMPAT_MARKER_PATH="$PROJECT_DIR/tmp/.compat-warned"

# Read stdin once
STDIN_BUF="$(cat)"

# Require jq
if ! command -v jq &>/dev/null; then
    exit 0
fi

# #endregion


# #region Config

config_is_enabled() {
    # Checks if a config key is enabled in config.yaml.
    # Returns 0 (true) if key is missing or set to anything other than "false".
    local key="$1"
    if [[ ! -f "$CONFIG_PATH" ]]; then
        return 0
    fi
    local val
    val=$(grep -E "^${key}:" "$CONFIG_PATH" 2>/dev/null | head -1 | sed 's/^[^:]*: *//' | tr -d '[:space:]')
    if [[ "$val" == "false" ]]; then
        return 1
    fi
    return 0
}

# #endregion


# #region JSON helpers

extract_tool_name() {
    # Extracts tool_name from hook stdin JSON.
    echo "$STDIN_BUF" | jq -r '.tool_name // empty' 2>/dev/null
}

extract_command() {
    # Extracts tool_input.command from hook stdin JSON.
    echo "$STDIN_BUF" | jq -r '.tool_input.command // empty' 2>/dev/null
}

resolve_command_text() {
    # If the command is a -File <path>.ps1 invocation, read the .ps1 file contents.
    # Otherwise return the command text as-is.
    # Handles UNC paths (\\Mac\Home\...) from Parallels by converting to macOS paths.
    local cmd="$1"
    local lower
    lower="$(echo "$cmd" | tr '[:upper:]' '[:lower:]')"

    if [[ "$lower" != *"-file"* ]]; then
        echo "$cmd"
        return
    fi

    # Extract everything after -File, strip quotes and whitespace
    local after_file
    after_file=$(printf '%s' "$cmd" | sed 's/.*-[Ff]ile[[:space:]]*//')

    # Strip surrounding quotes (regular and escaped), preserving backslashes in the path
    after_file=$(printf '%s' "$after_file" | sed 's/^["]*//;s/["]*$//;s/^\\"//;s/\\"$//')

    # Trim to just the .ps1 path (stop at first .ps1)
    local ps1_path
    ps1_path=$(printf '%s' "$after_file" | sed -n 's/\(.*\.ps1\).*/\1/p')

    if [[ -z "$ps1_path" ]]; then
        echo "$cmd"
        return
    fi

    # Try path as-is (works on Windows or local macOS paths)
    if [[ -f "$ps1_path" ]]; then
        cat "$ps1_path"
        return
    fi

    # Convert backslashes to forward slashes, then collapse consecutive slashes
    local fwd_path
    fwd_path="${ps1_path//\\//}"
    fwd_path=$(printf '%s' "$fwd_path" | sed 's#/\{1,\}#/#g')

    # Convert UNC /Mac/Home/... to /Users/$USER/...
    if [[ "$fwd_path" == /Mac/Home/* ]]; then
        local mac_path="${HOME}${fwd_path#/Mac/Home}"
        if [[ -f "$mac_path" ]]; then
            cat "$mac_path"
            return
        fi
    fi

    # Try the forward-slash version directly
    if [[ -f "$fwd_path" ]]; then
        cat "$fwd_path"
        return
    fi

    echo "$cmd"
}

# #endregion


# #region DAX reference extraction

extract_table_col_refs() {
    # Extracts 'Table'[Column] references from text.
    # Outputs lines of "table<TAB>column" pairs.
    # Handles standard ('Table'[Col]) form.
    local text="$1"

    # Match 'Table'[Column] patterns; handles single-quoted table names
    echo "$text" | grep -oE "'[^']+'\[[^]]+\]" | while IFS= read -r ref; do
        local table col
        table=$(echo "$ref" | sed "s/^'\\([^']*\\)'.*/\\1/")
        col=$(echo "$ref" | sed "s/.*\\[\\([^]]*\\)\\].*/\\1/")
        printf '%s\t%s\n' "$table" "$col"
    done | sort -u
}

extract_bracket_refs() {
    # Extracts standalone [Ref] bracket references (potential measures).
    # Filters out: ["..."], ['...'], [$...], [@...], [0], etc.
    local text="$1"

    echo "$text" | grep -oE '\[[^]]+\]' | while IFS= read -r ref; do
        local content="${ref:1:${#ref}-2}"

        # Skip indexers and qualified refs
        case "$content" in
            '"'*|"'"*|'$'*|'@'*|'\\'*) continue ;;
        esac

        # Skip numeric-only
        if [[ "$content" =~ ^[0-9]+$ ]]; then continue; fi

        # Skip PowerShell type annotations: [string], [int], [System.IO.File], [Parameter(...)], etc.
        # These are all-lowercase, contain dots, or contain parentheses
        if [[ "$content" == *"("* || "$content" == *"."* ]]; then continue; fi
        if [[ "$content" =~ ^[a-z]+$ ]]; then continue; fi

        echo "$content"
    done | sort -u
}

extract_defined_measures() {
    # Extracts DEFINE MEASURE target names from text.
    # Looks for: MEASURE 'Table'[Name] patterns.
    local text="$1"
    local lower
    lower="$(echo "$text" | tr '[:upper:]' '[:lower:]')"

    echo "$text" | grep -ioE "MEASURE[[:space:]]+'[^']+'\[[^]]+\]" | while IFS= read -r match; do
        echo "$match" | sed "s/.*\\[\\([^]]*\\)\\].*/\\1/"
    done | sort -u
}

has_dax_context() {
    # Returns 0 if the text contains DAX keywords or 'Table'[Col] references.
    local text="$1"
    local lower
    lower="$(echo "$text" | tr '[:upper:]' '[:lower:]')"

    for kw in evaluate summarizecolumns calculatetable countrows sumx averagex maxx minx addcolumns selectcolumns topn commandtext expression; do
        if [[ "$lower" == *"$kw"* ]]; then return 0; fi
    done

    if [[ "$text" == *"'"* && "$text" == *"["* ]]; then
        local refs
        refs=$(extract_table_col_refs "$text")
        if [[ -n "$refs" ]]; then return 0; fi
    fi

    return 1
}

suggest_match() {
    # Finds close matches for a name in a list.
    # Outputs up to $3 suggestions, trying exact (case-insensitive), then substring.
    local needle="$1"
    local haystack="$2"
    local max="${3:-3}"
    local needle_lower
    needle_lower="$(echo "$needle" | tr '[:upper:]' '[:lower:]')"

    # Pass 1: case-insensitive exact
    local exact
    exact=$(echo "$haystack" | while IFS= read -r item; do
        local item_lower
        item_lower="$(echo "$item" | tr '[:upper:]' '[:lower:]')"
        if [[ "$item_lower" == "$needle_lower" ]]; then echo "$item"; fi
    done | head -n "$max")
    if [[ -n "$exact" ]]; then echo "$exact"; return; fi

    # Pass 2: substring match
    local contains
    contains=$(echo "$haystack" | while IFS= read -r item; do
        local item_lower
        item_lower="$(echo "$item" | tr '[:upper:]' '[:lower:]')"
        if [[ "$item_lower" == *"$needle_lower"* ]]; then echo "$item"; fi
    done | head -n "$max")
    if [[ -n "$contains" ]]; then echo "$contains"; return; fi

    # Pass 3: first word
    local first_word
    first_word="$(echo "$needle" | awk '{print $1}')"
    if [[ ${#first_word} -ge 3 ]]; then
        local fw_lower
        fw_lower="$(echo "$first_word" | tr '[:upper:]' '[:lower:]')"
        echo "$haystack" | while IFS= read -r item; do
            local item_lower
            item_lower="$(echo "$item" | tr '[:upper:]' '[:lower:]')"
            if [[ "$item_lower" == *"$fw_lower"* ]]; then echo "$item"; fi
        done | head -n "$max"
    fi
}

format_suggestions() {
    # Formats a list of suggestions (one per line) into a hint string.
    local suggestions="$1"
    if [[ -z "$suggestions" ]]; then return; fi
    local quoted
    quoted=$(echo "$suggestions" | sed "s/^/'/" | sed "s/$/'/" | tr '\n' ',' | sed 's/,$//' | sed 's/,/, /g')
    echo " Did you mean ${quoted}?"
}

# #endregion


# #region Subcommand: validate-dax

cmd_validate_dax() {
    config_is_enabled "dax_validation" || exit 0

    local tool_name
    tool_name="$(extract_tool_name)"
    [[ "$tool_name" == "Bash" ]] || exit 0

    local raw_command
    raw_command="$(extract_command)"
    [[ -n "$raw_command" ]] || exit 0

    local command_text
    command_text="$(resolve_command_text "$raw_command")"

    [[ -f "$METADATA_PATH" ]] || exit 0
    has_dax_context "$command_text" || exit 0

    # Parse metadata with jq
    local all_tables all_columns_json all_measures_json
    all_tables=$(jq -r '.tables[].name' "$METADATA_PATH" 2>/dev/null) || exit 0
    all_columns_json=$(jq -r '.tables[] | .name as $t | (.columns // [])[] | .name as $c | "\($t)\t\($c)"' "$METADATA_PATH" 2>/dev/null) || exit 0
    all_measures_json=$(jq -r '.tables[] | .name as $t | (.measures // [])[] | .name as $m | "\($t)\t\($m)"' "$METADATA_PATH" 2>/dev/null) || exit 0

    local errors=""

    # Get DEFINE MEASURE names for exclusion
    local defined_measures
    defined_measures="$(extract_defined_measures "$command_text")"

    # Validate 'Table'[Column] references
    local refs
    refs="$(extract_table_col_refs "$command_text")"

    if [[ -n "$refs" ]]; then
        while IFS=$'\t' read -r ref_table ref_col; do
            # Skip DEFINE MEASURE targets
            if [[ -n "$defined_measures" ]] && echo "$defined_measures" | grep -qxF "$ref_col"; then
                # Also check table match for the DEFINE target
                local is_define_target=false
                echo "$command_text" | grep -ioE "MEASURE[[:space:]]+'${ref_table}'\[${ref_col}\]" &>/dev/null && is_define_target=true
                if $is_define_target; then continue; fi
            fi

            # Check table exists
            if ! echo "$all_tables" | grep -qxF "$ref_table"; then
                local suggestions hint
                suggestions="$(suggest_match "$ref_table" "$all_tables")"
                hint="$(format_suggestions "$suggestions")"
                errors="${errors}Table '${ref_table}' does not exist in the model.${hint} "
                continue
            fi

            # Check column exists in table
            if ! echo "$all_columns_json" | grep -qP "^\Q${ref_table}\E\t\Q${ref_col}\E$" 2>/dev/null; then
                # Fallback for systems without -P
                if ! echo "$all_columns_json" | grep -qxF "${ref_table}	${ref_col}" 2>/dev/null; then
                    local table_cols suggestions hint
                    table_cols=$(echo "$all_columns_json" | grep "^${ref_table}	" | cut -f2)
                    suggestions="$(suggest_match "$ref_col" "$table_cols")"
                    hint="$(format_suggestions "$suggestions")"
                    errors="${errors}Column [${ref_col}] does not exist in table '${ref_table}'.${hint} "
                fi
            fi
        done <<< "$refs"
    fi

    # Validate unqualified [Ref] bracket references as measures
    local bracket_refs
    bracket_refs="$(extract_bracket_refs "$command_text")"

    if [[ -n "$bracket_refs" ]]; then
        local all_measure_names all_column_names
        all_measure_names=$(echo "$all_measures_json" | cut -f2 | sort -u)
        all_column_names=$(echo "$all_columns_json" | cut -f2 | sort -u)

        # Collect qualified columns for exclusion
        local qualified_cols=""
        if [[ -n "$refs" ]]; then
            qualified_cols=$(echo "$refs" | cut -f2)
        fi

        while IFS= read -r ref_name; do
            [[ -n "$ref_name" ]] || continue

            # Skip if already checked as table-qualified
            if [[ -n "$qualified_cols" ]] && echo "$qualified_cols" | grep -qxF "$ref_name"; then continue; fi

            # Skip if it's a DEFINE MEASURE name
            if [[ -n "$defined_measures" ]] && echo "$defined_measures" | grep -qxF "$ref_name"; then continue; fi

            # Check if it's a known measure or column
            if echo "$all_measure_names" | grep -qxF "$ref_name"; then continue; fi
            if echo "$all_column_names" | grep -qxF "$ref_name"; then continue; fi

            # Skip string literal aliases
            if [[ "$command_text" == *"\"${ref_name}\""* ]]; then continue; fi

            local all_fields suggestions hint
            all_fields=$(printf '%s\n%s' "$all_measure_names" "$all_column_names" | sort -u)
            suggestions="$(suggest_match "$ref_name" "$all_fields")"
            hint="$(format_suggestions "$suggestions")"
            errors="${errors}[${ref_name}] is not a known measure or column in the model.${hint} "
        done <<< "$bracket_refs"
    fi

    if [[ -n "$errors" ]]; then
        echo "DAX validation failed: ${errors}(Set dax_validation: false in ${CONFIG_PATH} to disable this check.)" >&2
        exit 2
    fi
}

# #endregion


# #region Subcommand: validate-measure

cmd_validate_measure() {
    config_is_enabled "measure_metadata" || exit 0

    local tool_name
    tool_name="$(extract_tool_name)"
    [[ "$tool_name" == "Bash" ]] || exit 0

    local raw_command
    raw_command="$(extract_command)"
    [[ -n "$raw_command" ]] || exit 0

    local command_text
    command_text="$(resolve_command_text "$raw_command")"

    [[ "$command_text" == *".Measures.Add"* ]] || exit 0

    local lower missing=""
    lower="$(echo "$command_text" | tr '[:upper:]' '[:lower:]')"

    # Check DisplayFolder
    if ! echo "$command_text" | grep -qE '\.DisplayFolder[[:space:]]*=' 2>/dev/null; then
        missing="${missing}DisplayFolder, "
    fi

    # Check Description
    if ! echo "$command_text" | grep -qE '\.Description[[:space:]]*=' 2>/dev/null; then
        missing="${missing}Description, "
    fi

    # Check FormatString
    if ! echo "$command_text" | grep -qE '\.FormatString[[:space:]]*=' 2>/dev/null; then
        if [[ "$command_text" != *"FormatStringDefinition"* ]]; then
            missing="${missing}FormatString (or FormatStringDefinition), "
        fi
    fi

    if [[ -n "$missing" ]]; then
        missing="${missing%, }"
        echo "Measure is missing required metadata: ${missing}. Set these properties before calling .Measures.Add(). (Set measure_metadata: false in ${CONFIG_PATH} to disable this check.)" >&2
        exit 2
    fi
}

# #endregion


# #region Subcommand: refresh-cache

cmd_refresh_cache() {
    config_is_enabled "metadata_refresh" || exit 0

    local tool_name
    tool_name="$(extract_tool_name)"
    [[ "$tool_name" == "Bash" ]] || exit 0

    local command_text
    command_text="$(extract_command)"
    [[ -n "$command_text" ]] || exit 0

    # Detect trigger
    local is_connect=false is_modification=false
    [[ "$command_text" == *"Microsoft.AnalysisServices"* ]] && is_connect=true

    for pattern in SaveChanges .Measures.Add .Columns.Add .Tables.Add .Relationships.Add .Measures.Remove .Columns.Remove .Tables.Remove .Roles.Add .Hierarchies.Add RequestRefresh; do
        [[ "$command_text" == *"$pattern"* ]] && is_modification=true && break
    done

    $is_connect || $is_modification || exit 0

    # Resolve port
    local port=""
    if $is_connect; then
        port=$(echo "$command_text" | grep -oE 'localhost:[0-9]+' | head -1 | cut -d: -f2)
    fi

    if [[ -z "$port" && -f "$METADATA_PATH" ]]; then
        port=$(jq -r '.port // empty' "$METADATA_PATH" 2>/dev/null)
    fi

    [[ -n "$port" && "$port" =~ ^[0-9]+$ ]] || exit 0

    local snapshot_script="$HOOK_DIR/snapshot-model.ps1"
    local metadata_out="$PROJECT_DIR/tmp/model-metadata.json"

    run_powershell_script "$snapshot_script" "-Port $port" "-OutFile \"$(convert_to_exec_path "$metadata_out")\""

    rm -f "$COMPAT_MARKER_PATH" 2>/dev/null || true
}

# #endregion


# #region Subcommand: check-ri

cmd_check_ri() {
    config_is_enabled "referential_integrity" || exit 0

    local tool_name
    tool_name="$(extract_tool_name)"
    [[ "$tool_name" == "Bash" ]] || exit 0

    local command_text
    command_text="$(extract_command)"
    [[ -n "$command_text" ]] || exit 0

    # Only run for relationship or column changes
    local relevant=false
    for pattern in Relationship FromColumn ToColumn .Columns.Add .Columns.Remove; do
        [[ "$command_text" == *"$pattern"* ]] && relevant=true && break
    done
    $relevant || exit 0

    [[ -f "$METADATA_PATH" ]] || exit 0

    local port
    port=$(jq -r '.port // empty' "$METADATA_PATH" 2>/dev/null)
    [[ -n "$port" && "$port" =~ ^[0-9]+$ ]] || exit 0

    local ri_script="$HOOK_DIR/check-referential-integrity.ps1"
    local output
    output="$(run_powershell_script_capture "$ri_script" "-Port $port")"

    if echo "$output" | grep -qE 'UNMATCHED_MANY_SIDE|SILENT_EXCLUSION|ASSUME_RI_RISK'; then
        echo "Referential integrity issues detected:" >&2

        local current_header=""
        while IFS= read -r line; do
            if [[ "$line" == RI_VIOLATION* ]]; then
                current_header="$line"
            elif echo "$line" | grep -qE 'UNMATCHED_MANY_SIDE|SILENT_EXCLUSION|ASSUME_RI_RISK'; then
                if [[ -n "$current_header" ]]; then
                    echo "$current_header" >&2
                    current_header=""
                fi
                echo "$line" >&2
            elif [[ "$line" == *"UNMATCHED_ONE_SIDE"* ]]; then
                current_header=""
            fi
        done <<< "$output"

        echo "(Set referential_integrity: false in ${CONFIG_PATH} to disable this check.)" >&2
        exit 2
    fi
}

# #endregion


# #region Subcommand: check-compat

cmd_check_compat() {
    config_is_enabled "compatibility_check" || config_is_enabled "compatibility_auto_upgrade" || exit 0

    local tool_name
    tool_name="$(extract_tool_name)"
    [[ "$tool_name" == "Bash" ]] || exit 0

    [[ -f "$METADATA_PATH" ]] || exit 0

    local current_cl max_cl port
    current_cl=$(jq -r '.compatibilityLevel // 0' "$METADATA_PATH" 2>/dev/null)
    max_cl=$(jq -r '.maxCompatibilityLevel // 0' "$METADATA_PATH" 2>/dev/null)
    port=$(jq -r '.port // empty' "$METADATA_PATH" 2>/dev/null)

    [[ "$current_cl" -gt 0 ]] 2>/dev/null || exit 0

    # Ignore sentinel values
    if [[ "$max_cl" -le 0 || "$max_cl" -ge 100000 ]] 2>/dev/null; then
        max_cl=1702
    fi

    [[ "$current_cl" -lt "$max_cl" ]] 2>/dev/null || exit 0

    # Compatibility level feature table
    local -a CL_FEATURES=(
        "1450:Incremental refresh policies"
        "1455:Dual storage mode; Measure.DataCategory"
        "1460:Summarization types; AlternateOf sources"
        "1465:Enhanced metadata format; PowerBI_V3 data sources"
        "1470:Calculation groups and items"
        "1475:DataSourceVariablesOverrideBehavior"
        "1480:Query groups; Table.ExcludeFromModelRefresh"
        "1500:CalculationItem.Ordinal; query interleaving"
        "1520:SourceQueryCulture; field parameters"
        "1535:M expression attributes on Model and NamedExpression"
        "1540:LineageTag for objects"
        "1550:SourceLineageTag for object tracking"
        "1560:DiscourageCompositeModels property"
        "1561:SecurityFilteringBehavior.None"
        "1562:Auto aggregations; Table.SystemManaged"
        "1563:InferredPartitionSource; ParquetPartitionSource"
        "1564:AutomaticAggregationOptions"
        "1565:Hybrid tables (import + DirectQuery partitions)"
        "1566:DisableAutoExists for SUMMARIZECOLUMNS"
        "1567:ChangedProperties tracking"
        "1568:MaxParallelismPerRefresh"
        "1569:MaxParallelismPerQuery"
        "1570:NamedExpression remote parameter support"
        "1571:ObjectTranslation.Altered"
        "1572:Table.ExcludeFromAutomaticAggregations"
        "1601:FormatStringDefinition (dynamic format strings)"
        "1603:DataCoverageDefinition (partition hints)"
        "1604:DirectLake mode; EntityPartitionSource.SchemaName"
        "1605:Selection expressions for calculation items"
        "1606:ValueFilterBehavior; DataSourceVariablesOverrideBehavior"
        "1700:SQL Server 2025 parity"
        "1701:Custom calendars for time intelligence"
        "1702:DAX user-defined functions (UDFs)"
    )

    local has_missing=false
    local missing_output=""

    for entry in "${CL_FEATURES[@]}"; do
        local cl="${entry%%:*}"
        local feature="${entry#*:}"
        if [[ "$cl" -gt "$current_cl" && "$cl" -le "$max_cl" ]] 2>/dev/null; then
            has_missing=true
            missing_output="${missing_output}  CL ${cl}: ${feature}\n"
        fi
    done

    $has_missing || exit 0

    # Suppress repeat warnings for the same (current_cl, max_cl) until the cache is refreshed
    local marker_key="${current_cl}:${max_cl}"
    if [[ -f "$COMPAT_MARKER_PATH" ]]; then
        local prev_key
        prev_key="$(cat "$COMPAT_MARKER_PATH" 2>/dev/null)"
        [[ "$prev_key" == "$marker_key" ]] && exit 0
    fi
    mkdir -p "$(dirname "$COMPAT_MARKER_PATH")" 2>/dev/null || true
    printf '%s' "$marker_key" > "$COMPAT_MARKER_PATH" 2>/dev/null || true

    echo "Model compatibility level is ${current_cl} (engine supports up to ${max_cl}). Features available by upgrading:" >&2
    printf '%b' "$missing_output" >&2

    # Auto-upgrade if enabled
    if config_is_enabled "compatibility_auto_upgrade"; then
        local upgrade_script="\$basePath = \"\$env:TEMP\\tom_nuget\\Microsoft.AnalysisServices.retail.amd64\\lib\\net45\"; Add-Type -Path \"\$basePath\\Microsoft.AnalysisServices.Core.dll\"; Add-Type -Path \"\$basePath\\Microsoft.AnalysisServices.Tabular.dll\"; \$server = New-Object Microsoft.AnalysisServices.Tabular.Server; \$server.Connect(\"Data Source=localhost:${port}\"); \$server.Databases[0].CompatibilityLevel = ${max_cl}; \$server.Databases[0].Model.SaveChanges(); Write-Output \"Upgraded to CL ${max_cl}\"; \$server.Disconnect()"
        run_powershell_inline "$upgrade_script"
        echo "Compatibility level auto-upgraded from ${current_cl} to ${max_cl}." >&2
    else
        echo "Check Microsoft documentation for these features to see if any would benefit this model. To upgrade, set \$db.CompatibilityLevel = ${max_cl} via TOM and call \$model.SaveChanges(). There are no known downsides to upgrading; only benefits. However, it is irreversible; ask the user before proceeding." >&2
    fi

    echo "(Set compatibility_check: false in ${CONFIG_PATH} to disable. Set compatibility_auto_upgrade: true to auto-upgrade.)" >&2
    exit 2
}

# #endregion


# #region PowerShell execution

find_parallels_vm() {
    # Finds the first running Parallels VM name. Outputs nothing if unavailable.
    command -v prlctl &>/dev/null || return
    prlctl list --all 2>/dev/null | tail -n +2 | while IFS= read -r line; do
        if echo "$line" | grep -qi "running"; then
            echo "$line" | awk '{for(i=4;i<=NF;i++) printf "%s%s", $i, (i<NF?" ":""); print ""}'
            return
        fi
    done
}

convert_to_exec_path() {
    # Converts a macOS path to a Parallels UNC path or leaves as-is for Windows.
    local path="$1"
    if [[ "$path" == /Users/* ]]; then
        local remainder="${path#/Users/*/}"
        echo "\\\\Mac\\Home\\${remainder//\//\\}"
    else
        echo "$path"
    fi
}

run_powershell_inline() {
    local script="$1"
    local vm
    vm="$(find_parallels_vm)"

    if [[ -n "$vm" ]]; then
        prlctl exec "$vm" cmd.exe /c "powershell.exe -NoProfile -ExecutionPolicy Bypass -Command \"$script\"" 2>/dev/null || true
    elif command -v powershell.exe &>/dev/null; then
        powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$script" 2>/dev/null || true
    fi
}

run_powershell_script() {
    local script="$1"
    shift
    local exec_path
    exec_path="$(convert_to_exec_path "$script")"
    local vm
    vm="$(find_parallels_vm)"

    if [[ -n "$vm" ]]; then
        prlctl exec "$vm" cmd.exe /c "powershell.exe -NoProfile -ExecutionPolicy Bypass -File \"$exec_path\" $*" 2>/dev/null || true
    elif command -v powershell.exe &>/dev/null; then
        powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$exec_path" "$@" 2>/dev/null || true
    fi
}

run_powershell_script_capture() {
    local script="$1"
    shift
    local exec_path
    exec_path="$(convert_to_exec_path "$script")"
    local vm
    vm="$(find_parallels_vm)"

    if [[ -n "$vm" ]]; then
        prlctl exec "$vm" cmd.exe /c "powershell.exe -NoProfile -ExecutionPolicy Bypass -File \"$exec_path\" $*" 2>/dev/null || true
    elif command -v powershell.exe &>/dev/null; then
        powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$exec_path" "$@" 2>/dev/null || true
    fi
}

# #endregion


# #region Main

case "$SUBCOMMAND" in
    validate-dax)     cmd_validate_dax ;;
    validate-measure) cmd_validate_measure ;;
    refresh-cache)    cmd_refresh_cache ;;
    check-ri)         cmd_check_ri ;;
    check-compat)     cmd_check_compat ;;
    *)
        echo "Unknown subcommand: $SUBCOMMAND" >&2
        echo "Available: validate-dax, validate-measure, refresh-cache, check-ri, check-compat" >&2
        exit 1
        ;;
esac

# #endregion
