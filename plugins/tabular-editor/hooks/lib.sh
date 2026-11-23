#!/bin/bash
# Shared helpers for the tabular-editor hooks. Sourced, never run directly.

HOOK_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" 2>/dev/null && pwd)"
HOOK_CONFIG="$HOOK_DIR/config.yaml"

cfg_enabled() {
    [[ -f "$HOOK_CONFIG" ]] || return 0
    grep -qE "^$1:[[:space:]]*(false|False|FALSE|no)" "$HOOK_CONFIG" 2>/dev/null && return 1
    return 0
}

hooks_disabled() {
    cfg_enabled all_hooks_enabled || return 0
    return 1
}

# note_once <key> <message>: tell the model once per session that a check did
# not run. Stdout JSON reaches the model on exit 0; stderr is for the terminal.
note_once() {
    local key="$1" msg="$2" sid marker
    sid=$(printf '%s' "$INPUT" | sed -n 's/.*"session_id"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -1)
    marker="${TMPDIR:-/tmp}/te-hooks-${sid:-nosession}-$key"
    [[ -e "$marker" ]] && return 0
    : > "$marker" 2>/dev/null
    printf '%s\n' "$msg" >&2
    printf '{"hookSpecificOutput":{"hookEventName":"PostToolUse","additionalContext":"%s"}}\n' "$msg"
}

# warn <message>: advisory finding, exit 0, visible to the model.
warn() {
    jq -cn --arg m "$1" '{hookSpecificOutput:{hookEventName:"PostToolUse",additionalContext:$m}}'
}

# te_ready: true when `te` runs without first downloading itself. The Unix
# wrapper installs and self-updates on use, which a hook must never trigger.
te_ready() {
    local p
    p=$(command -v te 2>/dev/null) || return 1
    if [[ "$(head -c 2 "$p" 2>/dev/null)" == "#!" ]] && grep -q 'tabular-editor-cli' "$p" 2>/dev/null; then
        [[ -x "${XDG_DATA_HOME:-$HOME/.local/share}/tabular-editor-cli/te" ]] || return 1
    fi
    return 0
}

# run_limited <seconds> <command...>
run_limited() {
    local secs="$1"; shift
    if command -v timeout >/dev/null 2>&1; then timeout "$secs" "$@"; else "$@"; fi
}

# edited_path: the file a Write/Edit hook payload touched, with / separators.
edited_path() {
    local tool p
    tool=$(printf '%s' "$INPUT" | jq -r '.tool_name // empty' 2>/dev/null)
    case "$tool" in Write|Edit|MultiEdit|write|edit|create) ;; *) return 1 ;; esac
    p=$(printf '%s' "$INPUT" | jq -r '.tool_input.file_path // .tool_input.path // empty' 2>/dev/null)
    [[ -n "$p" ]] || return 1
    printf '%s' "${p//\\//}"
}
