#!/bin/bash

SELF="${BASH_SOURCE[0]:-$0}"
HOOK_DIR="$(cd "${SELF%/*}" 2>/dev/null && pwd)" || exit 0
HOOK_CONFIG="$HOOK_DIR/config.yaml"

if [[ -f "$HOOK_CONFIG" ]]; then
    grep -qE "^all_hooks_enabled:[[:space:]]*false" "$HOOK_CONFIG" 2>/dev/null && exit 0
fi

LINTER="$HOOK_DIR/lint_visuals.py"
if [[ ! -f "$LINTER" ]]; then
    echo "custom-visuals: $LINTER not found; visual lint skipped" >&2
    exit 0
fi

PYTHON=""
for cand in python3 python; do
    if command -v "$cand" &>/dev/null && "$cand" -c 'import sys; sys.exit(0 if sys.version_info >= (3, 8) else 1)' &>/dev/null; then
        PYTHON="$cand"
        break
    fi
done
if [[ -z "$PYTHON" ]]; then
    echo "custom-visuals: python3 (3.8 or later) not found on PATH; Deneb and SVG lint skipped" >&2
    exit 0
fi

exec "$PYTHON" "$LINTER" --hook
