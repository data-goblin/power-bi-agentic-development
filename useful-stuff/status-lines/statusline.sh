#!/bin/bash
#
# Claude Code statusline. Segments live in statusline.d/<NN>-<name>.sh, sourced in
# numeric order; toggle each with the TRUE/FALSE flags below (two-line layout).
# Replace the hostname patterns in the display_host and host-color case blocks
# with names from your own machines.

ENABLE_TIME=TRUE
ENABLE_FOLDER=TRUE
ENABLE_BRANCH=TRUE
ENABLE_COMMITS=TRUE
ENABLE_PULLS=TRUE
ENABLE_LOC_CHANGES=TRUE
ENABLE_FILE_CHANGES=TRUE
ENABLE_PR=TRUE
ENABLE_WORKTREE=TRUE
ENABLE_MODEL=TRUE
ENABLE_MODEL_VERSION=TRUE
ENABLE_EFFORT=TRUE
ENABLE_CONTEXT=TRUE
ENABLE_LIMIT_5H=TRUE
ENABLE_LIMIT_WEEKLY=TRUE
ENABLE_COST=TRUE
ENABLE_VERSION=FALSE
ENABLE_VIM=TRUE
STATUSLINE_METER_STYLE=steps
STATUSLINE_CONTEXT_STYLE=percent
STATUSLINE_CLICKABLE_RESETS=TRUE
STATUSLINE_CLICK_OPEN_PATHS=TRUE
STATUSLINE_CLICK_OPEN_LAZYGIT=FALSE
STATUSLINE_CLICK_BRANCH_COLLAPSE=TRUE

# Back-compatible coarse flags from older copies of this statusline.
ENABLE_HOST_CWD=TRUE
ENABLE_GIT=TRUE
ENABLE_METERS=TRUE

STATUSLINE_ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")" 2>/dev/null && pwd -P)
[ -z "$STATUSLINE_ROOT" ] && STATUSLINE_ROOT=$(dirname "${BASH_SOURCE[0]}")
STATUSLINE_CONFIG="${STATUSLINE_CONFIG:-$STATUSLINE_ROOT/statusline.config.sh}"
[ -f "$STATUSLINE_CONFIG" ] && . "$STATUSLINE_CONFIG"

[ "$ENABLE_HOST_CWD" = "FALSE" ] && ENABLE_FOLDER=FALSE
if [ "$ENABLE_GIT" = "FALSE" ]; then
    ENABLE_BRANCH=FALSE
    ENABLE_COMMITS=FALSE
    ENABLE_PULLS=FALSE
    ENABLE_LOC_CHANGES=FALSE
    ENABLE_FILE_CHANGES=FALSE
    ENABLE_PR=FALSE
    ENABLE_WORKTREE=FALSE
fi
if [ "$ENABLE_METERS" = "FALSE" ]; then
    ENABLE_CONTEXT=FALSE
    ENABLE_LIMIT_5H=FALSE
    ENABLE_LIMIT_WEEKLY=FALSE
fi

# ----------------------------------------------------------------------------
# Edit the TRUE/FALSE flags above, or place overrides in statusline.config.sh.
# Each segment lives in statusline.d/<NN>-<name>.sh and is sourced in numeric order.
# ----------------------------------------------------------------------------

# Portable timeout — Linux has `timeout`, macOS has neither unless coreutils is installed (`gtimeout`).
# Falls back to running the command without a timeout if neither is available.
if command -v timeout >/dev/null 2>&1; then
    _timeout() { timeout "$@"; }
elif command -v gtimeout >/dev/null 2>&1; then
    _timeout() { gtimeout "$@"; }
else
    # No coreutils timeout/gtimeout (stock macOS): enforce the cap by polling.
    # The command's stdout goes to a temp file, NOT the inherited pipe, so an
    # orphaned grandchild (e.g. az's python, which it forks rather than exec's)
    # can't hold a command-substitution open and stall the render past the cap.
    # Polling is done with FOREGROUND sleeps so nothing is left backgrounded to
    # orphan (bash 3.2 has no `wait -n` to race a sleeper against the command).
    # On timeout we SIGTERM the child tree and emit whatever it wrote.
    # Input: <secs> <cmd...>. Granularity 0.05s.
    _timeout() {
        local secs=$1; shift
        local tmp
        tmp=$(mktemp 2>/dev/null) || tmp="${TMPDIR:-/tmp}/sl-to.$$.$RANDOM"
        "$@" >"$tmp" 2>/dev/null &
        local cmd_pid=$!
        local steps=$(( ${secs%.*} * 20 + 1 ))
        while [ "$steps" -gt 0 ] && kill -0 "$cmd_pid" 2>/dev/null; do
            sleep 0.05
            steps=$(( steps - 1 ))
        done
        if kill -0 "$cmd_pid" 2>/dev/null; then
            pkill -TERM -P "$cmd_pid" 2>/dev/null
            kill -TERM "$cmd_pid" 2>/dev/null
        fi
        wait "$cmd_pid" 2>/dev/null
        local rc=$?
        cat "$tmp" 2>/dev/null
        rm -f "$tmp" 2>/dev/null
        return $rc
    }
fi

# Portable mtime in epoch seconds for one or more files. GNU coreutils uses
# `stat -c %Y`; BSD/macOS uses `stat -f %m`. Probe once via the GNU form: on
# Linux `stat -f` silently succeeds with filesystem info instead of erroring,
# so a BSD-first `||` fallback never reaches the GNU branch.
if stat -c %Y . >/dev/null 2>&1; then
    _mtime() { stat -c %Y "$@" 2>/dev/null; }
else
    _mtime() { stat -f %m "$@" 2>/dev/null; }
fi

input=$(cat)

cwd=$(echo "$input" | jq -r '.cwd // empty' 2>/dev/null)
[ -z "$cwd" ] && cwd="$PWD"
# Normalize Windows paths (C:\foo\bar) to POSIX (/c/foo/bar) so backslashes
# don't get eaten by echo -e (\a → bell, \b → backspace, etc.)
command -v cygpath >/dev/null 2>&1 && cwd=$(cygpath -u "$cwd" 2>/dev/null || printf '%s' "$cwd")

host=$(hostname -s 2>/dev/null)
host_lower=$(echo "$host" | tr '[:upper:]' '[:lower:]')
case "$host_lower" in
    kurts-macbook-pro) display_host="mac" ;;
    *) display_host="$host" ;;
esac
dir=$(echo "$cwd" | sed "s|$HOME|$display_host|")

model_full=$(echo "$input" | jq -r '.model.display_name // empty' 2>/dev/null)
model_id=$(echo "$input" | jq -r '.model.id // empty' 2>/dev/null)
effort_level=$(echo "$input" | jq -r '.effort.level // empty' 2>/dev/null)
ctx_pct=$(echo "$input" | jq -r '.context_window.used_percentage // empty' 2>/dev/null)
rate_5h=$(echo "$input" | jq -r '.rate_limits.five_hour.used_percentage // empty' 2>/dev/null)
rate_7d=$(echo "$input" | jq -r '.rate_limits.seven_day.used_percentage // empty' 2>/dev/null)
rate_5h_resets=$(echo "$input" | jq -r '.rate_limits.five_hour.resets_at // empty' 2>/dev/null)
rate_7d_resets=$(echo "$input" | jq -r '.rate_limits.seven_day.resets_at // empty' 2>/dev/null)
session_cost=$(echo "$input" | jq -r '.cost.total_cost_usd // empty' 2>/dev/null)
fast_mode=$(echo "$input" | jq -r '.fast_mode // empty' 2>/dev/null)
vim_mode=$(echo "$input" | jq -r '.vim.mode // empty' 2>/dev/null)
pr_number=$(echo "$input" | jq -r '.pr.number // empty' 2>/dev/null)
pr_review=$(echo "$input" | jq -r '.pr.review_state // empty' 2>/dev/null)
wt_path=$(echo "$input" | jq -r '.worktree.path // empty' 2>/dev/null)
wt_name=$(echo "$input" | jq -r '.worktree.name // empty' 2>/dev/null)
wt_branch=$(echo "$input" | jq -r '.worktree.branch // empty' 2>/dev/null)

# Worktree mode is scoped to Claude `--worktree` sessions ONLY: the harness
# populates .worktree.* and we trust that exclusively. We deliberately do NOT
# auto-detect arbitrary `git worktree` checkouts -- that produced false positives
# (sibling trees, idle leftovers, .claude/ subdirs). Opt in via `claude --worktree`.
wt_active=""
if [ -n "$wt_path" ]; then
    wt_active=1
    [ -z "$wt_name" ] && wt_name=$(basename "$wt_path")
fi
session_id=$(echo "$input" | jq -r '.session_id // empty' 2>/dev/null)
# Filesystem-safe key for the per-session meter reset-reveal toggle markers.
session_key=$(printf '%s' "$session_id" | tr -c 'A-Za-z0-9_-' '_')
# Shared namespace for statusline click-toggle markers (meters + branch collapse).
SL_TOGGLE_DIR="/tmp/claude-sl-toggle"
SL_LAZYGIT_DIR="/tmp/claude-sl-lazygit"

R="\033[0m"
DIM="\033[38;5;241m"
PINK="\033[38;5;211m"
GREEN="\033[38;5;80m"
RED="\033[38;5;167m"
YELLOW="\033[38;5;214m"
ORANGE="\033[38;5;208m"
BRIGHT_RED="\033[38;5;167m"
MAROON="\033[38;5;88m"
GOLD="\033[38;5;220m"
PASTEL_BLUE="\033[38;5;153m"
MINT="\033[38;5;115m"
CHARTREUSE="\033[38;5;154m"
PURPLE="\033[38;5;141m"
CRIMSON="\033[38;5;160m"

# Model icons: NerdFonts MDI (nf-md-robot_*), confirmed present in JetBrainsMono NF 3.4.0
# 󰈸 U+F0238 nf-md-fire  󱚝 U+F169D nf-md-robot_angry  󱜙 U+F1719 nf-md-robot_happy  󱜚 U+F171A nf-md-robot_happy_outline
if echo "$model_full" | grep -qi "fable"; then model="Fable"; model_color="$PINK";   model_icon="󰈸"
elif echo "$model_full" | grep -qi "opus";   then model="Opus";   model_color="$RED";     model_icon="󱚝"
elif echo "$model_full" | grep -qi "haiku"; then model="Haiku";  model_color="$YELLOW";  model_icon="󱜚"
elif echo "$model_full" | grep -qi "sonnet";then model="Sonnet"; model_color="$ORANGE";  model_icon="󱜙"
else model=""; model_color=""; model_icon=""
fi

# Always show the model version (e.g. "Opus 4.8", "Sonnet 4.6").
if [ -n "$model" ]; then
    model_version=$(echo "$model_id" | grep -oE '[0-9]+-[0-9]+' | head -1 | tr '-' '.')
    [ -z "$model_version" ] && model_version=$(echo "$model_full" | grep -oE '[0-9]+\.[0-9]+' | head -1)
    [ -z "$model_version" ] && model_version=$(echo "$model_id" | grep -oE '[0-9]+$' | head -1)
    [ "$ENABLE_MODEL_VERSION" = "TRUE" ] && [ -n "$model_version" ] && model="$model $model_version"
fi

# Effort dots, calibrated per model by probing each model's live /effort picker.
# Fable 5, Opus 4.7+, and Sonnet 5+ expose the full low/medium/high/xhigh/max
# range plus a separate `ultracode` mode (xhigh effort + standing workflow
# orchestration), rendered as five purple diamonds so it reads as its own tier
# rather than reusing the xhigh dots. Haiku 4.5+ has the same 5-level range but
# no ultracode. Older Sonnet/Opus (pre-5 / pre-4.7) collapse high+xhigh into one
# dot and have no ultracode either. See code.claude.com/docs/en/model-config.
#
# _effort_model_version is independent of the display-only $model_version above
# (which is deliberately left blank for the assumed-latest model per family) --
# tier gating needs the real version even when we're not showing it.
_effort_model_version() {
    local v
    v=$(echo "$model_id" | grep -oE '[0-9]+-[0-9]+' | head -1 | tr '-' '.')
    [ -z "$v" ] && v=$(echo "$model_full" | grep -oE '[0-9]+\.[0-9]+' | head -1)
    [ -z "$v" ] && v=$(echo "$model_id" | grep -oE '[0-9]+$' | head -1)
    echo "$v"
}
_effort_ge() {
    local v; v=$(_effort_model_version)
    [ -n "$v" ] && [ "$(printf '%s\n%s\n' "$1" "$v" | sort -V | head -1)" = "$1" ]
}
case "$model" in
    Fable*)
        case "$effort_level" in
            low)       effort_dots="●○○○○" ;;
            medium)    effort_dots="●●○○○" ;;
            high)      effort_dots="●●●○○" ;;
            xhigh)     effort_dots="●●●●○" ;;
            max)       effort_dots="●●●●●" ;;
            ultracode) effort_dots="${PURPLE}◆◆◆◆◆${R}" ;;
            *)         effort_dots="" ;;
        esac
        ;;
    Haiku*)
        if _effort_ge "4.5"; then
            case "$effort_level" in
                low)    effort_dots="●○○○○" ;;
                medium) effort_dots="●●○○○" ;;
                high)   effort_dots="●●●○○" ;;
                xhigh)  effort_dots="●●●●○" ;;
                max)    effort_dots="●●●●●" ;;
                *)      effort_dots="" ;;
            esac
        else
            effort_dots=""
        fi
        ;;
    Opus*)
        if echo "$model_id $model_full" | grep -qE '4\.[7-9]|4-[7-9]|4\.1[0-9]|4-1[0-9]'; then
            case "$effort_level" in
                low)       effort_dots="●○○○○" ;;
                medium)    effort_dots="●●○○○" ;;
                high)      effort_dots="●●●○○" ;;
                xhigh)     effort_dots="●●●●○" ;;
                max)       effort_dots="●●●●●" ;;
                ultracode) effort_dots="${PURPLE}◆◆◆◆◆${R}" ;;
                *)         effort_dots="" ;;
            esac
        else
            case "$effort_level" in
                low)        effort_dots="●○○○" ;;
                medium)     effort_dots="●●○○" ;;
                high|xhigh) effort_dots="●●●○" ;;
                max)        effort_dots="●●●●" ;;
                *)          effort_dots="" ;;
            esac
        fi
        ;;
    Sonnet*)
        if _effort_ge "5"; then
            case "$effort_level" in
                low)       effort_dots="●○○○○" ;;
                medium)    effort_dots="●●○○○" ;;
                high)      effort_dots="●●●○○" ;;
                xhigh)     effort_dots="●●●●○" ;;
                max)       effort_dots="●●●●●" ;;
                ultracode) effort_dots="${PURPLE}◆◆◆◆◆${R}" ;;
                *)         effort_dots="" ;;
            esac
        else
            case "$effort_level" in
                low)        effort_dots="●○○○" ;;
                medium)     effort_dots="●●○○" ;;
                high|xhigh) effort_dots="●●●○" ;;
                max)        effort_dots="●●●●" ;;
                *)          effort_dots="" ;;
            esac
        fi
        ;;
    *)
        effort_dots=""
        ;;
esac

case "$host_lower" in
    omen)              host_color="$MINT" ;;
    asparagus)         host_color="$PINK" ;;
    asparagus-beast)   host_color="$PASTEL_BLUE" ;;
    kurts-macbook-pro) host_color="$YELLOW" ;;
    *)                 host_color="$PINK" ;;
esac

SEP="${DIM} · ${R}"
out=""
seg() {
    local tail="${out: -1}"
    if [ -z "$out" ] || [ "$tail" = $'\n' ]; then
        out="${out}$1"
    else
        out="${out}${SEP}$1"
    fi
}
nl() { out="${out}"$'\n'; }

# Apply threshold color to a percentage value
pct_color() {
    local pct=$1
    if   [ "$pct" -ge 90 ] 2>/dev/null; then echo "$MAROON"
    elif [ "$pct" -ge 80 ] 2>/dev/null; then echo "$BRIGHT_RED"
    elif [ "$pct" -ge 60 ] 2>/dev/null; then echo "$ORANGE"
    elif [ "$pct" -ge 40 ] 2>/dev/null; then echo "$YELLOW"
    else echo "$DIM"
    fi
}

STATUSLINE_D="$STATUSLINE_ROOT/statusline.d"

load_segment() {
    local flag=$1 file=$2
    [ "$flag" = "TRUE" ] || return 0
    [ -f "$STATUSLINE_D/$file" ] || return 0
    . "$STATUSLINE_D/$file"
}

# Statusline layout (a third line appears when a meter bar is clicked open).
#   line 1: time · folder · git
#   line 2: version · model/effort · meters · cost
ENABLE_GIT_SEGMENT=FALSE
if [ "$ENABLE_BRANCH" = "TRUE" ] || [ "$ENABLE_PULLS" = "TRUE" ] || [ "$ENABLE_COMMITS" = "TRUE" ] || [ "$ENABLE_LOC_CHANGES" = "TRUE" ] || [ "$ENABLE_FILE_CHANGES" = "TRUE" ] || [ "$ENABLE_PR" = "TRUE" ] || [ "$ENABLE_WORKTREE" = "TRUE" ]; then
    ENABLE_GIT_SEGMENT=TRUE
fi
ENABLE_METER_SEGMENT=FALSE
if [ "$ENABLE_CONTEXT" = "TRUE" ] || [ "$ENABLE_LIMIT_5H" = "TRUE" ] || [ "$ENABLE_LIMIT_WEEKLY" = "TRUE" ]; then
    ENABLE_METER_SEGMENT=TRUE
fi
ENABLE_MODEL_SEGMENT=FALSE
if [ "$ENABLE_MODEL" = "TRUE" ] || [ "$ENABLE_MODEL_VERSION" = "TRUE" ] || [ "$ENABLE_EFFORT" = "TRUE" ]; then
    ENABLE_MODEL_SEGMENT=TRUE
fi
ENABLE_SECOND_LINE_SEGMENT=FALSE
if [ "$ENABLE_VERSION" = "TRUE" ] || [ "$ENABLE_VIM" = "TRUE" ] || [ "$ENABLE_MODEL_SEGMENT" = "TRUE" ] || [ "$ENABLE_METER_SEGMENT" = "TRUE" ] || [ "$ENABLE_COST" = "TRUE" ]; then
    ENABLE_SECOND_LINE_SEGMENT=TRUE
fi

load_segment "$ENABLE_TIME"           05-time.sh
load_segment "$ENABLE_FOLDER"         02-host-cwd.sh
load_segment "$ENABLE_GIT_SEGMENT"    03-git.sh
if [ -n "$out" ] && [ "$ENABLE_SECOND_LINE_SEGMENT" = "TRUE" ]; then
    nl
fi
load_segment "$ENABLE_VERSION"        01-version.sh
load_segment "$ENABLE_VIM"            04a-vim.sh
load_segment "$ENABLE_MODEL_SEGMENT"  04-model.sh
load_segment "$ENABLE_METER_SEGMENT"  06-meters.sh
load_segment "$ENABLE_COST"           07-cost.sh
# Line 3: rate-limit reset reveal, shown only while a meter toggle is open.
if [ -n "$reset_seg_s" ] || [ -n "$reset_seg_w" ]; then
    nl
    [ -n "$reset_seg_s" ] && seg "$reset_seg_s"
    [ -n "$reset_seg_w" ] && seg "$reset_seg_w"
fi
echo -e "$out"
