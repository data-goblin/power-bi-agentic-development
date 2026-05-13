#!/bin/bash
#
# Claude Code statusline. Each segment lives in statusline.d/<NN>-<name>.sh
# and is sourced in numeric order. Toggle a segment with the TRUE/FALSE
# flags below. Replace the hostname patterns in the host-color section
# with names from your own machines.

ENABLE_HOST_CWD=TRUE
ENABLE_GIT=TRUE
ENABLE_MODEL=TRUE
ENABLE_TIME=TRUE
ENABLE_METERS=TRUE

# ----------------------------------------------------------------------------
# Portable timeout. Linux has `timeout`; macOS has neither unless coreutils
# is installed (`gtimeout`). Falls back to running without a timeout.
# ----------------------------------------------------------------------------
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
# do not get eaten by `echo -e` (\a -> bell, \b -> backspace, etc.)
command -v cygpath >/dev/null 2>&1 && cwd=$(cygpath -u "$cwd" 2>/dev/null || printf '%s' "$cwd")

host=$(hostname -s 2>/dev/null)
host_lower=$(echo "$host" | tr '[:upper:]' '[:lower:]')

# Optional: shorten a long hostname for the display string. Add your own
# entries here if a machine's hostname is awkward to read.
case "$host_lower" in
    # example-long-hostname) display_host="short" ;;
    *) display_host="$host" ;;
esac
dir=$(echo "$cwd" | sed "s|$HOME|$display_host|")

model_full=$(echo "$input" | jq -r '.model.display_name // empty' 2>/dev/null)
model_id=$(echo "$input" | jq -r '.model.id // empty' 2>/dev/null)
effort_level=$(echo "$input" | jq -r '.effort.level // empty' 2>/dev/null)
ctx_pct=$(echo "$input" | jq -r '.context_window.used_percentage // empty' 2>/dev/null)
rate_5h=$(echo "$input" | jq -r '.rate_limits.five_hour.used_percentage // empty' 2>/dev/null)
rate_7d=$(echo "$input" | jq -r '.rate_limits.seven_day.used_percentage // empty' 2>/dev/null)

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

# Model icons. NerdFonts MDI (nf-md-robot_*), confirmed present in
# JetBrainsMono NF 3.4.0.
# 󱚝 U+F169D nf-md-robot_angry  󱜙 U+F1719 nf-md-robot_happy  󱜚 U+F171A nf-md-robot_happy_outline
if   echo "$model_full" | grep -qi "opus";   then model="Opus";   model_color="$RED";    model_icon="󱚝"
elif echo "$model_full" | grep -qi "haiku";  then model="Haiku";  model_color="$YELLOW"; model_icon="󱜚"
elif echo "$model_full" | grep -qi "sonnet"; then model="Sonnet"; model_color="$ORANGE"; model_icon="󱜙"
else model=""; model_color=""; model_icon=""
fi

# Hide the version on the family-latest model (assumed default), show it on
# older releases (e.g. "Opus 4.6"). Bump LATEST_*_ID when a new model takes
# over the family.
LATEST_OPUS_ID="opus-4-7"
LATEST_SONNET_ID="sonnet-4-6"
LATEST_HAIKU_ID="haiku-4-5"
if [ -n "$model" ]; then
    case "$model_id" in
        *$LATEST_OPUS_ID*|*$LATEST_SONNET_ID*|*$LATEST_HAIKU_ID*) : ;;
        *)
            model_version=$(echo "$model_id" | grep -oE '[0-9]+-[0-9]+' | head -1 | tr '-' '.')
            [ -z "$model_version" ] && model_version=$(echo "$model_full" | grep -oE '[0-9]+\.[0-9]+' | head -1)
            [ -n "$model_version" ] && model="$model $model_version"
            ;;
    esac
fi

# Effort dots, calibrated per model. Haiku has no effort support and stays
# blank. Opus 4.7: 5 levels (low/medium/high/xhigh/max). Opus 4.6 + Sonnet
# 4.6: 4 levels (low/medium/high/max; xhigh falls back to high). See
# code.claude.com/docs/en/model-config.
case "$model" in
    Haiku*)
        effort_dots=""
        ;;
    Opus*)
        if echo "$model_id $model_full" | grep -qE '4\.7|4-7'; then
            case "$effort_level" in
                low)    effort_dots="●○○○○" ;;
                medium) effort_dots="●●○○○" ;;
                high)   effort_dots="●●●○○" ;;
                xhigh)  effort_dots="●●●●○" ;;
                max)    effort_dots="●●●●●" ;;
                *)      effort_dots="" ;;
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
        case "$effort_level" in
            low)        effort_dots="●○○○" ;;
            medium)     effort_dots="●●○○" ;;
            high|xhigh) effort_dots="●●●○" ;;
            max)        effort_dots="●●●●" ;;
            *)          effort_dots="" ;;
        esac
        ;;
    *)
        effort_dots=""
        ;;
esac

# Host color. Replace the example entries with your own machine hostnames so
# each host gets a distinct color in the statusline. Anything not matched
# falls through to the default.
case "$host_lower" in
    hostname1) host_color="$MINT" ;;
    hostname2) host_color="$PINK" ;;
    hostname3) host_color="$PASTEL_BLUE" ;;
    hostname4) host_color="$PURPLE" ;;
    *)         host_color="$PINK" ;;
esac

SEP="${DIM} · ${R}"
out=""
seg() {
    if [ -z "$out" ]; then out="$1"
    else out="${out}${SEP}$1"
    fi
}

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

load_segment "$ENABLE_HOST_CWD" 02-host-cwd.sh
load_segment "$ENABLE_GIT"      03-git.sh
load_segment "$ENABLE_MODEL"    04-model.sh
load_segment "$ENABLE_TIME"     05-time.sh
load_segment "$ENABLE_METERS"   06-meters.sh

echo -e "$out"
