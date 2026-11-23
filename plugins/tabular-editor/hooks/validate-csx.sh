#!/bin/bash
#
# PostToolUse hook: compile a .csx or .cs script after the agent writes it, with `te script --validate`.
#
# Advisory only. TE3 Desktop scripts use WinForms and Selected, which do not compile under `te script`
# by design, so a failure is reported to the model as context and never blocks the edit.
# Without `te` the hook says so once per session and does nothing.

set -o pipefail
INPUT=$(cat 2>/dev/null || printf '%s' '{}')
# shellcheck source=lib.sh
. "$(dirname "${BASH_SOURCE[0]:-$0}")/lib.sh" 2>/dev/null || exit 0
hooks_disabled && exit 0
cfg_enabled csx_validate || exit 0

command -v jq >/dev/null 2>&1 || { note_once nojq "tabular-editor hooks: jq is not installed, so C# scripts are not compiled after edits."; exit 0; }

FILE_PATH=$(edited_path) || exit 0
case "$FILE_PATH" in *.csx|*.cs) ;; *) exit 0 ;; esac
[[ -f "$FILE_PATH" ]] || exit 0

if ! te_ready; then
    note_once note "tabular-editor hooks: te (Tabular Editor CLI) is not installed, so C# scripts are not compiled after edits. Install it from https://docs.tabulareditor.com/en/cli/; nothing is installed for you."
    exit 0
fi

OUT=$(run_limited 25 te script --validate --file "$FILE_PATH" --non-interactive 2>&1)
RC=$?
[[ $RC -eq 0 ]] && exit 0
warn "te script --validate --file \"$FILE_PATH\" failed. If the script targets the TE3 desktop app (WinForms, Selected, dialogs) this is expected; otherwise fix it:
$(printf '%s' "$OUT" | head -15)"
exit 0
