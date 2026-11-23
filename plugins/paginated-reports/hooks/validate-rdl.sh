#!/bin/bash
#
#
#
# Not wired to Bash: a PostToolUse hook cannot tell whether a Bash command wrote
#
#
# Toggle via config.yaml in this directory (rdl_validation: false, or
# all_hooks_enabled: false as a master kill-switch).
#
# Exit codes:
#   2 - Blocking: RDL validation error detected
#

SELF="${BASH_SOURCE[0]:-$0}"
HOOK_DIR="$(cd "${SELF%/*}" 2>/dev/null && pwd)" || exit 0
HOOK_CONFIG="$HOOK_DIR/config.yaml"

if [[ -f "$HOOK_CONFIG" ]]; then
    grep -qE "^all_hooks_enabled:[[:space:]]*false" "$HOOK_CONFIG" 2>/dev/null && exit 0
    grep -qE "^rdl_validation:[[:space:]]*false" "$HOOK_CONFIG" 2>/dev/null && exit 0
fi

VALIDATOR_PY="$HOOK_DIR/../skills/paginated-report/scripts/validate_rdl.py"
if [[ ! -f "$VALIDATOR_PY" ]]; then
    echo "paginated-reports: validator not found at $VALIDATOR_PY; .rdl validation skipped" >&2
    exit 0
fi

PYTHON=""
for cand in python3 python; do
    # Probe the interpreter: on Windows the Store alias stub exists on PATH but exits 9009
    if command -v "$cand" &>/dev/null && "$cand" -c 'import sys; sys.exit(0 if sys.version_info >= (3, 8) else 1)' &>/dev/null; then
        PYTHON="$cand"
        break
    fi
done
if [[ -z "$PYTHON" ]]; then
    echo "paginated-reports: python3 (3.8 or later) not found on PATH; .rdl validation skipped" >&2
    exit 0
fi

exec "$PYTHON" "$VALIDATOR_PY" --hook
