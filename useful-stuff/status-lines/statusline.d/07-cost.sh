# Marginal cost meter. The harness reports cost.total_cost_usd as a cumulative
# API-rate ESTIMATE for the whole session, which is meaningless on a
# subscription until you are actually paying out of pocket. So only surface
# cost when spend matters: a rate window in overage (5h or 7d above 100%) or
# fast mode on. The figure shown is the spend accrued since the segment first
# activated this session, not the inflated cumulative total. The baseline is
# captured in a per-session marker and dropped whenever the billable state ends,
# so each overage/fast stint meters from its own start.
[ -n "$session_cost" ] && [ "$session_cost" != "null" ] || return 0

mkdir -p "$SL_TOGGLE_DIR" 2>/dev/null
base_file="${SL_TOGGLE_DIR}/${session_key}.cost_base"

billable=""
if [ "$fast_mode" = "true" ]; then
    billable=1
else
    for r in "$rate_5h" "$rate_7d"; do
        [ -n "$r" ] && [ "$r" != "null" ] || continue
        if awk -v v="$r" 'BEGIN{exit !(v>100)}'; then billable=1; break; fi
    done
fi

if [ -z "$billable" ]; then
    rm -f "$base_file" 2>/dev/null
    return 0
fi

# First tick of a billable stint anchors the baseline at the current total.
[ -f "$base_file" ] || printf '%s' "$session_cost" > "$base_file"
baseline=$(cat "$base_file" 2>/dev/null)
[ -n "$baseline" ] || baseline=$session_cost

delta=$(awk -v c="$session_cost" -v b="$baseline" 'BEGIN{d=c-b; if(d<0)d=0; printf "%.2f", d}')
seg "${GOLD}\$${delta}${R}"
