#!/bin/bash
#
# Hyperlink click handler for the statusline's clickable rate-limit meters.
#
# Wire this to your terminal's hyperlink / hint click action (see README). It
# receives the clicked file:// URL as $1. For the statusline's reset-reveal
# markers it toggles the marker file (showing or hiding the reset line); every
# other URL falls through to the OS opener so ordinary links (cwd, PR) still
# open as usual.

url="$1"
[ -z "$url" ] && exit 0

case "$(uname -s)" in
    Darwin) opener=open ;;
    *)      opener=xdg-open ;;
esac

launch_lazygit() {
    repo="$1"
    [ -d "$repo" ] || exit 0
    command -v lazygit >/dev/null 2>&1 || exit 0

    case "$(uname -s)" in
        Darwin)
            if command -v alacritty >/dev/null 2>&1; then
                open -na Alacritty --args -e lazygit -p "$repo" >/dev/null 2>&1 && exit 0
            fi
            if command -v wezterm >/dev/null 2>&1; then
                open -na WezTerm --args start --cwd "$repo" lazygit >/dev/null 2>&1 && exit 0
            fi
            ;;
        Linux)
            if command -v x-terminal-emulator >/dev/null 2>&1; then
                x-terminal-emulator -e lazygit -p "$repo" >/dev/null 2>&1 & exit 0
            fi
            if command -v alacritty >/dev/null 2>&1; then
                alacritty -e lazygit -p "$repo" >/dev/null 2>&1 & exit 0
            fi
            ;;
    esac

    cd "$repo" 2>/dev/null && exec lazygit
}

case "$url" in
    file://*)
        raw="${url#file://}"
        # Percent-decode (printf %b expands \xHH escapes after substitution).
        path=$(printf '%b' "${raw//%/\\x}")
        # LazyGit launcher marker: the file content is the repo root to open.
        case "$path" in
            /tmp/claude-sl-lazygit/*)
                name="${path#/tmp/claude-sl-lazygit/}"
                case "$name" in
                    ""|*/*|*..*) exit 0 ;;
                esac
                repo=$(cat "$path" 2>/dev/null)
                launch_lazygit "$repo"
                exit 0
                ;;
        esac
        # Statusline reset-reveal toggle: flip a marker file, never open anything.
        # Confined to a fixed namespace; reject empty / nested / traversal keys.
        case "$path" in
            /tmp/claude-sl-toggle/*)
                name="${path#/tmp/claude-sl-toggle/}"
                case "$name" in
                    ""|*/*|*..*) exit 0 ;;
                esac
                if [ -e "$path" ]; then
                    rm -f "$path"
                else
                    mkdir -p /tmp/claude-sl-toggle
                    : > "$path"
                fi
                exit 0
                ;;
        esac
        ;;
esac

exec "$opener" "$url"
