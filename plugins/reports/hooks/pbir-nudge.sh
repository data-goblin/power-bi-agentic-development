#!/usr/bin/env bash
INPUT=$(cat 2>/dev/null || true)
FILE=$(printf '%s' "$INPUT" | sed -n 's/.*"file_path"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -n 1)
FILE="${FILE//\\\\//}"
case "$FILE" in
    *.Report/definition/*.json | *.Report/StaticResources/*.json) ;;
    *) exit 0 ;;
esac
if ! command -v pbir >/dev/null 2>&1; then
    echo "reports: pbir is not installed, hand-edit nudge skipped (uv tool install pbir-cli)" >&2
    exit 0
fi
printf '%s\n' '{"hookSpecificOutput":{"hookEventName":"PreToolUse","additionalContext":"This file belongs to a PBIR report. pbir set, add, rm and the visuals and theme commands validate their own writes; prefer them to hand-editing JSON, and run pbir validate after any manual change."}}'
exit 0
