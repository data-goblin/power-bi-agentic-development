#!/usr/bin/env bash
INPUT=$(cat 2>/dev/null || true)
if printf '%s' "$INPUT" | grep -Eq '"action"[[:space:]]*:[[:space:]]*"resolve"'; then
    printf '%s\n' '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"ask","permissionDecisionReason":"The creating-good-dashboards skill says the person who raised a comment decides when it is done. Confirm that this thread should be resolved by Claude."}}'
fi
exit 0
