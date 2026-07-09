#!/bin/bash
#
# Claude Code statusline. Segments live in statusline.d/<NN>-<name>.sh, sourced in
# numeric order; toggle each with the TRUE/FALSE flags below (two-line layout).
# Replace the hostname patterns in the display_host and host-color case blocks
# with names from your own machines.

ENABLE_HOST_CWD=TRUE
ENABLE_GIT=TRUE
ENABLE_MODEL=TRUE
ENABLE_TIME=TRUE
ENABLE_METERS=TRUE
ENABLE_VERSION=FALSE
ENABLE_VIM=TRUE

# ----------------------------------------------------------------------------
# Edit the TRUE/FALSE flags above to toggle segments. Each segment lives in
# scripts/statusline.d/<NN>-<name>.sh and is sourced in numeric order.
# ----------------------------------------------------------------------------

# Portable timeout — Linux has `timeout`, macOS has neither unless coreutils is installed (`gtimeout`).
# Falls back to running the command without a timeout if neither is available.
if command -v timeout >/dev/null 2>&1; then
    _timeout() { timeout "$@"; }
elif command -v gtimeout >/dev/null 2>&1; then
    _timeout() { gtimeout "$@"; }
else
    _timeout() { shift; "$@"; }
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
    # example-long-host) display_host="short" ;;   # optional: shorten an awkward hostname
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
vim_mode=$(echo "$input" | jq -r '.vim.mode // empty' 2>/dev/null)
pr_number=$(echo "$input" | jq -r '.pr.number // empty' 2>/dev/null)
pr_review=$(echo "$input" | jq -r '.pr.review_state // empty' 2>/dev/null)
wt_path=$(echo "$input" | jq -r '.worktree.path // empty' 2>/dev/null)
wt_name=$(echo "$input" | jq -r '.worktree.name // empty' 2>/dev/null)
wt_branch=$(echo "$input" | jq -r '.worktree.branch // empty' 2>/dev/null)
session_id=$(echo "$input" | jq -r '.session_id // empty' 2>/dev/null)
# Filesystem-safe key for the per-session meter reset-reveal toggle markers.
session_key=$(printf '%s' "$session_id" | tr -c 'A-Za-z0-9_-' '_')

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

# Hide version on the family-latest model (assumed default), show it on older
# releases (e.g. "Opus 4.6"). Bump LATEST_*_ID when a new model takes over the family.
LATEST_FABLE_ID="fable-5"
LATEST_OPUS_ID="opus-4-7"
LATEST_SONNET_ID="sonnet-4-6"
LATEST_HAIKU_ID="haiku-4-5"
if [ -n "$model" ]; then
    case "$model_id" in
        *$LATEST_FABLE_ID*|*$LATEST_OPUS_ID*|*$LATEST_SONNET_ID*|*$LATEST_HAIKU_ID*) : ;;
        *)
            # Prefer model_id (always has version, e.g. "claude-opus-4-6") since
            # display_name is just the family per the docs example.
            model_version=$(echo "$model_id" | grep -oE '[0-9]+-[0-9]+' | head -1 | tr '-' '.')
            [ -z "$model_version" ] && model_version=$(echo "$model_full" | grep -oE '[0-9]+\.[0-9]+' | head -1)
            [ -n "$model_version" ] && model="$model $model_version"
            ;;
    esac
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
    hostname1)              host_color="$MINT" ;;
    hostname2)         host_color="$PINK" ;;
    hostname3)   host_color="$PASTEL_BLUE" ;;
    hostname4) host_color="$YELLOW" ;;
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

STATUSLINE_D="$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")/statusline.d"

load_segment() {
    local flag=$1 file=$2
    [ "$flag" = "TRUE" ] || return 0
    [ -f "$STATUSLINE_D/$file" ] || return 0
    . "$STATUSLINE_D/$file"
}

# Statusline layout. A third line appears only when a meter bar is clicked
# open (06-meters.sh sets reset_seg_s / reset_seg_w from the toggle markers).
#   line 1: time · host/cwd · git
#   line 2: version · model · meters
load_segment "$ENABLE_TIME"           05-time.sh
load_segment "$ENABLE_HOST_CWD"       02-host-cwd.sh
load_segment "$ENABLE_GIT"            03-git.sh
nl
load_segment "$ENABLE_VERSION"        01-version.sh
load_segment "$ENABLE_VIM"            04a-vim.sh
load_segment "$ENABLE_MODEL"          04-model.sh
load_segment "$ENABLE_METERS"         06-meters.sh
# Line 3: rate-limit reset reveal, shown only while a meter toggle is open.
if [ -n "$reset_seg_s" ] || [ -n "$reset_seg_w" ]; then
    nl
    [ -n "$reset_seg_s" ] && seg "$reset_seg_s"
    [ -n "$reset_seg_w" ] && seg "$reset_seg_w"
fi
echo -e "$out"
