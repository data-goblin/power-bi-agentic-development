#!/bin/bash

INPUT=$(cat 2>/dev/null || printf '%s' '{}')
# shellcheck source=lib.sh
. "$(dirname "${BASH_SOURCE[0]:-$0}")/lib.sh" 2>/dev/null || exit 0
hooks_disabled && exit 0

OFF=""
command -v jq >/dev/null 2>&1   || OFF="$OFF
- jq missing: no PBIR or TMDL edit checks at all"
command -v pbir >/dev/null 2>&1 || OFF="$OFF
- pbir missing: PBIR edits get JSON, naming and required-field checks only (uv tool install pbir-cli)"
te_ready                        || OFF="$OFF
- te missing: TMDL edits are not validated (https://docs.tabulareditor.com/en/cli/)"

[[ -z "$OFF" ]] && exit 0
printf 'pbip plugin checks that are OFF in this session:%s\n' "$OFF"
exit 0
