#!/usr/bin/env bash
# Publish a paginated report (.rdl) to a Power BI / Fabric workspace.
#
# Upload uses the Power BI Imports API (multipart form post), which `fab api`
# cannot do; this wraps the curl + poll loop. The workspace must be backed by
# Premium / Embedded / Fabric capacity for the report to run after upload.
#
# Usage:
#   publish_rdl.sh <path-to.rdl> <workspaceId> [Overwrite|Abort] [displayName]
#
# Token: taken from $PBI_TOKEN if set, otherwise minted inline via
#   az account get-access-token (resource https://analysis.windows.net/powerbi/api).
# The token is never written to disk.
#
# Requires: curl, jq, and either $PBI_TOKEN or an authenticated `az` in the
# same tenant as the target workspace.

set -euo pipefail

RDL_PATH="${1:-}"
WS_ID="${2:-}"
NAME_CONFLICT="${3:-}"   # empty => auto-detect Abort (new) vs Overwrite (update)
DISPLAY_NAME="${4:-}"

if [[ -z "$RDL_PATH" || -z "$WS_ID" ]]; then
  echo "usage: publish_rdl.sh <path-to.rdl> <workspaceId> [Overwrite|Abort] [displayName]" >&2
  exit 2
fi
if [[ ! -f "$RDL_PATH" ]]; then
  echo "error: file not found: $RDL_PATH" >&2
  exit 2
fi

# datasetDisplayName must end in .rdl for the import to be treated as paginated.
if [[ -z "$DISPLAY_NAME" ]]; then
  DISPLAY_NAME="$(basename "$RDL_PATH")"
fi
case "$DISPLAY_NAME" in
  *.rdl) ;;
  *) DISPLAY_NAME="${DISPLAY_NAME}.rdl" ;;
esac

if [[ -n "$NAME_CONFLICT" && "$NAME_CONFLICT" != "Overwrite" && "$NAME_CONFLICT" != "Abort" ]]; then
  echo "error: nameConflict must be Overwrite or Abort (got '$NAME_CONFLICT')" >&2
  exit 2
fi

TOKEN="${PBI_TOKEN:-}"
if [[ -z "$TOKEN" ]]; then
  TOKEN="$(az account get-access-token \
    --resource "https://analysis.windows.net/powerbi/api" \
    --query accessToken -o tsv)"
fi
if [[ -z "$TOKEN" ]]; then
  echo "error: could not obtain a Power BI access token" >&2
  exit 1
fi

BASE="https://api.powerbi.com/v1.0/myorg/groups/${WS_ID}"

# The Imports API treats Overwrite and Abort asymmetrically for .rdl: Overwrite
# requires an existing report (a first-time Overwrite returns 404
# DuplicatePackageNotFound), Abort creates a new one (but errors on conflict).
# When the caller did not specify, pick based on whether the report exists.
if [[ -z "$NAME_CONFLICT" ]]; then
  BASE_NAME="${DISPLAY_NAME%.rdl}"
  LIST="$(curl -sS -w $'\n%{http_code}' "${BASE}/reports" -H "Authorization: Bearer ${TOKEN}")"
  LIST_CODE="${LIST##*$'\n'}"
  LIST_BODY="${LIST%$'\n'*}"
  if [[ "$LIST_CODE" -lt 200 || "$LIST_CODE" -ge 300 ]]; then
    echo "error: could not list reports in workspace ${WS_ID} (HTTP ${LIST_CODE}); check the workspace id and token" >&2
    echo "$LIST_BODY" | jq -r '.error // .' >&2 2>/dev/null || true
    exit 1
  fi
  EXISTING="$(printf '%s' "$LIST_BODY" | jq -r --arg n "$BASE_NAME" \
    'first(.value[] | select(.name==$n and .reportType=="PaginatedReport") | .id) // empty')"
  if [[ -n "$EXISTING" ]]; then NAME_CONFLICT="Overwrite"; else NAME_CONFLICT="Abort"; fi
fi

# URL-encode the display name; report names routinely contain spaces.
DISPLAY_NAME_ENC="$(jq -rn --arg s "$DISPLAY_NAME" '$s|@uri')"

echo "Uploading $(basename "$RDL_PATH") as '$DISPLAY_NAME' (nameConflict=$NAME_CONFLICT) ..."
RESP="$(curl -sS -w $'\n%{http_code}' -X POST \
  "${BASE}/imports?datasetDisplayName=${DISPLAY_NAME_ENC}&nameConflict=${NAME_CONFLICT}" \
  -H "Authorization: Bearer ${TOKEN}" \
  -F "file=@${RDL_PATH}")"
HTTP_CODE="${RESP##*$'\n'}"
IMPORT_JSON="${RESP%$'\n'*}"
if [[ "$HTTP_CODE" -lt 200 || "$HTTP_CODE" -ge 300 ]]; then
  echo "error: import returned HTTP $HTTP_CODE" >&2
  echo "$IMPORT_JSON" | jq -r '.error // .' >&2 2>/dev/null || echo "$IMPORT_JSON" >&2
  exit 1
fi

IMPORT_ID="$(echo "$IMPORT_JSON" | jq -r '.id')"
if [[ -z "$IMPORT_ID" || "$IMPORT_ID" == "null" ]]; then
  echo "error: import did not return an id" >&2
  echo "$IMPORT_JSON" >&2
  exit 1
fi
echo "Import id: $IMPORT_ID"

for _ in $(seq 1 60); do
  STATUS_JSON="$(curl -fsS "${BASE}/imports/${IMPORT_ID}" \
    -H "Authorization: Bearer ${TOKEN}")"
  STATE="$(echo "$STATUS_JSON" | jq -r '.importState')"
  echo "  importState: $STATE"
  case "$STATE" in
    Succeeded)
      echo "$STATUS_JSON" | jq -r '.reports[]? | "report: \(.name)  id: \(.id)  webUrl: \(.webUrl)"'
      exit 0
      ;;
    Failed)
      echo "import failed:" >&2
      echo "$STATUS_JSON" | jq -r '.error // .' >&2
      exit 1
      ;;
  esac
  sleep 3
done

echo "error: import did not complete within the polling window" >&2
exit 1
