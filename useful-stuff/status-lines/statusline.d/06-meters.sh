for val_label in "${ctx_pct}:C" "${rate_5h}:S" "${rate_7d}:W"; do
    val="${val_label%%:*}"
    label="${val_label##*:}"
    if [ -n "$val" ] && [ "$val" != "null" ]; then
        pct=$(printf "%.0f" "$val" 2>/dev/null || echo "0")
        color=$(pct_color "$pct")
        seg "${color}${pct}% ${label}${R}"
    fi
done
