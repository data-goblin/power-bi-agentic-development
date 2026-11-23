#!/bin/bash
#
# PostToolUse hook: validate the semantic model a .tmdl edit belongs to with `te validate`.
#
# Tabular Editor's parser is Microsoft's TOM TmdlSerializer plus a DAX analyzer, so it
# catches what a line linter cannot: bad indentation, "//" comments outside an expression,
# a blank line after "///", unknown properties, duplicate members, unresolved references,
# DAX syntax and unresolved columns.
#
# Blocks (exit 2) on a parse error. Reference errors and DAX errors are reported as
# advisory context, because a multi-file refactor is legitimately invalid half-way.
# Without `te` the hook says so once per session and lets the edit through.

set -o pipefail
INPUT=$(cat 2>/dev/null || printf '%s' '{}')
# shellcheck source=lib.sh
. "$(dirname "${BASH_SOURCE[0]:-$0}")/lib.sh" 2>/dev/null || exit 0
hooks_disabled && exit 0
cfg_enabled tmdl_validate || exit 0

command -v jq >/dev/null 2>&1 || { note_once nojq "pbip hooks: jq is not installed, so TMDL edits are not validated."; exit 0; }

FILE_PATH=$(edited_path) || exit 0
[[ "$FILE_PATH" == *.tmdl ]] || exit 0
[[ -f "$FILE_PATH" ]] || exit 0

if ! te_ready; then
    note_once note "pbip hooks: te (Tabular Editor CLI) is not installed, so TMDL edits are not validated. Install it from https://docs.tabulareditor.com/en/cli/ and the hook starts working; nothing is installed for you."
    exit 0
fi

DIR=$(dirname "$FILE_PATH")
ROOT=""
while [[ "$DIR" != "/" && "$DIR" != "." && -n "$DIR" ]]; do
    if [[ -f "$DIR/model.tmdl" || -f "$DIR/database.tmdl" ]]; then ROOT="$DIR"; break; fi
    NEXT=$(dirname "$DIR")
    [[ "$NEXT" == "$DIR" ]] && break
    DIR="$NEXT"
done
[[ -n "$ROOT" ]] || exit 0

OUT=$(run_limited 25 te validate --model "$ROOT" --errors-only --non-interactive 2>&1)
RC=$?
[[ $RC -eq 0 ]] && exit 0

if printf '%s' "$OUT" | grep -qE 'TmdlFormatException|TmdlSerializationException'; then
    printf 'TMDL validation failed (te validate --model "%s"):\n\n%s\n\nFix the TMDL before continuing. See the tmdl skill.\n' "$ROOT" "$(printf '%s' "$OUT" | head -25)" >&2
    exit 2
fi
if printf '%s' "$OUT" | grep -qE 'Exception|DAX[0-9]{4}|^Error'; then
    warn "te validate --model \"$ROOT\" reports problems; fix them before you finish, they may be mid-refactor:
$(printf '%s' "$OUT" | grep -v '^Validating' | head -20)"
    exit 0
fi
note_once tefail "pbip hooks: te validate exited $RC without a TMDL error, so this edit was not validated."
exit 0
