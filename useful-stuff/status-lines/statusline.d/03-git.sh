branch=$(_timeout 2 git -C "$cwd" branch --show-current 2>/dev/null)

compact_count() {
    awk -v n="$1" '
        BEGIN {
            n += 0
            units[0] = ""; units[1] = "K"; units[2] = "M"; units[3] = "B"; units[4] = "T"
            u = 0
            v = n
            while (v >= 1000 && u < 4) {
                v = v / 1000
                u++
            }
            while (1) {
                if (v < 10) { dec = 2; scale = 100 }
                else if (v < 100) { dec = 1; scale = 10 }
                else { dec = 0; scale = 1 }
                rv = int(v * scale + 0.5) / scale
                if (rv >= 1000 && u < 4) {
                    v = rv / 1000
                    u++
                    continue
                }
                s = sprintf("%.*f", dec, rv)
                sub(/\.?0+$/, "", s)
                printf "%s%s", s, units[u]
                exit
            }
        }
    '
}

if [ -z "$branch" ]; then
    seg "${DIM}not tracking${R}"
else
    [ -z "$repo_root" ] && repo_root=$(cd "$cwd" 2>/dev/null && git rev-parse --show-toplevel 2>/dev/null)
    if [ "$ENABLE_BRANCH" = "TRUE" ]; then
        branch_visible="  ${branch}"
        bl_open=""
        bl_close=""
        if [ "$STATUSLINE_CLICK_OPEN_LAZYGIT" = "TRUE" ] && [ -n "$repo_root" ]; then
            mkdir -p "$SL_LAZYGIT_DIR" 2>/dev/null
            lazygit_marker="${SL_LAZYGIT_DIR}/${session_key}.repo"
            printf '%s\n' "$repo_root" > "$lazygit_marker" 2>/dev/null
            bl_open="\033]8;;file://${lazygit_marker}\a"
            bl_close="\033]8;;\a"
        elif [ "$STATUSLINE_CLICK_BRANCH_COLLAPSE" = "TRUE" ]; then
            branch_marker="${SL_TOGGLE_DIR}/${session_key}.branch"
            bl_open="\033]8;;file://${branch_marker}\a"
            bl_close="\033]8;;\a"
            # Clickable branch (default fg, matches the time): click collapses the name to the glyph.
            if [ -e "$branch_marker" ]; then
                branch_visible=""
            fi
        fi
        if [ -n "$bl_open" ]; then
            seg "${bl_open}${branch_visible}${bl_close}"
        else
            seg "$branch_visible"
        fi
    fi

    # Keep the behind-count honest -- what `git fetch` would reveal -- without
    # ever blocking the render. Same non-blocking pattern as the PR lookup: a TTL
    # stamp + lock dir gate a DETACHED `git fetch`. ADO bare-fetch auth goes stale,
    # so for dev.azure.com/visualstudio remotes we inject the PAT via the op
    # service account (same path as the ado-git wrapper); falls back to a bare
    # fetch when op/keychain aren't present. repo_root is usually already set by
    # 02-host-cwd.sh.
    # On-disk cache shared by this repo's background-refreshed values (fetch + LOC).
    FCACHE="${XDG_CACHE_HOME:-$HOME/.cache}/statusline"
    mkdir -p "$FCACHE" 2>/dev/null
    fkey=$(printf '%s' "$repo_root" | sha1sum 2>/dev/null | cut -d' ' -f1)
    if [ -n "$repo_root" ] && [ -n "$(cd "$cwd" 2>/dev/null && git remote 2>/dev/null)" ]; then
        FETCH_TTL=300
        fstamp="$FCACHE/fetch_${fkey}"
        fneed=1
        if [ -f "$fstamp" ]; then
            fmt=$(_mtime "$fstamp")
            [ -n "$fmt" ] && [ $(( $(date +%s) - fmt )) -lt "$FETCH_TTL" ] && fneed=0
        fi
        if [ "$fneed" = 1 ]; then
            flock="$fstamp.lock"
            if [ -d "$flock" ]; then
                lmt=$(_mtime "$flock")
                [ -n "$lmt" ] && [ $(( $(date +%s) - lmt )) -ge 60 ] && rmdir "$flock" 2>/dev/null
            fi
            if mkdir "$flock" 2>/dev/null; then
                # Stamp up-front so a failed/auth-rejected fetch still backs off for the TTL.
                : > "$fstamp" 2>/dev/null
                fetch_remote_url=$(cd "$cwd" 2>/dev/null && git remote get-url origin 2>/dev/null)
                ( trap 'rmdir "$flock" 2>/dev/null' EXIT
                  export GIT_TERMINAL_PROMPT=0
                  case "$fetch_remote_url" in
                      *dev.azure.com*|*visualstudio.com*)
                          sa_tok=$(security find-generic-password -s 'op-te-service-account' -w 2>/dev/null)
                          if [ -n "$sa_tok" ] && command -v op >/dev/null 2>&1; then
                              export OP_SERVICE_ACCOUNT_TOKEN="$sa_tok"
                              export ADO_PAT='op://Tabular Editor/ADO Innovation PAT/password'
                              _timeout 20 op run -- bash -c \
                                  'git -C "$1" -c http.extraheader="Authorization: Basic $(printf ":%s" "$ADO_PAT" | base64 | tr -d "\n")" fetch --quiet' \
                                  _ "$repo_root"
                              exit 0
                          fi
                          ;;
                  esac
                  _timeout 15 git -C "$repo_root" fetch --quiet
                ) >/dev/null 2>&1 </dev/null &
                disown 2>/dev/null
            fi
        fi
    fi

    # Behind upstream (unpulled). Counts commits the remote-tracking ref has that
    # HEAD doesn't -- i.e. what a pull would bring in. Reads the ref the background
    # fetch above keeps fresh; renders instantly, no network. Hidden at 0 and when
    # the branch has no upstream.
    behind=$(cd "$cwd" 2>/dev/null && git rev-list --count HEAD..@{u} 2>/dev/null)
    [ -z "$behind" ] && behind=0
    if [ "$ENABLE_PULLS" = "TRUE" ] && [ "$behind" -gt 0 ] 2>/dev/null; then
        behind_glyph=$'\xef\x81\xa3'  # U+F063 nf-fa-arrow_down
        seg "${ORANGE}${behind_glyph}  ${behind}${R}"
    fi

    # Worktree name in purple, right after the branch (SEP supplies the dot).
    if [ "$ENABLE_WORKTREE" = "TRUE" ] && [ -n "$wt_active" ]; then
        wt_glyph=$'\xf3\xb0\x99\x85'  # U+F0645 nf-md-file_tree
        seg "${PURPLE}${wt_glyph}  ${wt_name}${R}"
    fi

    # PR detection.
    #
    # GitHub: Claude Code populates input.pr.{number,review_state} for us (free).
    # Azure DevOps: not provided by Claude; we detect via the origin URL and
    # query `az repos pr list`. Result is cached on disk so we don't pay the
    # ~2s az roundtrip on every statusline render.
    if [ "$ENABLE_PR" = "TRUE" ] && [ -z "$pr_number" ]; then
        remote_url=$(cd "$cwd" 2>/dev/null && git remote get-url origin 2>/dev/null)
        if [ -n "$remote_url" ]; then
            CACHE_DIR="${XDG_CACHE_HOME:-$HOME/.cache}/statusline"
            PR_CACHE_TTL=60
            cache_key=$(printf '%s|%s' "$remote_url" "$branch" | sha1sum 2>/dev/null | cut -d' ' -f1)
            cache_file="$CACHE_DIR/pr_${cache_key}"

            # Always serve the cached result, regardless of age -- the render must
            # NEVER block on the network. The az lookup below can take 3-4s (worse
            # when ADO creds are stale and it hits the timeout cap), which blows past
            # Claude's statusline render budget and blanks the whole line. So the PR
            # state shown may be up to one refresh cycle stale; that is the trade.
            if [ -f "$cache_file" ]; then
                # shellcheck disable=SC1090
                . "$cache_file"
            fi

            # Decide whether to trigger a refresh: cache missing or older than TTL.
            need_refresh=1
            if [ -f "$cache_file" ]; then
                mtime=$(_mtime "$cache_file")
                if [ -n "$mtime" ]; then
                    age=$(( $(date +%s) - mtime ))
                    [ "$age" -lt "$PR_CACHE_TTL" ] && need_refresh=0
                fi
            fi

            # Refresh ADO PR state in a DETACHED background process (GitHub PR state
            # arrives free via input JSON, so only ADO needs this). A lock dir keeps
            # az processes from stacking; a stale lock (>30s, e.g. a killed refresh)
            # is reclaimed. The subshell redirects all fds so Claude's render returns
            # immediately instead of waiting on the pipe to close.
            if [ "$need_refresh" = 1 ]; then
                case "$remote_url" in
                    *dev.azure.com*|*visualstudio.com*)
                        lock_dir="$cache_file.lock"
                        if [ -d "$lock_dir" ]; then
                            lmt=$(_mtime "$lock_dir")
                            [ -n "$lmt" ] && [ $(( $(date +%s) - lmt )) -ge 30 ] && rmdir "$lock_dir" 2>/dev/null
                        fi
                        if mkdir "$lock_dir" 2>/dev/null; then
                            (
                                trap 'rmdir "$lock_dir" 2>/dev/null' EXIT
                                pr_number=""; pr_review=""; pr_url=""
                                ado_org=""; ado_project=""; ado_repo=""
                                if [[ "$remote_url" =~ dev\.azure\.com/([^/]+)/(.+)/_git/(.+)$ ]]; then
                                    ado_org="${BASH_REMATCH[1]}"
                                    ado_project="${BASH_REMATCH[2]}"
                                    ado_repo="${BASH_REMATCH[3]}"
                                elif [[ "$remote_url" =~ //([^.]+)\.visualstudio\.com/(.+)/_git/(.+)$ ]]; then
                                    ado_org="${BASH_REMATCH[1]}"
                                    ado_project="${BASH_REMATCH[2]}"
                                    ado_repo="${BASH_REMATCH[3]}"
                                elif [[ "$remote_url" =~ :v3/([^/]+)/([^/]+)/(.+)$ ]]; then
                                    ado_org="${BASH_REMATCH[1]}"
                                    ado_project="${BASH_REMATCH[2]}"
                                    ado_repo="${BASH_REMATCH[3]}"
                                fi
                                # Project name may be URL-encoded ("Tabular%20Editor%20Learn")
                                if [ -n "$ado_project" ] && command -v python3 >/dev/null 2>&1; then
                                    ado_project=$(python3 -c 'import sys,urllib.parse;print(urllib.parse.unquote(sys.argv[1]))' "$ado_project" 2>/dev/null || printf '%s' "$ado_project")
                                fi

                                if [ -n "$ado_org" ] && [ -n "$ado_repo" ] && [ -n "$ado_project" ] && command -v az >/dev/null 2>&1; then
                                    pr_json=$(_timeout 5 az repos pr list \
                                        --repository "$ado_repo" \
                                        --project "$ado_project" \
                                        --source-branch "$branch" \
                                        --status active \
                                        --organization "https://dev.azure.com/$ado_org" \
                                        2>/dev/null)
                                    pr_number=$(printf '%s' "$pr_json" | jq -r '.[0].pullRequestId // empty' 2>/dev/null)

                                    if [ -n "$pr_number" ]; then
                                        # URL-encode project name once (spaces -> %20) for the URL
                                        ado_project_enc=$(python3 -c 'import sys,urllib.parse;print(urllib.parse.quote(sys.argv[1]))' "$ado_project" 2>/dev/null || printf '%s' "$ado_project")
                                        pr_url="https://dev.azure.com/${ado_org}/${ado_project_enc}/_git/${ado_repo}/pullrequest/${pr_number}"
                                        is_draft=$(printf '%s' "$pr_json" | jq -r '.[0].isDraft // false' 2>/dev/null)
                                        # Excluding the PR creator from approval counting -- DevOps policy
                                        # typically has "allow requestors to approve own changes = false",
                                        # so the creator's vote shouldn't tint the state. Rejections from
                                        # anyone (including creator) still flag changes_requested.
                                        creator_id=$(printf '%s' "$pr_json" | jq -r '.[0].createdBy.id // empty' 2>/dev/null)
                                        non_creator_max=$(printf '%s' "$pr_json" | jq -r --arg cid "$creator_id" '[.[0].reviewers[] | select(.id != $cid) | .vote] | max // 0' 2>/dev/null)
                                        any_min=$(printf '%s' "$pr_json" | jq -r '[.[0].reviewers[].vote] | min // 0' 2>/dev/null)
                                        if [ "$is_draft" = "true" ]; then
                                            pr_review="draft"
                                        elif [ "${any_min:-0}" -lt 0 ] 2>/dev/null; then
                                            pr_review="changes_requested"
                                        elif [ "${non_creator_max:-0}" -ge 10 ] 2>/dev/null; then
                                            pr_review="approved"
                                        else
                                            pr_review="pending"
                                        fi
                                    fi
                                fi

                                # Write cache regardless of outcome -- an empty result
                                # still refreshes the mtime so we don't re-spawn until TTL.
                                mkdir -p "$CACHE_DIR" 2>/dev/null
                                {
                                    printf 'pr_number=%q\n' "${pr_number}"
                                    printf 'pr_review=%q\n' "${pr_review}"
                                    printf 'pr_url=%q\n'    "${pr_url}"
                                    echo 'pr_lookup_done=1'
                                } > "$cache_file" 2>/dev/null
                            ) >/dev/null 2>&1 </dev/null &
                            disown 2>/dev/null
                        fi
                        ;;
                esac
            fi
        fi
    fi

    if [ "$ENABLE_PR" = "TRUE" ] && [ -n "$pr_number" ]; then
        case "$pr_review" in
            approved)          pr_c="$GREEN"  ;;
            pending)           pr_c="$YELLOW" ;;
            changes_requested) pr_c="$RED"    ;;
            draft)             pr_c="$DIM"    ;;
            *)                 pr_c=""        ;;
        esac

        # If we don't already have a URL (GitHub path via input JSON, or stale cache),
        # derive it from the remote. Supports github.com SSH/HTTPS and falls through
        # silently for hosts we don't recognise.
        if [ -z "$pr_url" ]; then
            [ -z "$remote_url" ] && remote_url=$(cd "$cwd" 2>/dev/null && git remote get-url origin 2>/dev/null)
            case "$remote_url" in
                *github.com*)
                    if [[ "$remote_url" =~ github\.com[:/](.+/.+)(\.git)?$ ]]; then
                        gh_path="${BASH_REMATCH[1]%.git}"
                        pr_url="https://github.com/${gh_path}/pull/${pr_number}"
                    fi
                    ;;
            esac
        fi

        pr_text="#${pr_number}"

        pr_visible="  ${pr_text}"
        if [ -n "$pr_url" ]; then
            # OSC 8 wraps the entire glyph+number so the whole segment is clickable.
            # BEL terminator (\007) avoids a backslash collision with following \033.
            pr_visible=$(printf '\033]8;;%s\007%s\033]8;;\007' "$pr_url" "$pr_visible")
        fi
        if [ -n "$pr_c" ]; then
            seg "${pr_c}${pr_visible}${R}"
        else
            seg "${pr_visible}"
        fi
    fi

    # Unpushed commits (hidden when 0). Same colour as branch glyph (default fg).
    # Prefer the upstream ahead-count; when the branch has no upstream (new local
    # branch never pushed) fall back to commits on HEAD not on any remote, so they
    # still show. Guard on a remote existing, else a remote-less repo counts all history.
    unpushed=$(cd "$cwd" 2>/dev/null && git rev-list --count @{u}..HEAD 2>/dev/null)
    if [ -z "$unpushed" ] && [ -n "$(cd "$cwd" 2>/dev/null && git remote 2>/dev/null)" ]; then
        unpushed=$(cd "$cwd" 2>/dev/null && git rev-list --count HEAD --not --remotes 2>/dev/null)
    fi
    [ -z "$unpushed" ] && unpushed=0
    if [ "$ENABLE_COMMITS" = "TRUE" ] && [ "$unpushed" -gt 0 ]; then
        seg "  $unpushed"
    fi

    # File-level counts from `git status --porcelain`, categorised by INTENT.
    # Untracked directories ("?? dir/") are expanded via find -maxdepth 2
    # to get the real file count without the cost of -uall on huge trees.
    status_out=$(cd "$cwd" 2>/dev/null && git status --porcelain 2>/dev/null)
    if [ "$ENABLE_FILE_CHANGES" = "TRUE" ] && [ -n "$status_out" ]; then
        added=0; modified=0; deleted=0
        while IFS= read -r line; do
            [ -z "$line" ] && continue
            code="${line:0:2}"
            fpath="${line:3}"
            case "$code" in
                '??')
                    case "$fpath" in
                        */)
                            n=$(find "$cwd/$fpath" -maxdepth 2 -type f 2>/dev/null | wc -l)
                            added=$((added + n)) ;;
                        *)  added=$((added+1)) ;;
                    esac
                    ;;
                *D*)          deleted=$((deleted+1)) ;;
                *A*)          added=$((added+1)) ;;
                *[MTRC]*)     modified=$((modified+1)) ;;
            esac
        done <<< "$status_out"

        file_seg=""
        [ "$added"    -gt 0 ] && file_seg+="${GREEN}?:$(compact_count "$added")${R}"
        if [ "$modified" -gt 0 ]; then
            [ -n "$file_seg" ] && file_seg+="  "
            file_seg+="${YELLOW}M:$(compact_count "$modified")${R}"
        fi
        if [ "$deleted" -gt 0 ]; then
            [ -n "$file_seg" ] && file_seg+="  "
            file_seg+="${RED}D:$(compact_count "$deleted")${R}"
        fi
        [ -n "$file_seg" ] && seg "  $file_seg"
    fi

    # LOC delta: insertions/deletions vs HEAD plus untracked content lines.
    # `git diff HEAD --shortstat` walks every changed file and runs ~1.6s on a
    # 200+ file working set -- enough to overrun Claude's render budget and blank
    # the WHOLE line. So compute it in a DETACHED background refresher behind a
    # short TTL and serve the last-known value instantly, the same non-blocking
    # pattern as the fetch/PR lookups above. A pure TTL gates the refresh (not
    # .git/index mtime, which unstaged edits don't bump), so the shown delta can
    # lag by up to LOC_TTL. The :(exclude,attr:linguist-generated) pathspec drops
    # generated fixtures (e.g. a 49k-line .tmdl) so they can't dominate;
    # --shortstat omits binary insertions; -I skips binary untracked files.
    gen_excl=':(exclude,attr:linguist-generated)'
    add=0; del=0
    if [ -n "$repo_root" ]; then
        LOC_TTL=4
        loc_cache="$FCACHE/loc_${fkey}"
        loc_need=1
        if [ -f "$loc_cache" ]; then
            lcm=$(_mtime "$loc_cache")
            [ -n "$lcm" ] && [ $(( $(date +%s) - lcm )) -lt "$LOC_TTL" ] && loc_need=0
        fi
        if [ "$loc_need" = 1 ]; then
            loc_lock="$loc_cache.lock"
            if [ -d "$loc_lock" ]; then
                llm=$(_mtime "$loc_lock")
                [ -n "$llm" ] && [ $(( $(date +%s) - llm )) -ge 30 ] && rmdir "$loc_lock" 2>/dev/null
            fi
            if mkdir "$loc_lock" 2>/dev/null; then
                ( trap 'rmdir "$loc_lock" 2>/dev/null' EXIT
                  ds=$(git -C "$repo_root" diff HEAD --shortstat -- "$gen_excl" 2>/dev/null)
                  a=$(echo "$ds" | grep -oE '[0-9]+ insertion' | grep -oE '^[0-9]+' | head -1)
                  d=$(echo "$ds" | grep -oE '[0-9]+ deletion'  | grep -oE '^[0-9]+' | head -1)
                  [ -z "$a" ] && a=0; [ -z "$d" ] && d=0
                  ut=$(git -C "$repo_root" ls-files --others --exclude-standard -z -- "$gen_excl" 2>/dev/null \
                      | xargs -0 grep -Ihc '' 2>/dev/null | awk '{s+=$1} END{print s+0}')
                  [ -z "$ut" ] && ut=0
                  printf 'add=%s\ndel=%s\n' "$((a+ut))" "$d" > "$loc_cache" 2>/dev/null
                ) >/dev/null 2>&1 </dev/null &
                disown 2>/dev/null
            fi
        fi
        [ -f "$loc_cache" ] && . "$loc_cache"
        [ -z "$add" ] && add=0
        [ -z "$del" ] && del=0
    fi


    if [ "$ENABLE_LOC_CHANGES" = "TRUE" ] && [ "$add" -eq 0 ] && [ "$del" -eq 0 ]; then
        # Only show "no changes" when there are also no file-level changes at all
        if [ -z "$status_out" ]; then
            seg "${DIM}no changes${R}"
        fi
    elif [ "$ENABLE_LOC_CHANGES" = "TRUE" ]; then
        loc=""
        [ "$add" -gt 0 ] && loc+="${GREEN}+$(compact_count "$add")${R}"
        [ "$add" -gt 0 ] && [ "$del" -gt 0 ] && loc+=" "
        [ "$del" -gt 0 ] && loc+="${RED}-$(compact_count "$del")${R}"
        seg "  $loc"
    fi

    # Staged-files indicator at the very end of the git segment, dim
    if [ "$ENABLE_FILE_CHANGES" = "TRUE" ] && [ -n "$status_out" ]; then
        staged_total=$(echo "$status_out" | grep -cE '^[MADRCU]')
        if [ "$staged_total" -gt 0 ]; then
            plural="s"
            [ "$staged_total" -eq 1 ] && plural=""
            seg "${DIM}($(compact_count "$staged_total") staged change${plural})${R}"
        fi
    fi
fi
