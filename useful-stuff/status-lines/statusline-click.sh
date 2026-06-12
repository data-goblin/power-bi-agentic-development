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

case "$url" in
    file://*)
        raw="${url#file://}"
        # Percent-decode (printf %b expands \xHH escapes after substitution).
        path=$(printf '%b' "${raw//%/\\x}")
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
