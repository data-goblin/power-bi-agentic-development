#!/bin/bash
#
# PostToolUse hook: validate paginated report (.rdl) structure.
#
# Handles Write and Edit tool use. Runs the bundled validate_rdl.py on the .rdl
# the tool wrote and blocks on structural errors (element order, name collisions,
# tablix count invariants, dataset/datasource references, embedded-image
# references, dimension units). It does not check expressions or live field
# references; those surface at render time.
#
# Not wired to Bash: a PostToolUse hook cannot tell whether a Bash command wrote
# or merely read a .rdl, so blocking on Bash would hard-stop reads/cleanup
# (cat/grep/rm) and the skill's own validate command on a not-yet-fixed file.
# Validate a Bash-created .rdl by running validate_rdl.py directly (the workflow
# already does this at the validate step).
#
# Requires: python3 (or python) and jq. Silently skips if either is missing or
# the bundled validator cannot be found.
#
# Toggle via config.yaml in this directory (rdl_validation: false, or
# all_hooks_enabled: false as a master kill-switch).
#
# Exit codes:
#   0 - OK or not applicable
#   2 - Blocking: RDL validation error detected
#

set -o pipefail

INPUT=$(cat 2>/dev/null || printf '%s' '{}')

command -v jq &>/dev/null || exit 0

# ── Config ──────────────────────────────────────────────────────────────────
HOOK_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" 2>/dev/null && pwd)" || exit 0
HOOK_CONFIG="$HOOK_DIR/config.yaml"

check_enabled() {
    local check_name="$1"
    [[ -f "$HOOK_CONFIG" ]] || return 0
    grep -qE "^${check_name}:[[:space:]]*false" "$HOOK_CONFIG" 2>/dev/null && return 1
    return 0
}

if [[ -f "$HOOK_CONFIG" ]] && grep -qE "^all_hooks_enabled:[[:space:]]*false" "$HOOK_CONFIG" 2>/dev/null; then
    exit 0
fi

check_enabled rdl_validation || exit 0

RDL_TIP="Tip: use the paginated-report skill when authoring or editing .rdl files."

# ── Locate python and the bundled validator ──────────────────────────────────
PYTHON=""
for cand in python3 python; do
    if command -v "$cand" &>/dev/null; then PYTHON="$cand"; break; fi
done
[[ -z "$PYTHON" ]] && exit 0

VALIDATOR_PY="$HOOK_DIR/../skills/paginated-report/scripts/validate_rdl.py"
[[ -f "$VALIDATOR_PY" ]] || exit 0

# ── Validate a single .rdl file ──────────────────────────────────────────────
validate_rdl_file() {
    local FILE_PATH="$1"
    FILE_PATH="${FILE_PATH//\\//}"

    [[ "$FILE_PATH" == *.rdl ]] || return 0
    [[ -f "$FILE_PATH" ]] || return 0

    if ! OUTPUT=$("$PYTHON" "$VALIDATOR_PY" "$FILE_PATH" 2>&1); then
        echo "RDL validation failed: $FILE_PATH" >&2
        echo "" >&2
        echo "$OUTPUT" >&2
        echo "" >&2
        echo "Fix the structural errors before continuing." >&2
        echo "" >&2
        echo "$RDL_TIP" >&2
        return 2
    fi

    return 0
}

# ── Dispatch on tool type ─────────────────────────────────────────────────────
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // empty' 2>/dev/null)

if [[ "$TOOL_NAME" == "Write" || "$TOOL_NAME" == "Edit" ]]; then
    FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty' 2>/dev/null)
    [[ -z "$FILE_PATH" ]] && exit 0
    validate_rdl_file "$FILE_PATH"
    exit $?
fi

exit 0
