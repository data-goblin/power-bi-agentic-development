# Bullet bar with linear projection to end of cycle.
#   used:      current usage percentage (integer)
#   resets_at: unix timestamp when this window's quota refreshes
#   cycle:     length of the window in seconds (5h = 18000, 7d = 604800)
#   label:     letter shown before the bar (S, W, etc.)
render_bullet () {
    local used=$1 resets_at=$2 cycle=$3 label=$4

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

    # Layered fill: 5 shades, each spans a 20% band. As usage climbs, the
    # next shade overpaints from the left, so every cell shows the topmost
    # layer that has reached it. Projection is conveyed only by the ↑
    # overflow glyph below; the bar itself reflects used% only.
    local layer k
    if [ "$used" -le 0 ] 2>/dev/null; then
        layer=0; k=0
    else
        layer=$(( (used + 19) / 20 ))
        [ "$layer" -gt 5 ] && layer=5
        k=$(( (used - (layer - 1) * 20) / 2 ))
        [ "$k" -gt 10 ] && k=10
        [ "$k" -lt 0 ] && k=0
    fi

    local bar="" i cell_layer cell_char cell_color
    for i in 1 2 3 4 5 6 7 8 9 10; do
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
    done
    bar="${bar}${R}"

    local pct_color_val
    pct_color_val=$(pct_color "$used")
    local overflow=""
    local BLINK="\033[5m"
    # ↑ as soon as the projection is on track to hit the limit (>=100).
    [ "$projected" -ge 100 ] 2>/dev/null && overflow=" ${BLINK}${CRIMSON}󰀦${R}"

    seg "${pct_color_val}${used}% ${label}${R} ${bar}${overflow}"
}

# Context window: no time-based projection (no rolling cycle).
if [ -n "$ctx_pct" ] && [ "$ctx_pct" != "null" ]; then
    pct=$(printf "%.0f" "$ctx_pct" 2>/dev/null || echo "0")
    color=$(pct_color "$pct")
    seg "${color}${pct}% C${R}"
fi

# 5-hour and 7-day windows: bullet bar with projection.
if [ -n "$rate_5h" ] && [ "$rate_5h" != "null" ]; then
    used=$(printf "%.0f" "$rate_5h" 2>/dev/null || echo "0")
    render_bullet "$used" "$rate_5h_resets" $((5 * 3600)) "S"
fi
if [ -n "$rate_7d" ] && [ "$rate_7d" != "null" ]; then
    used=$(printf "%.0f" "$rate_7d" 2>/dev/null || echo "0")
    render_bullet "$used" "$rate_7d_resets" $((7 * 24 * 3600)) "W"
fi
