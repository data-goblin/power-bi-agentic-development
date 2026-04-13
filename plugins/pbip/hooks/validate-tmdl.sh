#!/bin/bash
#
# PostToolUse hook: validate TMDL structural syntax
#
# Handles Write, Edit, and Bash tool use. Runs tmdl-validate binary on any
# .tmdl file inside a .SemanticModel/ or .Dataset/ directory.
#
# NOTE: This is a lightweight structural linter, not a full TMDL parser.
# It will be superseded by `te validate` when the Tabular Editor CLI ships.
#
# Requires: tmdl-validate binary. Lookup order:
#   1. $HOOK_DIR/bin/tmdl-validate-<platform>[.exe]  (bundled with the plugin)
#   2. $CLAUDE_PROJECT_DIR/tools/tmdl-validate/target/release/tmdl-validate[.exe]  (dev build)
#   3. tmdl-validate on PATH
# Silently skips if none are found.
#
# Checks can be toggled via config.yaml in the same directory as this script.
#
# Exit codes:
#   0 - OK or not applicable
#   2 - Blocking: TMDL validation error detected
#

set -uo pipefail

INPUT=$(cat)

# Skip if jq not available
command -v jq &>/dev/null || exit 0

# ── Config ──────────────────────────────────────────────────────────────────
HOOK_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)"
HOOK_CONFIG="$HOOK_DIR/config.yaml"

check_enabled() {
    local check_name="$1"
    [[ -f "$HOOK_CONFIG" ]] || return 0
    grep -qE "^${check_name}:\\s*false" "$HOOK_CONFIG" 2>/dev/null && return 1
    return 0
}

check_enabled tmdl_syntax || exit 0

TMDL_TIP="Tip: use the tmdl skill if you are modifying TMDL files directly."

# ── Find the tmdl-validate binary ───────────────────────────────────────────

# Detect OS/arch to pick the right bundled binary.
UNAME_S=$(uname -s 2>/dev/null || echo "")
UNAME_M=$(uname -m 2>/dev/null || echo "")
PLATFORM=""
BIN_EXT=""
case "$UNAME_S" in
    Darwin)
        case "$UNAME_M" in
            arm64|aarch64) PLATFORM="darwin-arm64" ;;
            x86_64)        PLATFORM="darwin-x64" ;;
        esac
        ;;
    Linux)
        case "$UNAME_M" in
            x86_64) PLATFORM="linux-x64" ;;
        esac
        ;;
    MINGW*|MSYS*|CYGWIN*|Windows_NT)
        PLATFORM="windows-x64"
        BIN_EXT=".exe"
        ;;
esac

VALIDATOR=""
# 1. Bundled binary in $HOOK_DIR/bin/
if [[ -n "$PLATFORM" ]]; then
    CANDIDATE="$HOOK_DIR/bin/tmdl-validate-${PLATFORM}${BIN_EXT}"
    [[ -x "$CANDIDATE" ]] && VALIDATOR="$CANDIDATE"
fi
# 2. Local dev build under $CLAUDE_PROJECT_DIR/tools/
if [[ -z "$VALIDATOR" && -n "${CLAUDE_PROJECT_DIR:-}" ]]; then
    for EXT in "" ".exe"; do
        CANDIDATE="${CLAUDE_PROJECT_DIR//\\//}/tools/tmdl-validate/target/release/tmdl-validate${EXT}"
        if [[ -x "$CANDIDATE" ]]; then
            VALIDATOR="$CANDIDATE"
            break
        fi
    done
fi
# 3. PATH
if [[ -z "$VALIDATOR" ]] && command -v tmdl-validate &>/dev/null; then
    VALIDATOR="tmdl-validate"
fi

# Skip silently if binary not available
[[ -z "$VALIDATOR" ]] && exit 0


# ── Validate a single TMDL file ────────────────────────────────────────────

validate_tmdl_file() {
    local FILE_PATH="$1"
    FILE_PATH="${FILE_PATH//\\//}"

    [[ "$FILE_PATH" == *.tmdl ]] || return 0

    # Must be inside a semantic model directory
    if [[ ! "$FILE_PATH" =~ \.SemanticModel/ ]] && \
       [[ ! "$FILE_PATH" =~ \.Dataset/ ]] && \
       [[ ! "$FILE_PATH" =~ /definition/ ]]; then
        return 0
    fi

    [[ -f "$FILE_PATH" ]] || return 0

    if ! ERROR=$("$VALIDATOR" "$FILE_PATH" 2>&1); then
        echo "TMDL validation failed: $FILE_PATH" >&2
        echo "" >&2
        echo "$ERROR" >&2
        echo "" >&2
        echo "Fix the TMDL structural errors before continuing." >&2
        echo "" >&2
        echo "$TMDL_TIP" >&2
        return 2
    fi

    return 0
}


# ── Extract file paths from tool input ──────────────────────────────────────

TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // empty' 2>/dev/null)

if [[ "$TOOL_NAME" == "Write" || "$TOOL_NAME" == "Edit" ]]; then
    FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty' 2>/dev/null)
    [[ -z "$FILE_PATH" ]] && exit 0
    validate_tmdl_file "$FILE_PATH"
    exit $?

elif [[ "$TOOL_NAME" == "Bash" ]]; then
    COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty' 2>/dev/null)
    [[ -z "$COMMAND" ]] && exit 0

    # Extract candidate .tmdl file paths
    CANDIDATES=()
    while IFS= read -r path; do
        [[ -n "$path" ]] && CANDIDATES+=("$path")
    done < <(echo "$COMMAND" | grep -oE '[^ "'\''><|;]+\.tmdl[^ "'\''><|;]*' 2>/dev/null)

    while IFS= read -r path; do
        [[ -n "$path" ]] && CANDIDATES+=("$path")
    done < <(echo "$COMMAND" | grep -oE '"[^"]+\.tmdl"' 2>/dev/null | tr -d '"')

    while IFS= read -r path; do
        [[ -n "$path" ]] && CANDIDATES+=("$path")
    done < <(echo "$COMMAND" | grep -oE "'[^']+\.tmdl'" 2>/dev/null | tr -d "'")

    [[ ${#CANDIDATES[@]} -eq 0 ]] && exit 0

    # Deduplicate
    DEDUPED=()
    while IFS= read -r path; do
        [[ -n "$path" ]] && DEDUPED+=("$path")
    done < <(printf '%s\n' "${CANDIDATES[@]}" | sort -u)

    # Validate each file; collect errors
    ERRORS=()
    for CANDIDATE in "${DEDUPED[@]}"; do
        if ! validate_tmdl_file "$CANDIDATE" 2>/tmp/tmdl_hook_err_$$; then
            ERRORS+=("$(cat /tmp/tmdl_hook_err_$$ 2>/dev/null)")
        fi
        rm -f /tmp/tmdl_hook_err_$$
    done

    if [[ ${#ERRORS[@]} -gt 0 ]]; then
        for err in "${ERRORS[@]}"; do
            echo "$err" >&2
        done
        exit 2
    fi
fi

exit 0
