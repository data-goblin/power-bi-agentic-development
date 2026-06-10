# Leading icon: language glyph for git repos, folder icon elsewhere.
# Always in host colour to stay visually unified with the path.
# Detection cached in $TMPDIR/sl-lang and invalidated by .git/HEAD or
# .git/index mtime change. Hot path ~2ms; cold path capped at first 2000
# tracked files (~50ms worst case).
icon=$'\xef\x81\xbb'         # U+F07B nf-fa-folder (fallback)

repo_root=$(git -C "$cwd" rev-parse --show-toplevel 2>/dev/null)
if [ -n "$repo_root" ]; then
    cache_dir="${TMPDIR:-/tmp}/sl-lang"
    [ -d "$cache_dir" ] || mkdir -p "$cache_dir"
    cache_file="$cache_dir/${repo_root//\//_}"
    head_file="$repo_root/.git/HEAD"
    index_file="$repo_root/.git/index"

    mt=$(stat -f '%m' "$cache_file" "$head_file" "$index_file" 2>/dev/null \
       || stat -c '%Y' "$cache_file" "$head_file" "$index_file" 2>/dev/null)
    cm=$(echo "$mt" | sed -n '1p'); hm=$(echo "$mt" | sed -n '2p'); im=$(echo "$mt" | sed -n '3p')
    : "${cm:=0}" "${hm:=0}" "${im:=0}"

    if [ ! -f "$cache_file" ] || [ "$cm" -lt "$hm" ] || [ "$cm" -lt "$im" ]; then
        git -C "$repo_root" ls-files 2>/dev/null | head -2000 | awk -F. '
            NF>1 {
                ext = tolower($NF)
                if (ext ~ /^(png|jpg|jpeg|gif|svg|ico|webp|bmp|tiff|woff|woff2|ttf|otf|eot|wav|mp3|mp4|mov|m4a|ogg|flac|pdf|zip|tar|gz|bz2|xz|7z|bin|exe|dll|dylib|so|class|jar|pyc|pyo|lock|map|min|snap|xsd|xml)$/) next
                counts[ext]++
            }
            END {
                top = ""; max = 0
                for (e in counts) if (counts[e] > max) { max = counts[e]; top = e }
                print top
            }
        ' > "$cache_file"
    fi

    lang=$(< "$cache_file")

    # nf-md (Material Design) language glyphs -- chunkier than seti.
    # Codepoints above U+FFFF, so 4-byte UTF-8; bash hex escapes for ASCII-safe source.
    case "$lang" in
        md)             icon=$'\xf3\xb0\x8d\x94' ;;
        py)             icon=$'\xf3\xb0\x8c\xa0' ;;
        rs)             icon=$'\xf3\xb1\x98\x97' ;;
        ts|tsx)         icon=$'\xf3\xb0\x9b\xa6' ;;
        js|jsx|mjs|cjs) icon=$'\xf3\xb0\x8c\x9e' ;;
        go)             icon=$'\xf3\xb0\x9f\x93' ;;
        lua)            icon=$'\xf3\xb0\xa2\xb1' ;;
        c|h)            icon=$'\xf3\xb0\x99\xb1' ;;
        cpp|cc|cxx|hpp) icon=$'\xf3\xb0\x99\xb2' ;;
        cs)             icon=$'\xf3\xb0\x8c\x9b' ;;
        swift)          icon=$'\xf3\xb0\x9b\xa5' ;;
        kt|kts)         icon=$'\xf3\xb0\xae\xaa' ;;
        html|htm)       icon=$'\xf3\xb1\x8f\x9c' ;;
        css|scss|sass)  icon=$'\xf3\xb1\x8f\x80' ;;
        sh|bash|zsh)    icon=$'\xf3\xb1\x86\x83' ;;
        rb)             icon=$'\xf3\xb0\xb4\xad' ;;
        json)           icon=$'\xee\xac\x8f'     ;;
        yaml|yml)       icon=$'\xee\x9a\xa8'     ;;
        toml|conf|ini)  icon=$'\xee\x98\x95'     ;;
        ps1|psm1)       icon=$'\xee\xaf\x87'     ;;
        sql)            icon=$'\xf3\xb1\xad\x98' ;;
    esac
fi

# URL-encode for OSC 8 hyperlinks. Keeps the unreserved set + slashes intact and
# percent-encodes the rest, so paths with spaces or # survive the file:// URL.
url_encode() {
    local s="$1" i c result="" hex
    for ((i=0; i<${#s}; i++)); do
        c="${s:i:1}"
        case "$c" in
            [a-zA-Z0-9/._~-]) result+="$c" ;;
            *) printf -v hex '%%%02X' "'$c"; result+="$hex" ;;
        esac
    done
    printf '%s' "$result"
}

# Worktree mode: when an anthropic-managed worktree session is active, replace
# the cwd display with the worktree triple (path · name · branch) in orange so
# isolation is visually obvious. 03-git.sh suppresses the branch in this mode.
# Both modes wrap the path in an OSC 8 hyperlink; alacritty's hint handler
# (scripts/alacritty-url-open.sh) opens it in `alacritty -e nvim` on click.
if [ -n "$wt_path" ]; then
    wt_glyph=$'\xf3\xb0\x99\x85'  # U+F0645 nf-md-file_tree
    wt_display="$wt_path"
    [ -n "$wt_name" ]   && wt_display="$wt_display${DIM} · ${ORANGE}$wt_name"
    [ -n "$wt_branch" ] && wt_display="$wt_display${DIM} · ${ORANGE}$wt_branch"
    osc_url=$(url_encode "$wt_path")
    seg "${ORANGE}${wt_glyph}  \033]8;;file://${osc_url}\a${wt_display}\033]8;;\a${R}"
else
    osc_url=$(url_encode "$cwd")
    seg "${host_color}${icon}  \033]8;;file://${osc_url}\a${dir}\033]8;;\a${R}"
fi
