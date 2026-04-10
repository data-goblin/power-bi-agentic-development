#!/bin/bash
#
# daxlib.sh: CLI for browsing, downloading, and installing DAX library
# packages from daxlib.org into Power BI Desktop semantic models.
#
# Script-based replacement for the daxlib binary; requires bash 3.2+, jq,
# and either gh or curl for HTTP requests.
#
# Standalone operations (search, info, versions, functions, download)
# work without Power BI Desktop. Model operations (add, update, remove,
# installed) shell out to PowerShell for TOM/TmdlSerializer access.

set -euo pipefail


# #region Constants

GITHUB_RAW="https://raw.githubusercontent.com/daxlib/daxlib/main/packages"
GITHUB_API="https://api.github.com/repos/daxlib/daxlib"

# #endregion


# #region HTTP

http_get() {
    # Fetches a URL via gh CLI (authenticated, 5000 req/hr).
    # Falls back to curl if gh is unavailable.
    local url="$1"

    if command -v gh &>/dev/null; then
        if [[ "$url" == *"api.github.com"* ]]; then
            local path="${url#https://api.github.com}"
            gh api "$path" --cache 1h 2>/dev/null && return
        else
            gh api "$url" --cache 1h 2>/dev/null && return
        fi
    fi

    # Fallback to curl
    if command -v curl &>/dev/null; then
        curl -sSfL -H "User-Agent: daxlib-cli" "$url" 2>/dev/null && return
    fi

    echo "Error: neither gh nor curl available" >&2
    return 1
}

# #endregion


# #region Registry

semver_sort_key() {
    # Converts a semver string to a zero-padded sortable key.
    local v="${1%%-*}"
    local major minor patch
    IFS='.' read -r major minor patch <<< "$v"
    printf '%06d%06d%06d' "${major:-0}" "${minor:-0}" "${patch:-0}"
}

package_letter() {
    # Returns the first character of a package ID, lowercased.
    echo "${1:0:1}" | tr '[:upper:]' '[:lower:]'
}

resolve_latest_stable() {
    # Returns the highest non-prerelease version for a package.
    local id="$1"
    local versions
    versions="$(list_versions "$id")" || return 1

    # Filter stable (no hyphen)
    local stable
    stable=$(echo "$versions" | grep -v '-' || true)
    local candidates="${stable:-$versions}"

    if [[ -z "$candidates" ]]; then
        echo "No versions found for '${id}'" >&2
        return 1
    fi

    echo "$candidates" | head -1
}

list_versions() {
    # Lists all published versions for a package, newest first.
    local id="$1"
    local letter
    letter="$(package_letter "$id")"
    local url="${GITHUB_API}/contents/packages/${letter}/$(echo "$id" | tr '[:upper:]' '[:lower:]')"

    local body
    body="$(http_get "$url")" || { echo "Package '${id}' not found in daxlib registry" >&2; return 1; }

    echo "$body" | jq -r '.[] | select(.type == "dir") | .name' 2>/dev/null | while IFS= read -r v; do
        printf '%s %s\n' "$(semver_sort_key "$v")" "$v"
    done | sort -rn | awk '{print $2}'
}

fetch_manifest() {
    # Downloads and parses the manifest.daxlib JSON for a specific version.
    local id="$1" version="$2"
    local letter
    letter="$(package_letter "$id")"
    local url="${GITHUB_RAW}/${letter}/$(echo "$id" | tr '[:upper:]' '[:lower:]')/${version}/manifest.daxlib"
    http_get "$url"
}

fetch_functions_tmdl() {
    # Downloads the functions.tmdl file for a specific package version.
    local id="$1" version="$2"
    local letter
    letter="$(package_letter "$id")"
    local url="${GITHUB_RAW}/${letter}/$(echo "$id" | tr '[:upper:]' '[:lower:]')/${version}/lib/functions.tmdl"
    http_get "$url"
}

search_packages() {
    # Searches for packages matching a query string by fetching the repo tree.
    local query="$1"
    local query_lower
    query_lower="$(echo "$query" | tr '[:upper:]' '[:lower:]')"

    local url="${GITHUB_API}/git/trees/main?recursive=1"
    local body
    body="$(http_get "$url")" || { echo "Failed to fetch repository tree" >&2; return 1; }

    echo "$body" | jq -r '.tree[].path' 2>/dev/null | \
        grep '/manifest\.daxlib$' | \
        while IFS= read -r path; do
            # packages/{letter}/{id}/{ver}/manifest.daxlib
            local parts
            IFS='/' read -ra parts <<< "$path"
            [[ ${#parts[@]} -eq 5 && "${parts[0]}" == "packages" ]] || continue
            local pkg_id="${parts[2]}"
            local pkg_lower
            pkg_lower="$(echo "$pkg_id" | tr '[:upper:]' '[:lower:]')"
            if [[ "$pkg_lower" == *"$query_lower"* ]]; then
                echo "$pkg_id"
            fi
        done | sort -u
}

# #endregion


# #region TMDL Parser

parse_function_names() {
    # Extracts function names from a functions.tmdl file.
    # Handles both quoted ('Package.Name') and unquoted (Name) formats.
    local tmdl="$1"
    echo "$tmdl" | grep -E "^function " | while IFS= read -r line; do
        if [[ "$line" == *"'"* ]]; then
            echo "$line" | sed "s/^function '\\([^']*\\)'.*/\\1/"
        else
            echo "$line" | sed 's/^function \([^ =]*\).*/\1/'
        fi
    done
}

extract_function_block() {
    # Extracts a complete function block (with doc comments) from TMDL.
    # Outputs from the first preceding /// line through to the next function or EOF.
    local tmdl="$1" name="$2"
    local name_lower
    name_lower="$(echo "$name" | tr '[:upper:]' '[:lower:]')"

    local in_doc=false in_func=false matched=false
    local doc_buffer=""

    echo "$tmdl" | while IFS= read -r line; do
        local trimmed
        trimmed="$(echo "$line" | sed 's/^[[:space:]]*//')"

        # Doc comment line
        if [[ "$trimmed" == "///"* ]] && ! $in_func; then
            if ! $in_doc; then
                # Start new doc buffer; flush any pending output
                doc_buffer=""
                in_doc=true
            fi
            doc_buffer="${doc_buffer}${line}
"
            continue
        fi

        # Function declaration at root level
        if [[ "$trimmed" == "function "* ]] && [[ "$line" != $'\t'* ]]; then
            # End previous function if we were in one
            if $matched; then
                # We've hit the next function; stop
                break
            fi

            in_doc=false
            in_func=true

            # Check if this is the target function
            local func_name
            if [[ "$trimmed" == *"'"* ]]; then
                func_name=$(echo "$trimmed" | sed "s/^function '\\([^']*\\)'.*/\\1/")
            else
                func_name=$(echo "$trimmed" | sed 's/^function \([^ =]*\).*/\1/')
            fi

            local func_lower
            func_lower="$(echo "$func_name" | tr '[:upper:]' '[:lower:]')"

            if [[ "$func_lower" == "$name_lower" ]] || [[ "$func_lower" == *".${name_lower}" ]]; then
                matched=true
                # Output doc buffer and this line
                if [[ -n "$doc_buffer" ]]; then
                    printf '%s' "$doc_buffer"
                fi
                echo "$line"
            fi
            doc_buffer=""
            continue
        fi

        if $matched && $in_func; then
            echo "$line"
        fi

        if ! $in_func; then
            doc_buffer=""
            in_doc=false
        fi
    done
}

extract_params_signature() {
    # Extracts a compact parameter signature from a function block.
    local block="$1"
    local in_params=false
    local params=""

    while IFS= read -r line; do
        local trimmed
        trimmed="$(echo "$line" | sed 's/^[[:space:]]*//')"

        if [[ "$trimmed" == "(" || "$trimmed" == *"(" ]]; then
            in_params=true
            continue
        fi

        if $in_params; then
            if [[ "$trimmed" == ")"* ]]; then
                break
            fi
            [[ "$trimmed" == "//"* ]] && continue

            # Clean: remove trailing comma, inline comments
            local clean
            clean=$(echo "$trimmed" | sed 's|//.*||' | sed 's/,[[:space:]]*$//' | sed 's/[[:space:]]*$//')
            if [[ -n "$clean" ]]; then
                if [[ -n "$params" ]]; then
                    params="${params}, ${clean}"
                else
                    params="$clean"
                fi
            fi
        fi
    done <<< "$block"

    echo "(${params})"
}

filter_functions_tmdl() {
    # Filters a functions.tmdl to include only the specified functions.
    local tmdl="$1"
    shift
    local output=""

    for name in "$@"; do
        local block
        block="$(extract_function_block "$tmdl" "$name")"
        if [[ -n "$block" ]]; then
            if [[ -n "$output" ]]; then
                output="${output}

${block}"
            else
                output="$block"
            fi
        fi
    done

    echo "$output"
}

# #endregion


# #region daxlib-tom Helper

find_daxlib_tom() {
    # Locates the daxlib-tom .csproj project directory.
    # Search order: sibling scripts/daxlib-tom/, DAXLIB_TOM_DIR env var.
    local script_dir
    script_dir="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)"

    # Skill layout: connect-pbid/daxlib.sh -> connect-pbid/scripts/daxlib-tom/
    local candidate="$script_dir/scripts/daxlib-tom"
    if [[ -f "$candidate/daxlib-tom.csproj" ]]; then
        echo "$candidate"
        return
    fi

    # Walk up
    local dir="$script_dir"
    for _ in 1 2 3 4; do
        dir="$(dirname "$dir")"
        candidate="$dir/scripts/daxlib-tom"
        if [[ -f "$candidate/daxlib-tom.csproj" ]]; then
            echo "$candidate"
            return
        fi
        candidate="$dir/daxlib-tom"
        if [[ -f "$candidate/daxlib-tom.csproj" ]]; then
            echo "$candidate"
            return
        fi
    done

    # Env var
    if [[ -n "${DAXLIB_TOM_DIR:-}" && -f "$DAXLIB_TOM_DIR/daxlib-tom.csproj" ]]; then
        echo "$DAXLIB_TOM_DIR"
        return
    fi

    return 1
}

detect_parallels_vm() {
    # Finds the first running Parallels VM name.
    if [[ -n "${DAXLIB_VM:-}" ]]; then
        echo "$DAXLIB_VM"
        return
    fi

    command -v prlctl &>/dev/null || return 1

    local json
    json="$(prlctl list --all -j 2>/dev/null)" || return 1
    echo "$json" | jq -r '.[] | select(.status == "running") | .name' 2>/dev/null | head -1
}

macos_to_unc() {
    # Converts a macOS path to a Parallels shared folder UNC path.
    local path="$1"
    local home="${HOME:-/Users/unknown}"

    if [[ "$path" == "$home"* ]]; then
        local relative="${path#$home}"
        echo "\\\\Mac\\Home${relative//\//\\}"
    else
        echo "Path '${path}' is outside \$HOME and cannot be mapped to a Parallels shared folder." >&2
        echo "Move the file under your home directory or set DAXLIB_TOM_DIR." >&2
        exit 1
    fi
}

escape_cmd_arg() {
    # Escapes cmd.exe metacharacters.
    local s="$1"
    s="${s//\"/\\\"}"
    s="${s//&/^&}"
    s="${s//|/^|}"
    s="${s//</^<}"
    s="${s//>/^>}"
    echo "$s"
}

run_daxlib_tom() {
    # Runs daxlib-tom via dotnet run. On macOS, wraps in prlctl exec.
    local project_dir
    project_dir="$(find_daxlib_tom)" || {
        echo "Cannot find daxlib-tom project." >&2
        echo "Set DAXLIB_TOM_DIR to the project directory." >&2
        return 1
    }

    case "$(uname -s)" in
        MINGW*|MSYS*|CYGWIN*|Windows_NT)
            dotnet run --project "$project_dir" -c Release -- "$@"
            ;;
        *)
            local vm
            vm="$(detect_parallels_vm)" || {
                echo "No running Parallels VM found." >&2
                echo "Set DAXLIB_VM to the VM name." >&2
                return 1
            }

            local unc_project
            unc_project="$(macos_to_unc "$project_dir")"

            # Convert any macOS paths in args to UNC
            local converted_args=""
            for arg in "$@"; do
                if [[ "$arg" == /* && ( "$arg" == *.tmdl || "$arg" == */daxlib* ) ]]; then
                    arg="$(macos_to_unc "$arg")"
                fi
                converted_args="${converted_args} \"$(escape_cmd_arg "$arg")\""
            done

            local dotnet_cmd="dotnet run --project \"$(escape_cmd_arg "$unc_project")\" -c Release --${converted_args}"
            prlctl exec "$vm" cmd.exe /c "$dotnet_cmd"
            ;;
    esac
}

# #endregion


# #region Commands

cmd_search() {
    # Searches the daxlib registry for packages matching the query.
    local query="${1:-}"
    if [[ -z "$query" ]]; then
        echo "Usage: daxlib search <query>" >&2
        exit 1
    fi

    echo "Searching for '${query}'..." >&2

    local packages
    packages="$(search_packages "$query")" || exit 1

    if [[ -z "$packages" ]]; then
        echo "No packages found matching '${query}'"
        exit 0
    fi

    local count
    count=$(echo "$packages" | wc -l | tr -d ' ')
    echo "${count} package(s) found:"
    echo

    while IFS= read -r pkg; do
        local versions ver manifest desc tags
        versions="$(list_versions "$pkg" 2>/dev/null)" || { echo "  ${pkg}"; continue; }
        ver="$(echo "$versions" | head -1)"
        manifest="$(fetch_manifest "$pkg" "$ver" 2>/dev/null)" || { echo "  ${pkg}"; continue; }

        desc=$(echo "$manifest" | jq -r '.description // ""' 2>/dev/null)
        tags=$(echo "$manifest" | jq -r '.tags // ""' 2>/dev/null)

        echo "  ${pkg}  v${ver}"
        [[ -n "$desc" ]] && echo "    ${desc}"
        [[ -n "$tags" ]] && echo "    tags: ${tags}"
        echo
    done <<< "$packages"
}

cmd_info() {
    # Shows detailed information about a package.
    local id="${1:-}"
    if [[ -z "$id" ]]; then
        echo "Usage: daxlib info <package-id> [--version <ver>]" >&2
        exit 1
    fi

    local version="${OPT_VERSION:-}"
    if [[ -z "$version" ]]; then
        version="$(resolve_latest_stable "$id")" || exit 1
    fi

    local manifest
    manifest="$(fetch_manifest "$id" "$version")" || exit 1

    local field
    field() { echo "$manifest" | jq -r ".${1} // \"-\"" 2>/dev/null; }

    echo "Package:     $(field id)"
    echo "Version:     $(field version)"
    echo "Authors:     $(field authors)"
    echo "Description: $(field description)"
    echo "Tags:        $(field tags)"

    local proj_url repo_url notes
    proj_url=$(echo "$manifest" | jq -r '.projectUrl // empty' 2>/dev/null)
    repo_url=$(echo "$manifest" | jq -r '.repositoryUrl // empty' 2>/dev/null)
    notes=$(echo "$manifest" | jq -r '.releaseNotes // empty' 2>/dev/null)

    [[ -n "$proj_url" ]] && echo "Project:     ${proj_url}"
    [[ -n "$repo_url" ]] && echo "Repository:  ${repo_url}"
    [[ -n "$notes" ]] && echo "Notes:       ${notes}"

    # Show function count
    local tmdl
    tmdl="$(fetch_functions_tmdl "$id" "$version" 2>/dev/null)" || return
    local fn_count
    fn_count=$(echo "$tmdl" | grep -cE '^function ' || true)
    echo
    echo "Functions:   ${fn_count}"
}

cmd_versions() {
    # Lists all published versions for a package.
    local id="${1:-}"
    if [[ -z "$id" ]]; then
        echo "Usage: daxlib versions <package-id>" >&2
        exit 1
    fi

    local versions
    versions="$(list_versions "$id")" || exit 1

    echo "Versions for ${id}:"
    while IFS= read -r v; do
        local pre=""
        [[ "$v" == *-* ]] && pre=" (pre)"
        echo "  ${v}${pre}"
    done <<< "$versions"
}

cmd_functions() {
    # Lists all functions in a package with their parameter signatures.
    local id="${1:-}"
    if [[ -z "$id" ]]; then
        echo "Usage: daxlib functions <package-id> [--version <ver>]" >&2
        exit 1
    fi

    local version="${OPT_VERSION:-}"
    if [[ -z "$version" ]]; then
        version="$(resolve_latest_stable "$id")" || exit 1
    fi

    echo "Fetching ${id} v${version}..." >&2

    local tmdl
    tmdl="$(fetch_functions_tmdl "$id" "$version")" || exit 1

    local names
    names="$(parse_function_names "$tmdl")"
    local fn_count
    fn_count=$(echo "$names" | grep -c '.' || true)

    echo "${id} v${version} -- ${fn_count} function(s):"
    echo

    while IFS= read -r name; do
        [[ -n "$name" ]] || continue
        local block sig doc_first

        block="$(extract_function_block "$tmdl" "$name")"
        sig="$(extract_params_signature "$block")"

        # First line of doc comment
        doc_first=$(echo "$block" | grep -m1 '///' | sed 's/^[[:space:]]*\/\/\/ *//' || true)

        echo "  ${name}${sig}"
        [[ -n "$doc_first" ]] && echo "    ${doc_first}"
        echo
    done <<< "$names"
}

cmd_download() {
    # Downloads functions.tmdl for a package, optionally filtered.
    local id="${1:-}"
    if [[ -z "$id" ]]; then
        echo "Usage: daxlib download <package-id> [--version <ver>] [--fn name[,name]] [--output <dir>]" >&2
        exit 1
    fi

    local version="${OPT_VERSION:-}"
    if [[ -z "$version" ]]; then
        version="$(resolve_latest_stable "$id")" || exit 1
    fi

    echo "Downloading ${id} v${version}..." >&2

    local tmdl
    tmdl="$(fetch_functions_tmdl "$id" "$version")" || exit 1

    local output_content="$tmdl"
    if [[ ${#OPT_FUNCTIONS[@]} -gt 0 ]]; then
        output_content="$(filter_functions_tmdl "$tmdl" "${OPT_FUNCTIONS[@]}")"
        if [[ -z "$output_content" ]]; then
            echo "No matching functions found. Available:" >&2
            parse_function_names "$tmdl" | while IFS= read -r n; do
                echo "  $n" >&2
            done
            exit 1
        fi
    fi

    local out_dir="${OPT_OUTPUT:-.}"
    local filename
    filename="$(echo "$id" | tr '[:upper:]' '[:lower:]').functions.tmdl"
    local out_path="${out_dir}/${filename}"

    echo "$output_content" > "$out_path"

    local fn_count
    fn_count=$(echo "$output_content" | grep -cE '^function ' || true)
    echo "Wrote ${filename} (${fn_count} functions) to ${out_path}"
}

cmd_add() {
    # Installs a daxlib package into a PBI Desktop model.
    local id="${1:-}"
    if [[ -z "$id" ]]; then
        echo "Usage: daxlib add <package-id> --port <port> [--version <ver>] [--fn name[,name]]" >&2
        exit 1
    fi

    if [[ -z "${OPT_PORT:-}" ]]; then
        echo "--port is required for add" >&2
        exit 1
    fi

    local version="${OPT_VERSION:-}"
    if [[ -z "$version" ]]; then
        version="$(resolve_latest_stable "$id")" || exit 1
    fi

    echo "Downloading ${id} v${version}..." >&2

    local tmdl
    tmdl="$(fetch_functions_tmdl "$id" "$version")" || exit 1

    local install_tmdl="$tmdl"
    if [[ ${#OPT_FUNCTIONS[@]} -gt 0 ]]; then
        install_tmdl="$(filter_functions_tmdl "$tmdl" "${OPT_FUNCTIONS[@]}")"
        if [[ -z "$install_tmdl" ]]; then
            echo "No matching functions found." >&2
            exit 1
        fi
    fi

    local temp
    temp="$(write_temp_tmdl "$install_tmdl")"
    trap "rm -f '$temp'" EXIT

    local tom_args=("add" "$OPT_PORT" "$temp")
    if [[ ${#OPT_FUNCTIONS[@]} -gt 0 ]]; then
        local fn_arg
        fn_arg="$(IFS=,; echo "${OPT_FUNCTIONS[*]}")"
        tom_args+=("--fn" "$fn_arg")
    fi

    run_daxlib_tom "${tom_args[@]}"
}

cmd_update() {
    # Updates an installed daxlib package to a new version.
    local id="${1:-}"
    if [[ -z "$id" ]]; then
        echo "Usage: daxlib update <package-id> --port <port> [--version <ver>]" >&2
        exit 1
    fi

    if [[ -z "${OPT_PORT:-}" ]]; then
        echo "--port is required for update" >&2
        exit 1
    fi

    local version="${OPT_VERSION:-}"
    if [[ -z "$version" ]]; then
        version="$(resolve_latest_stable "$id")" || exit 1
    fi

    echo "Updating ${id} to v${version}..." >&2

    local tmdl
    tmdl="$(fetch_functions_tmdl "$id" "$version")" || exit 1

    local temp
    temp="$(write_temp_tmdl "$tmdl")"
    trap "rm -f '$temp'" EXIT

    run_daxlib_tom "update" "$OPT_PORT" "$id" "$temp"
}

cmd_remove() {
    # Removes a daxlib package from a PBI Desktop model.
    local id="${1:-}"
    if [[ -z "$id" ]]; then
        echo "Usage: daxlib remove <package-id> --port <port> [--fn name[,name]]" >&2
        exit 1
    fi

    if [[ -z "${OPT_PORT:-}" ]]; then
        echo "--port is required for remove" >&2
        exit 1
    fi

    local tom_args=("remove" "$OPT_PORT" "$id")
    if [[ ${#OPT_FUNCTIONS[@]} -gt 0 ]]; then
        local fn_arg
        fn_arg="$(IFS=,; echo "${OPT_FUNCTIONS[*]}")"
        tom_args+=("--fn" "$fn_arg")
    fi

    run_daxlib_tom "${tom_args[@]}"
}

cmd_installed() {
    # Lists all installed daxlib packages in a PBI Desktop model.
    if [[ -z "${OPT_PORT:-}" ]]; then
        echo "--port is required for installed" >&2
        exit 1
    fi

    run_daxlib_tom "installed" "$OPT_PORT"
}

# #endregion


# #region Temp file helper

write_temp_tmdl() {
    # Writes TMDL content to a temp file. On macOS, uses home directory
    # (shared with Parallels VM) instead of /tmp/ (not shared).
    local tmdl="$1"
    local temp_dir

    case "$(uname -s)" in
        Darwin) temp_dir="$HOME/.daxlib-tmp" ;;
        *)      temp_dir="${TMPDIR:-/tmp}" ;;
    esac

    mkdir -p "$temp_dir"
    local temp_path="${temp_dir}/daxlib_$$.tmdl"
    echo "$tmdl" > "$temp_path"
    echo "$temp_path"
}

# #endregion


# #region Arg Parsing

print_usage() {
    cat >&2 <<'USAGE'
daxlib 0.1.0
CLI for DAX library packages from daxlib.org

USAGE:
  daxlib <command> [options]

COMMANDS (standalone):
  search <query>              Search packages by name
  info <package>              Show package details
  versions <package>          List available versions
  functions <package>         List functions with signatures
  download <package>          Download functions.tmdl

COMMANDS (require PBI Desktop):
  add <package> --port <p>    Install package into model
  update <package> --port <p> Update package in model
  remove <package> --port <p> Remove package from model
  installed --port <p>        List installed packages

OPTIONS:
  --port, -p <port>           PBI Desktop AS port
  --version, -v <ver>         Package version (default: latest stable)
  --fn, -f <name[,name]>      Specific function(s) to add/remove/download
  --output, -o <dir>          Output directory for download
  --json                      JSON output (where supported)

EXAMPLES:
  daxlib search svg
  daxlib info DaxLib.SVG
  daxlib functions PowerofBI.IBCS
  daxlib download DaxLib.SVG --fn "DaxLib.SVG.Element.Rect,DaxLib.SVG.SVG"
  daxlib add DaxLib.SVG --port 54321
  daxlib add DaxLib.SVG --port 54321 --fn "DaxLib.SVG.Element.Rect"
  daxlib update PowerofBI.IBCS --port 54321 --version 0.11.0
  daxlib remove DaxLib.SVG --port 54321 --fn "DaxLib.SVG.Color.Theme"
  daxlib installed --port 54321
USAGE
}

# Global option variables
OPT_PORT=""
OPT_VERSION=""
OPT_OUTPUT=""
OPT_JSON=false
OPT_FUNCTIONS=()

parse_args() {
    if [[ $# -eq 0 ]]; then
        print_usage
        exit 1
    fi

    COMMAND="$1"
    shift

    local positional=()

    while [[ $# -gt 0 ]]; do
        case "$1" in
            --port|-p)
                shift
                OPT_PORT="${1:-}"
                [[ -n "$OPT_PORT" && "$OPT_PORT" =~ ^[0-9]+$ ]] || { echo "--port requires a number" >&2; exit 1; }
                ;;
            --version|-v)
                shift
                OPT_VERSION="${1:-}"
                ;;
            --fn|-f)
                shift
                IFS=',' read -ra OPT_FUNCTIONS <<< "${1:-}"
                ;;
            --output|-o)
                shift
                OPT_OUTPUT="${1:-}"
                ;;
            --json)
                OPT_JSON=true
                ;;
            --help|-h)
                print_usage
                exit 0
                ;;
            -*)
                echo "Unknown flag: $1" >&2
                exit 1
                ;;
            *)
                positional+=("$1")
                ;;
        esac
        shift
    done

    POSITIONAL=("${positional[@]}")
}

# #endregion


# #region Main

COMMAND=""
POSITIONAL=()

parse_args "$@"

case "$COMMAND" in
    search)    cmd_search "${POSITIONAL[0]:-}" ;;
    info)      cmd_info "${POSITIONAL[0]:-}" ;;
    versions)  cmd_versions "${POSITIONAL[0]:-}" ;;
    functions) cmd_functions "${POSITIONAL[0]:-}" ;;
    download)  cmd_download "${POSITIONAL[0]:-}" ;;
    add)       cmd_add "${POSITIONAL[0]:-}" ;;
    update)    cmd_update "${POSITIONAL[0]:-}" ;;
    remove)    cmd_remove "${POSITIONAL[0]:-}" ;;
    installed) cmd_installed ;;
    *)
        echo "Unknown command: ${COMMAND}" >&2
        echo >&2
        print_usage
        exit 1
        ;;
esac

# #endregion
