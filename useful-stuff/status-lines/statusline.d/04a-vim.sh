# Vim mode indicator. Shows current mode from $vim_mode (set in statusline.sh
# from JSON .vim.mode). Colour mirrors LazyVim/lualine convention:
#   NORMAL=blue, INSERT=green, VISUAL/VISUAL LINE/VISUAL BLOCK=purple.
# Glyph: nf-custom-neovim (U+E6AE), the green diamond.
# Empty if editorMode is not "vim" in ~/.claude/settings.json.

if [ -n "$vim_mode" ]; then
    glyph=$'\xee\x9a\xae'
    case "$vim_mode" in
        NORMAL)                                  vcolor="\033[38;5;75m"  ;;
        INSERT)                                  vcolor="\033[38;5;154m" ;;
        VISUAL|"VISUAL LINE"|"VISUAL BLOCK")     vcolor="\033[38;5;99m"  ;;
        *)                                       vcolor="$DIM"           ;;
    esac
    seg "${vcolor}${glyph}  ${vim_mode}${R}"
fi
