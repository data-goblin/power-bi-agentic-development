# Block pip/pip3, suggest uv

A PreToolUse hook that blocks `pip` and `pip3` commands and tells the agent to use `uv` instead.

## Why

- **Environment pollution.** pip installs packages globally or into whatever environment happens to be active. Agents often don't activate the right venv first, polluting the system Python. uv manages environments explicitly and creates them automatically.
- **Reproducibility.** pip doesn't lock dependencies by default. uv creates lockfiles and uses them, making builds reproducible.
- **Speed.** uv is 10-100x faster than pip for resolves and installs, which matters in agentic workflows.
- **Supply chain.** uv supports hash verification out of the box, reducing the risk from compromised packages.

## How it works

Two `if` conditions (`Bash(pip *)` and `Bash(pip3 *)`) catch both variants. Each outputs a JSON deny decision telling the agent to use uv instead.

## Installation

Copy the hook entries into your `~/.claude/settings.json` under `hooks.PreToolUse`. See `settings.json.example` for the full structure.

If you already have a `PreToolUse` matcher for `Bash`, add the hook objects to the existing `hooks` array rather than creating a duplicate matcher.
