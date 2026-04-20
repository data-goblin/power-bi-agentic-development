# Block npm, suggest bun

A PreToolUse hook that blocks all `npm` commands and tells the agent to use `bun` instead.

## Why

- **Supply chain attacks.** npm runs post-install scripts by default. A compromised package can execute arbitrary code the moment you `npm install` it. Bun does not run post-install scripts by default, eliminating this attack vector.
- **Agent safety.** Agents auto-approve installs. With npm, that means auto-approving arbitrary script execution from every transitive dependency. Bun makes installs safe by default.
- **Speed.** Bun is also significantly faster than npm for installs, which matters in agentic workflows where packages get installed frequently.

## How it works

The hook uses an `if` condition (`Bash(npm *)`) so it only fires when the Bash command starts with `npm`. It outputs a JSON deny decision with `permissionDecision: "deny"`, which prevents the command from running and tells the agent to use bun instead.

## Installation

Copy the hook entry into your `~/.claude/settings.json` under `hooks.PreToolUse`. See `settings.json.example` for the full structure.

If you already have a `PreToolUse` matcher for `Bash`, add the hook object to the existing `hooks` array rather than creating a duplicate matcher.
