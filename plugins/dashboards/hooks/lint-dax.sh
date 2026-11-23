#!/usr/bin/env bash
# PostToolUse hook: lint a .dax file the agent just wrote with the querying-fabric lint script.
# Warn only: findings go to the model as context, nothing blocks. A missing interpreter is reported on stderr.
set -o pipefail

PYTHON=""
for cand in python3 python; do
    if command -v "$cand" >/dev/null 2>&1 && "$cand" -c 'import sys; sys.exit(0 if sys.version_info >= (3, 8) else 1)' >/dev/null 2>&1; then
        PYTHON="$cand"
        break
    fi
done

if [ -z "$PYTHON" ]; then
    echo "dashboards: python 3.8+ not found, DAX lint skipped (install Python to enable it)" >&2
    exit 0
fi

HOOK_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" 2>/dev/null && pwd)" || exit 0
SCRIPT="$HOOK_DIR/../skills/querying-fabric/scripts/lint_dax.py"
if [ ! -f "$SCRIPT" ]; then
    echo "dashboards: lint_dax.py not found at $SCRIPT, DAX lint skipped" >&2
    exit 0
fi

exec "$PYTHON" -I "$SCRIPT" --hook
