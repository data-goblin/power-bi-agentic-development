branch=$(cd "$cwd" 2>/dev/null && git branch --show-current 2>/dev/null)

if [ -z "$branch" ]; then
    seg "${DIM}not tracking${R}"
else
    [ -z "$wt_path" ] && seg "  $branch"

    # PR detection.
    #
    # GitHub: Claude Code populates input.pr.{number,review_state} for us (free).
    # Azure DevOps: not provided by Claude; we detect via the origin URL and
    # query `az repos pr list`. Result is cached on disk so we don't pay the
    # ~2s az roundtrip on every statusline render.
    if [ -z "$pr_number" ]; then
        remote_url=$(cd "$cwd" 2>/dev/null && git remote get-url origin 2>/dev/null)
        if [ -n "$remote_url" ]; then
            CACHE_DIR="${XDG_CACHE_HOME:-$HOME/.cache}/statusline"
            PR_CACHE_TTL=60
            cache_key=$(printf '%s|%s' "$remote_url" "$branch" | sha1sum 2>/dev/null | cut -d' ' -f1)
            cache_file="$CACHE_DIR/pr_${cache_key}"

            # Use cached result if fresh. stat -c is Linux, -f %m is BSD/Mac.
            if [ -f "$cache_file" ]; then
                mtime=$(stat -c %Y "$cache_file" 2>/dev/null || stat -f %m "$cache_file" 2>/dev/null)
                if [ -n "$mtime" ]; then
                    age=$(( $(date +%s) - mtime ))
                    if [ "$age" -lt "$PR_CACHE_TTL" ]; then
                        # shellcheck disable=SC1090
                        . "$cache_file"
                    fi
                fi
            fi

            # Live lookup if cache miss
            if [ -z "$pr_number" ] && [ -z "$pr_lookup_done" ]; then
                case "$remote_url" in
                    *dev.azure.com*|*visualstudio.com*)
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
                            pr_json=$(_timeout 3 az repos pr list \
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
                        ;;
                esac

                # Write cache regardless of outcome -- empty result still saves us from
                # re-running the slow lookup until the TTL expires.
                mkdir -p "$CACHE_DIR" 2>/dev/null
                {
                    printf 'pr_number=%q\n' "${pr_number}"
                    printf 'pr_review=%q\n' "${pr_review}"
                    printf 'pr_url=%q\n'    "${pr_url}"
                    echo 'pr_lookup_done=1'
                } > "$cache_file" 2>/dev/null
            fi
        fi
    fi

    if [ -n "$pr_number" ]; then
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
    unpushed=$(cd "$cwd" 2>/dev/null && git rev-list --count @{u}..HEAD 2>/dev/null)
    [ -z "$unpushed" ] && unpushed=0
    if [ "$unpushed" -gt 0 ]; then
        plural="s"
        [ "$unpushed" -eq 1 ] && plural=""
        seg "  $unpushed commit$plural"
    fi

    # File-level counts from `git status --porcelain`, categorised by INTENT.
    # Untracked directories ("?? dir/") are expanded via find -maxdepth 2
    # to get the real file count without the cost of -uall on huge trees.
    status_out=$(cd "$cwd" 2>/dev/null && git status --porcelain 2>/dev/null)
    if [ -n "$status_out" ]; then
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
        [ "$added"    -gt 0 ] && file_seg+="${GREEN}?:${added}${R}"
        if [ "$modified" -gt 0 ]; then
            [ -n "$file_seg" ] && file_seg+="  "
            file_seg+="${YELLOW}M:${modified}${R}"
        fi
        if [ "$deleted" -gt 0 ]; then
            [ -n "$file_seg" ] && file_seg+="  "
            file_seg+="${RED}D:${deleted}${R}"
        fi
        [ -n "$file_seg" ] && seg "  $file_seg"
    fi

    # LOC delta: git diff HEAD covers staged+unstaged for tracked files (including deletes);
    # untracked new files are counted separately via find + wc -l.
    diff_stat=$(cd "$cwd" 2>/dev/null && git diff HEAD --shortstat 2>/dev/null)
    add=$(echo "$diff_stat" | grep -oE '[0-9]+ insertion' | grep -oE '^[0-9]+' | head -1)
    del=$(echo "$diff_stat" | grep -oE '[0-9]+ deletion'  | grep -oE '^[0-9]+' | head -1)
    [ -z "$add" ] && add=0
    [ -z "$del" ] && del=0

    # Count lines in untracked files (new content not in git diff)
    untracked_lines=0
    while IFS= read -r line; do
        [ -z "$line" ] && continue
        code="${line:0:2}"
        fpath="${line:3}"
        if [ "$code" = "??" ]; then
            full="$cwd/$fpath"
            case "$fpath" in
                */) n=$(find "$full" -maxdepth 2 -type f -print0 2>/dev/null | xargs -0 wc -l 2>/dev/null | tail -1 | grep -oE '[0-9]+' | head -1) ;;
                *)  n=$(wc -l < "$full" 2>/dev/null) ;;
            esac
            [ -z "$n" ] && n=0
            untracked_lines=$((untracked_lines + n))
        fi
    done <<< "$status_out"
    add=$((add + untracked_lines))


    if [ "$add" -eq 0 ] && [ "$del" -eq 0 ]; then
        # Only show "no changes" when there are also no file-level changes at all
        if [ -z "$status_out" ]; then
            seg "${DIM}no changes${R}"
        fi
    else
        loc=""
        [ "$add" -gt 0 ] && loc+="${GREEN}+${add}${R}"
        [ "$add" -gt 0 ] && [ "$del" -gt 0 ] && loc+=" "
        [ "$del" -gt 0 ] && loc+="${RED}-${del}${R}"
        seg "  $loc"
    fi

    # Staged-files indicator at the very end of the git segment, dim
    if [ -n "$status_out" ]; then
        staged_total=$(echo "$status_out" | grep -cE '^[MADRCU]')
        if [ "$staged_total" -gt 0 ]; then
            plural="s"
            [ "$staged_total" -eq 1 ] && plural=""
            seg "${DIM}(${staged_total} staged change${plural})${R}"
        fi
    fi
fi
