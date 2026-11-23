#!/bin/bash
#
#
#

set -o pipefail
INPUT=$(cat 2>/dev/null || printf '%s' '{}')
# shellcheck source=lib.sh
. "$(dirname "${BASH_SOURCE[0]:-$0}")/lib.sh" 2>/dev/null || exit 0
hooks_disabled && exit 0

if ! command -v jq >/dev/null 2>&1; then
    note_once nojq "pbip hooks: jq is not installed, so PBIR files are not checked after edits. Install jq or run pbir validate by hand."
    exit 0
fi

FILE_PATH=$(edited_path) || exit 0
case "$FILE_PATH" in *.json|*.pbir) ;; *) exit 0 ;; esac
[[ "$FILE_PATH" == *.Report/* ]] || exit 0
[[ -f "$FILE_PATH" ]] || exit 0

REPORT_ROOT="${FILE_PATH%%.Report/*}.Report"
REL="${FILE_PATH#*.Report/}"
BASENAME=$(basename "$FILE_PATH")
NAME_RULE='^[[:alnum:]_-]+$'
TIP="See the pbir-format skill; prefer pbir commands over hand-editing PBIR JSON."

fail() {
    printf 'PBIR validation failed: %s\n\n%s\n\n%s\n' "$FILE_PATH" "$1" "$TIP" >&2
    exit 2
}

if cfg_enabled json_syntax && ! ERR=$(jq empty "$FILE_PATH" 2>&1); then
    fail "Invalid JSON: $ERR"
fi

if cfg_enabled name_format; then
    case "$REL" in
        definition/pages/*|definition/bookmarks/*)
            IFS='/' read -r -a SEGS <<< "$REL"
            for i in 0 1 2 3 4; do
                SEG="${SEGS[$i]:-}"
                [[ -z "$SEG" ]] && continue
                case "$i" in
                    0|1|3) continue ;;
                esac
                [[ "$SEG" == *.* ]] && continue
                if [[ ! "$SEG" =~ $NAME_RULE ]] || [[ ${#SEG} -gt 50 ]]; then
                    fail "Folder name '$SEG' breaks the naming rule: letters, digits, underscore or hyphen, at most 50 characters. Desktop silently ignores the page or visual in a folder with any other name."
                fi
            done
            ;;
    esac
    case "$BASENAME" in
        visual.json|page.json)
            NAME=$(jq -r '.name // empty' "$FILE_PATH" 2>/dev/null)
            if [[ -n "$NAME" ]] && { [[ ! "$NAME" =~ $NAME_RULE ]] || [[ ${#NAME} -gt 50 ]]; }; then
                fail "The name '$NAME' breaks the naming rule: letters, digits, underscore or hyphen, at most 50 characters. Desktop silently ignores the object."
            fi
            ;;
    esac
fi

if cfg_enabled pbir_validate && command -v pbir >/dev/null 2>&1; then
    OUT=$(run_limited 25 pbir validate "$REPORT_ROOT" --json 2>/dev/null)
    RC=$?
    if [[ $RC -eq 1 ]]; then
        case "$BASENAME" in
            visual.json)
                PAGE_JSON="$(dirname "$(dirname "$(dirname "$FILE_PATH")")")/page.json"
                TAIL="$(jq -r '.name // empty' "$PAGE_JSON" 2>/dev/null)/$(jq -r '.name // empty' "$FILE_PATH" 2>/dev/null)/visual.json" ;;
            page.json)
                TAIL="$(jq -r '.name // empty' "$FILE_PATH" 2>/dev/null)/page.json" ;;
            *) TAIL="$BASENAME" ;;
        esac
        ERRS=$(printf '%s' "$OUT" | jq -r --arg t "$TAIL" '
            (.errors // [])[] | select((.location // "") == $t or (.location // "") == "") | "\(.code) \(.location): \(.message)"' 2>/dev/null | head -20)
        if [[ -n "$ERRS" ]]; then
            fail "pbir validate reports errors in this file:
$ERRS"
        elif ! printf '%s' "$OUT" | jq -e 'has("errors")' >/dev/null 2>&1; then
            note_once pbirshape "pbip hooks: this pbir version prints a validate report the hook cannot read, so this edit was not schema-checked. Upgrade pbir-cli."
        fi
    elif [[ $RC -ne 0 ]]; then
        note_once pbirfail "pbip hooks: pbir validate did not finish (exit $RC), so this edit was not schema-checked."
    fi
    exit 0
fi

if ! command -v pbir >/dev/null 2>&1; then
    note_once nopbir "pbip hooks: pbir is not installed, so PBIR edits get only the JSON, naming and required-field checks. Install it with: uv tool install pbir-cli"
fi

if cfg_enabled required_fields; then
    case "$BASENAME" in
        visual.json)     REQ='["$schema","name","position"]' ;;
        page.json)       REQ='["$schema","name","displayName","displayOption"]' ;;
        report.json)     REQ='["$schema","themeCollection"]' ;;
        definition.pbir) REQ='["$schema","version","datasetReference"]' ;;
        *) exit 0 ;;
    esac
    MISSING=$(jq -r --argjson req "$REQ" '. as $d | $req - ($d | keys) | join(", ")' "$FILE_PATH" 2>/dev/null)
    [[ -n "$MISSING" ]] && fail "Missing required properties: $MISSING"
    SCHEMA=$(jq -r '."$schema" // empty' "$FILE_PATH" 2>/dev/null)
    case "$BASENAME" in
        definition.pbir)
            [[ "$SCHEMA" =~ ^https://developer\.microsoft\.com/json-schemas/fabric/item/report/definitionProperties/[0-9]+\.[0-9]+\.[0-9]+/schema\.json$ ]] \
                || fail "Unexpected \$schema: $SCHEMA (expected .../report/definitionProperties/<version>/schema.json)" ;;
        *)
            [[ "$SCHEMA" =~ ^https://developer\.microsoft\.com/json-schemas/fabric/item/report/definition/ ]] \
                || fail "Unexpected \$schema: $SCHEMA (expected https://developer.microsoft.com/json-schemas/fabric/item/report/definition/...)" ;;
    esac
fi
exit 0
