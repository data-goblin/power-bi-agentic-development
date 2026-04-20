# Block destructive commands

PreToolUse hooks that block dangerous Bash commands while still allowing normal operations.

## What's blocked

| Pattern | Why |
|---------|-----|
| `rm -rf ~/` / `rm -rf $HOME` / `rm -rf /` | Nuking your home or root directory |
| `git push --force` to main/master | Overwriting shared history; use `--force-with-lease` |
| `git reset --hard` | Discards uncommitted work silently |
| `chmod 777` | World-writable permissions; security risk |

## What's NOT blocked

- `rm -rf ./node_modules` or any project-relative path -- agents can still clean up
- `rm file.txt` -- normal file deletion is fine
- `git push --force` to feature branches -- only main/master is protected
- `git reset --soft` / `git reset --mixed` -- only `--hard` is blocked

## Design philosophy

These hooks are deliberately narrow. They block the specific catastrophic patterns but don't interfere with normal agent cleanup work. An agent that needs to `rm -rf node_modules` or `rm -rf dist/` can still do so.

The `if` conditions use glob matching against the Bash command string, so they fire before the command executes. No subprocess spawns for non-matching commands.

## Installation

Copy the hook entries from `settings.json.example` into your `~/.claude/settings.json` under `hooks.PreToolUse`.

If you already have a `PreToolUse` matcher for `Bash`, add the hook objects to the existing `hooks` array.
