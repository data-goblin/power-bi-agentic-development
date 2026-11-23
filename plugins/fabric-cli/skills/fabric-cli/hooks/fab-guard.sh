#!/usr/bin/env bash
set -u

if ! command -v jq >/dev/null 2>&1; then
  echo "fabric-cli fab-guard: jq not found, fab command checks are OFF (install jq to enable them)" >&2
  exit 0
fi

cmd=$(jq -r '.tool_input.command // empty' 2>/dev/null) || exit 0
case "$cmd" in
  *fab\ *) ;;
  *) exit 0 ;;
esac

emit() {
  jq -n --arg d "$1" --arg r "$2" \
    '{hookSpecificOutput:{hookEventName:"PreToolUse",permissionDecision:$d,permissionDecisionReason:$r}}'
  exit 0
}

if printf '%s' "$cmd" | grep -Eq 'fab[[:space:]]+api[^|;&]*[[:space:]]-o[[:space:]]'; then
  emit deny "fab api has no -o flag; redirect with > instead"
fi
if printf '%s' "$cmd" | grep -Eq 'fab[[:space:]]+desc[[:space:]]+all\b'; then
  emit deny "fab desc all does not exist; run fab desc .x to print the valid item types"
fi
if printf '%s' "$cmd" | grep -Eq 'fab[[:space:]]+acl[[:space:]]+(ls|get|set|rm)[^|;&]*\.(SemanticModel|Report|Lakehouse|Notebook|Warehouse|Dataflow|DataPipeline)\b'; then
  emit deny "fab acl works on workspaces, connections and gateways only; item permissions need the REST API (see references/permissions.md)"
fi
if printf '%s' "$cmd" | grep -Eq 'fab[[:space:]]+rm[^|;&]*--hard'; then
  emit ask "fab rm --hard permanently deletes the item and cannot be recovered"
fi
if printf '%s' "$cmd" | grep -Eq 'fab[[:space:]]+(rm|import|assign|unassign|mv|cp|mkdir|stop)[[:space:]]|fab[[:space:]]+job[[:space:]]+(run|start)[[:space:]]|fab[[:space:]]+api[^|;&]*-X[[:space:]]*(post|put|patch|delete)'; then
  emit ask "This fab command changes a live tenant or consumes capacity; confirm the exact target and the CU estimate with the user first"
fi
exit 0
