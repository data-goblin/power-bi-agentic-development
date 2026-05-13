branch=$(cd "$cwd" 2>/dev/null && git branch --show-current 2>/dev/null)

if [ -z "$branch" ]; then
    seg "${DIM}not tracking${R}"
else
    seg "  $branch"

    diff_stat=$(cd "$cwd" 2>/dev/null && git diff HEAD --shortstat 2>/dev/null)
    add=$(echo "$diff_stat" | grep -oE '[0-9]+ insertion' | grep -oE '^[0-9]+' | head -1)
    del=$(echo "$diff_stat" | grep -oE '[0-9]+ deletion' | grep -oE '^[0-9]+' | head -1)
    untracked=$(cd "$cwd" 2>/dev/null && git ls-files --others --exclude-standard 2>/dev/null | wc -l | tr -d ' ')

    [ -z "$add" ] && add=0
    [ -z "$del" ] && del=0
    [ -z "$untracked" ] && untracked=0
    total_add=$((add + untracked))

    if [ "$total_add" -eq 0 ] && [ "$del" -eq 0 ]; then
        seg "${DIM}no changes${R}"
    else
        changes=""
        [ "$total_add" -gt 0 ] && changes+="${GREEN}+${total_add}${R}"
        [ "$total_add" -gt 0 ] && [ "$del" -gt 0 ] && changes+=" "
        [ "$del" -gt 0 ] && changes+="${RED}-${del}${R}"
        seg "$changes"
    fi

    pr=$(cd "$cwd" 2>/dev/null && _timeout 2 gh pr view --json number 2>/dev/null | jq -r '.number // empty' 2>/dev/null)
    [ -n "$pr" ] && seg "  #${pr}"
fi
