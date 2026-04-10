#!/usr/bin/env bash
# Render (export) a published paginated report to a file via the Power BI
# export-to-file API. This is the "render to verify" step of the dev loop.
#
# Usage:
#   export_rdl.sh <reportId> <workspaceId> [format] [outfile]
#
#   format  : PDF (default) | PPTX | XLSX | DOCX | CSV | XML | MHTML | IMAGE | ACCESSIBLEPDF
#   outfile : output path (default ./<reportId>.<ext>)
#
# To pass report parameters, set PBI_PARAMS to a JSON array, e.g.
#   PBI_PARAMS='[{"name":"Category","value":"Key Account"}]' export_rdl.sh <id> <ws>
# For a multi-value parameter, REPEAT the name once per value:
#   PBI_PARAMS='[{"name":"Category","value":"A"},{"name":"Category","value":"B"}]'
#
# Note: on a PPU workspace the export-to-file API allows ~1 request per 5-minute
# window (HTTP 429 otherwise); Premium/Embedded/Fabric capacity has no such cap.
#
# Token: $PBI_TOKEN if set, else minted inline via az (resource
# https://analysis.windows.net/powerbi/api). The token is never written to disk.
#
# Requires: curl, jq, python3 (for URL-encoding the export id), and either
# $PBI_TOKEN or an authenticated `az` in the target tenant.
#
# Note on the endpoint: the export STATUS is GET .../exports/{exportId}
# (NOT .../exports/{exportId}/status); the FILE is GET .../exports/{exportId}/file.
# The export id is opaque base64 and must be URL-encoded into the path.

set -euo pipefail

RID="${1:-}"
WS_ID="${2:-}"
FORMAT="${3:-PDF}"
OUTFILE="${4:-}"

if [[ -z "$RID" || -z "$WS_ID" ]]; then
  echo "usage: export_rdl.sh <reportId> <workspaceId> [format] [outfile]" >&2
  exit 2
fi

# Map format to a file extension (case keeps this bash 3.2 compatible).
case "$FORMAT" in
  PDF|ACCESSIBLEPDF) ext=pdf ;;
  PPTX) ext=pptx ;;
  XLSX) ext=xlsx ;;
  DOCX) ext=docx ;;
  CSV)  ext=csv ;;
  XML)  ext=xml ;;
  MHTML) ext=mhtml ;;
  IMAGE) ext=tiff ;;   # image output is IMAGE; sub-format (PNG/JPEG/etc.) is
                       # set via formatSettings.OutputFormat, not a top-level format
  *) ext=bin ;;
esac
[[ -z "$OUTFILE" ]] && OUTFILE="./${RID}.${ext}"

TOKEN="${PBI_TOKEN:-}"
if [[ -z "$TOKEN" ]]; then
  TOKEN="$(az account get-access-token \
    --resource "https://analysis.windows.net/powerbi/api" \
    --query accessToken -o tsv)"
fi
[[ -z "$TOKEN" ]] && { echo "error: could not obtain a Power BI access token" >&2; exit 1; }

BASE="https://api.powerbi.com/v1.0/myorg/groups/${WS_ID}/reports/${RID}"

# Build the ExportTo body, optionally embedding report parameters.
if [[ -n "${PBI_PARAMS:-}" ]]; then
  BODY="$(jq -nc --argjson p "$PBI_PARAMS" --arg f "$FORMAT" \
    '{format:$f, paginatedReportConfiguration:{parameterValues:$p}}')"
else
  BODY="$(jq -nc --arg f "$FORMAT" '{format:$f}')"
fi

echo "Exporting report $RID to $FORMAT ..."
EID="$(curl -fsS -X POST "${BASE}/ExportTo" \
  -H "Authorization: Bearer ${TOKEN}" -H "Content-Type: application/json" \
  -d "$BODY" | jq -r '.id')"
[[ -z "$EID" || "$EID" == "null" ]] && { echo "error: ExportTo returned no id" >&2; exit 1; }

EID_ENC="$(python3 -c 'import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1], safe=""))' "$EID")"

for _ in $(seq 1 80); do
  J="$(curl -fsS "${BASE}/exports/${EID_ENC}" -H "Authorization: Bearer ${TOKEN}")"
  STATUS="$(echo "$J" | jq -r '.status')"
  PCT="$(echo "$J" | jq -r '.percentComplete // 0')"
  echo "  status: ${STATUS} (${PCT}%)"
  case "$STATUS" in
    Succeeded) break ;;
    Failed)
      echo "export failed:" >&2
      echo "$J" | jq -r '.error // .' >&2
      exit 1 ;;
  esac
  sleep 3
done
[[ "$STATUS" != "Succeeded" ]] && { echo "error: export did not finish in time" >&2; exit 1; }

curl -fsS "${BASE}/exports/${EID_ENC}/file" -H "Authorization: Bearer ${TOKEN}" -o "$OUTFILE"
SIZE="$(wc -c < "$OUTFILE" | tr -d ' ')"
echo "Saved $OUTFILE (${SIZE} bytes)"
