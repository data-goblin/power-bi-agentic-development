#!/bin/bash
#
#

set -o pipefail
INPUT=$(cat 2>/dev/null || printf '%s' '{}')
# shellcheck source=lib.sh
. "$(dirname "${BASH_SOURCE[0]:-$0}")/lib.sh" 2>/dev/null || exit 0
hooks_disabled && exit 0
command -v jq >/dev/null 2>&1 || exit 0

FILE_PATH=$(edited_path) || exit 0
[[ "$(basename "$FILE_PATH")" == "definition.pbir" ]] || exit 0
[[ "$FILE_PATH" == *.Report/* ]] || exit 0
[[ -f "$FILE_PATH" ]] || exit 0

fail() {
    printf 'PBIR validation failed: %s\n\n%s\n\nSee the pbip skill (definition.pbir binding).\n' "$FILE_PATH" "$1" >&2
    exit 2
}

jq empty "$FILE_PATH" 2>/dev/null || exit 0
BYPATH=$(jq -r '.datasetReference.byPath.path // empty' "$FILE_PATH")
CONN=$(jq -r '.datasetReference.byConnection.connectionString // empty' "$FILE_PATH")
HAS_BYPATH=$(jq -r '(.datasetReference.byPath // null) | type' "$FILE_PATH")
HAS_BYCONN=$(jq -r '(.datasetReference.byConnection // null) | type' "$FILE_PATH")

if [[ "$HAS_BYPATH" != "object" && "$HAS_BYCONN" != "object" ]]; then
    fail "datasetReference needs exactly one of byPath or byConnection."
fi

if [[ "$HAS_BYPATH" == "object" ]]; then
    [[ -n "$BYPATH" ]] || fail "datasetReference.byPath.path is empty."
    if cfg_enabled bypath_exists; then
        TARGET="$(dirname "$FILE_PATH")/$BYPATH"
        [[ -d "$TARGET" ]] || fail "byPath points at $BYPATH, which does not exist relative to definition.pbir."
    fi
fi

if [[ "$HAS_BYCONN" == "object" ]]; then
    [[ -n "$CONN" ]] || fail "datasetReference.byConnection.connectionString is empty."
    if grep -qE '^fab_exists:[[:space:]]*true' "$HOOK_CONFIG" 2>/dev/null; then
        if ! command -v fab >/dev/null 2>&1; then
            note_once nofab "pbip hooks: fab_exists is on but fab is not installed; the byConnection model was not checked."
        else
            WS=""; MODEL=""
            [[ "$CONN" =~ myorg/\"?([^\";]*) ]] && WS="${BASH_REMATCH[1]}"
            [[ "$CONN" =~ initial\ catalog=\"?([^\";]*) ]] && MODEL="${BASH_REMATCH[1]}"
            if [[ -n "$WS" && -n "$MODEL" ]]; then
                R=$(run_limited 20 fab exists "$WS.Workspace/$MODEL.SemanticModel" 2>/dev/null) || R=""
                [[ "$R" == *"false"* ]] && warn "fab exists says $MODEL is missing in $WS, or your fab login cannot see it. Check: fab auth status"
            fi
        fi
    fi
fi
exit 0
