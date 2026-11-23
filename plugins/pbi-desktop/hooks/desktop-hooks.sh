#!/usr/bin/env bash
# Hooks for Power BI Desktop work. Windows only: Desktop and its local engine do not exist elsewhere.
#   desktop-hooks.sh session   SessionStart: say which checks are off and why (silent when everything is on)
#   desktop-hooks.sh post      PostToolUse on Bash: after a command that saves model changes, run `te validate --local`
# Fails open: a missing dependency or a te failure never blocks; only a te validation error does (exit 2).
# PBI_DESKTOP_HOOKS_FORCE=1 skips the Windows gate (used to test the logic on other systems).

set -u
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
config="$here/config.yaml"

enabled() { ! grep -Eq "^$1:[[:space:]]*(false|off)\b" "$config" 2>/dev/null; }
is_windows() {
    [ "${PBI_DESKTOP_HOOKS_FORCE:-}" = 1 ] && return 0
    case "$(uname -s 2>/dev/null)" in MINGW*|MSYS*|CYGWIN*) return 0 ;; *) return 1 ;; esac
}
say_session() {
    local msg="$1"
    if command -v jq >/dev/null 2>&1; then
        jq -cn --arg m "$msg" '{systemMessage:$m, hookSpecificOutput:{hookEventName:"SessionStart", additionalContext:$m}}'
    else
        printf '%s\n' "$msg"
    fi
}

cmd_session() {
    enabled all_hooks_enabled || exit 0
    if ! is_windows; then
        say_session "pbi-desktop hooks are OFF on $(uname -s): Power BI Desktop and its local engine run only on Windows. Check TMDL or PBIP folders with 'te validate --model <folder>' instead."
    elif ! command -v te >/dev/null 2>&1; then
        say_session "pbi-desktop hooks: 'te' (Tabular Editor CLI) is not on PATH, so model validation after saves is OFF."
    fi
    exit 0
}

command_text() {
    local input cmd
    input="$(cat)"
    cmd=""
    command -v jq >/dev/null 2>&1 && cmd="$(printf '%s' "$input" | jq -r '.tool_input.command // empty' 2>/dev/null)"
    [ -n "$cmd" ] || cmd="$input"
    printf '%s' "$cmd"
}

saves_model() {
    local cmd="$1" script
    printf '%s' "$cmd" | grep -q 'SaveChanges' && return 0
    script="$(printf '%s' "$cmd" | sed -n 's/.*-File[[:space:]]*"\{0,1\}\([^" ]*\.ps1\).*/\1/p' | head -n1)"
    [ -n "$script" ] && [ -f "$script" ] && grep -q 'SaveChanges' "$script" 2>/dev/null
}

cmd_post() {
    enabled all_hooks_enabled || exit 0
    is_windows || exit 0
    local cmd out rc
    cmd="$(command_text)"
    saves_model "$cmd" || exit 0
    if ! command -v te >/dev/null 2>&1; then
        local marker="${TMPDIR:-/tmp}/pbi-desktop-hooks-te-missing"
        if [ ! -e "$marker" ]; then : >"$marker"; echo "pbi-desktop: model validation skipped, 'te' is not on PATH." >&2; fi
        exit 0
    fi
    if enabled model_validation; then
        out="$(timeout 50 te validate --local --errors-only --non-interactive 2>&1)"; rc=$?
        if [ $rc -eq 1 ] && printf '%s' "$out" | grep -Eq '^[[:space:]]*Errors:[[:space:]]+[1-9]'; then
            printf 'te validate --local found errors in the Desktop model:\n%s\n' "$out" >&2
            exit 2
        elif [ $rc -ne 0 ]; then
            printf 'pbi-desktop: te validate --local did not run (exit %s): %s\n' "$rc" "$(printf '%s' "$out" | head -n1)" >&2
        fi
    fi
    if enabled measure_metadata && command -v jq >/dev/null 2>&1; then
        out="$(timeout 50 te bpa run --local -r "$here/measure-metadata-rules.json" --no-defaults --no-model-rules --non-interactive --output-format json 2>/dev/null)"
        n="$(printf '%s' "$out" | jq -r '.summary.total // 0' 2>/dev/null)"
        if [ "${n:-0}" -gt 0 ] 2>/dev/null; then
            names="$(printf '%s' "$out" | jq -r '[.findings[].object] | unique | .[0:5] | join(", ")')"
            jq -cn --arg m "Desktop model: $n measure findings (missing description, display folder or format string), e.g. $names. Add them with te set." \
                '{hookSpecificOutput:{hookEventName:"PostToolUse", additionalContext:$m}}'
        fi
    fi
    exit 0
}

case "${1:-}" in
    session) cmd_session ;;
    post) cmd_post ;;
    *) echo "usage: desktop-hooks.sh session|post" >&2; exit 0 ;;
esac
