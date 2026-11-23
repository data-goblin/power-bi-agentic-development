#!/bin/bash
#
# PostToolUse hook: lint Deneb spec files (*.vl.json, *.vega.json) and DAX SVG
# measures (*.dax) after Write or Edit by running lint_visuals.py in --hook mode.
#
# Errors exit 2 with the findings on stderr; warnings come back as
# additionalContext. Needs python3 (3.8 or later) or python. When it is missing
# the hook prints one line to stderr and lets the edit through; it never blocks
# on its own failure. No jq is required.
#
# Toggle via config.yaml in this directory (deneb_spec_lint: false,
# svg_measure_lint: false, or all_hooks_enabled: false).

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
