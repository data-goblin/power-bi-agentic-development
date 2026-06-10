# Claude Code version -- leftmost segment on line 2 so the model segment
# starts at roughly the same column as the cwd on line 1.
# Glyph: nf-fa-tag (U+F02B) -- placeholder will be substituted by the
# theme/install script.
version=$(echo "$input" | jq -r '.version // empty' 2>/dev/null)
if [ -n "$version" ]; then
    seg "  ${version}"
fi
