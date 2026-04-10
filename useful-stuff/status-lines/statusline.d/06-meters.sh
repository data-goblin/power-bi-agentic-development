# Per-bar reset reveal: clicking the S/W bar toggles a marker file that this
# renderer reads to emit line 3 (assembled in statusline.sh). Markers live in a
# fixed /tmp namespace so the click handler and this script agree on the path.
reset_seg_s=""
reset_seg_w=""

# Bullet bar with linear projection to end of cycle.
#   used:      current usage percentage (integer)
#   resets_at: unix timestamp when this window's quota refreshes
#   cycle:     length of the window in seconds (5h = 18000, 7d = 604800)
#   label:     letter shown before the bar (S, W, etc.)
render_bullet () {
    local used=$1 resets_at=$2 cycle=$3 label=$4

    # Over 100% the bar is just maxed-out red and the line is at its longest
    # (overflow glyph + the cost segment, which 07-cost.sh activates on any
    # window >100%). On a split pane that wraps and looks broken. So in overage
    # drop the bar entirely and let cost stand in for it. Claude's own overage
    # line still shows when the window resets.
    if [ "$used" -gt 100 ] 2>/dev/null; then
        return 0
    fi

    local projected=$used
    if [ -n "$resets_at" ] && [ "$resets_at" -gt 0 ] 2>/dev/null; then
        local now=$(date +%s)
        local until_reset=$((resets_at - now))
        if [ "$until_reset" -gt 0 ] && [ "$until_reset" -lt "$cycle" ]; then
            local elapsed=$((cycle - until_reset))
            # Skip projection until we are at least 5% into the cycle to avoid
            # the extrapolation flapping in the opening minutes.
            local min_elapsed=$((cycle / 20))
            if [ "$elapsed" -ge "$min_elapsed" ]; then
                projected=$(( used * cycle / elapsed ))
            fi
        fi
    fi
    [ "$projected" -gt 999 ] 2>/dev/null && projected=999

    local pct_color_val
    pct_color_val=$(pct_color "$used")
    local overflow=""
    local BLINK="\033[5m"
    # ↑ as soon as the projection is on track to hit the limit (>=100).
    [ "$projected" -ge 100 ] 2>/dev/null && overflow=" ${BLINK}${CRIMSON}󰀦${R}"

    local visible="${pct_color_val}${used}% ${label}${R}"
    meter_visual=$(render_meter_visual "$used" 10)
    if [ -n "$meter_visual" ]; then
        visible="${visible} ${meter_visual}"
    fi

    # Wrap the bar in an OSC 8 hyperlink to a per-session toggle marker. The
    # click handler (statusline-click.sh) flips the marker on click; this
    # renderer then reveals the reset time on line 3. Path is plain ASCII.
    local marker="${SL_TOGGLE_DIR}/${session_key}.${label}"
    if [ "$STATUSLINE_CLICKABLE_RESETS" = "TRUE" ]; then
        local link_open="\033]8;;file://${marker}\a"
        local link_close="\033]8;;\a"
        seg "${link_open}${visible}${link_close}${overflow}"
    else
        seg "${visible}${overflow}"
    fi

    # When the marker is set, compose this bar's reset reveal for line 3.
    if [ "$STATUSLINE_CLICKABLE_RESETS" = "TRUE" ] && [ -e "$marker" ] && [ -n "$resets_at" ] && [ "$resets_at" -gt 0 ] 2>/dev/null; then
        local now_r=$(date +%s)
        local rel=$((resets_at - now_r))
        local clock rel_str
        if [ "$label" = "W" ]; then
            clock=$(date -d "@$resets_at" +"%a %H:%M" 2>/dev/null || date -r "$resets_at" +"%a %H:%M" 2>/dev/null)
        else
            clock=$(date -d "@$resets_at" +"%H:%M" 2>/dev/null || date -r "$resets_at" +"%H:%M" 2>/dev/null)
        fi
        if [ "$rel" -le 0 ]; then
            rel_str="now"
        else
            local d=$((rel / 86400)) h=$(((rel % 86400) / 3600)) m=$(((rel % 3600) / 60))
            if   [ "$d" -gt 0 ]; then rel_str="${d}d${h}h"
            elif [ "$h" -gt 0 ]; then rel_str="${h}h${m}m"
            else                      rel_str="${m}m"
            fi
        fi
        local txt="${pct_color_val}${label}${R} resets in ${rel_str} ${DIM}(${clock})${R}"
        if [ "$label" = "W" ]; then reset_seg_w="$txt"; else reset_seg_s="$txt"; fi
    fi
}

render_meter_visual () {
    local used=$1 width=$2
    case "$STATUSLINE_METER_STYLE" in
        label|percent) return 0 ;;
        thin|thin-bar) render_statusline_linear_bar "$used" "$width" "━" "─" ;;
        bar|full-bar) render_statusline_linear_bar "$used" "$width" "█" "░" ;;
        *) render_statusline_step_bar "$used" "$width" ;;
    esac
}

render_statusline_step_bar () {
    local used=$1 width=$2
    local layer k
    if [ "$used" -le 0 ] 2>/dev/null; then
        layer=0; k=0
    else
        layer=$(( (used + 19) / 20 ))
        [ "$layer" -gt 5 ] && layer=5
        k=$(( (used - (layer - 1) * 20) * width / 20 ))
        [ "$k" -gt "$width" ] && k=$width
        [ "$k" -lt 0 ] && k=0
    fi

    local bar="" i=1 cell_layer cell_char cell_color
    while [ "$i" -le "$width" ]; do
        if [ "$layer" -eq 0 ] 2>/dev/null; then
            cell_layer=0
        elif [ "$i" -le "$k" ] 2>/dev/null; then
            cell_layer=$layer
        else
            cell_layer=$((layer - 1))
        fi
        case "$cell_layer" in
            0) cell_char="░"; cell_color="$DIM" ;;
            1) cell_char="▒"; cell_color="$DIM" ;;
            2) cell_char="▒"; cell_color="$YELLOW" ;;
            3) cell_char="▓"; cell_color="$ORANGE" ;;
            4) cell_char="█"; cell_color="$BRIGHT_RED" ;;
            5) cell_char="█"; cell_color="$MAROON" ;;
        esac
        bar="${bar}${cell_color}${cell_char}"
        i=$((i + 1))
    done
    printf '%s' "${bar}${R}"
}

render_statusline_linear_bar () {
    local used=$1 width=$2 fill_char=$3 empty_char=$4
    local capped=$used
    [ "$capped" -lt 0 ] 2>/dev/null && capped=0
    [ "$capped" -gt 100 ] 2>/dev/null && capped=100
    local filled=$(( (capped * width + 99) / 100 ))
    [ "$filled" -gt "$width" ] && filled=$width
    local color
    color=$(pct_color "$used")
    local bar="" i=1
    while [ "$i" -le "$width" ]; do
        if [ "$i" -le "$filled" ]; then
            bar="${bar}${color}${fill_char}"
        else
            bar="${bar}${DIM}${empty_char}"
        fi
        i=$((i + 1))
    done
    printf '%s' "${bar}${R}"
}

# Context window: no time-based projection (no rolling cycle).
if [ "$ENABLE_CONTEXT" = "TRUE" ] && [ -n "$ctx_pct" ] && [ "$ctx_pct" != "null" ]; then
    pct=$(printf "%.0f" "$ctx_pct" 2>/dev/null || echo "0")
    color=$(pct_color "$pct")
    context_seg="${color}${pct}% C${R}"
    if [ "$STATUSLINE_CONTEXT_STYLE" = "bar" ]; then
        context_visual=$(render_meter_visual "$pct" 5)
        [ -n "$context_visual" ] && context_seg="${context_seg} ${context_visual}"
    fi
    seg "$context_seg"
fi

# 5-hour and 7-day windows: bullet bar with projection.
if [ "$ENABLE_LIMIT_5H" = "TRUE" ] && [ -n "$rate_5h" ] && [ "$rate_5h" != "null" ]; then
    used=$(printf "%.0f" "$rate_5h" 2>/dev/null || echo "0")
    render_bullet "$used" "$rate_5h_resets" $((5 * 3600)) "S"
fi
if [ "$ENABLE_LIMIT_WEEKLY" = "TRUE" ] && [ -n "$rate_7d" ] && [ "$rate_7d" != "null" ]; then
    used=$(printf "%.0f" "$rate_7d" 2>/dev/null || echo "0")
    render_bullet "$used" "$rate_7d_resets" $((7 * 24 * 3600)) "W"
fi
