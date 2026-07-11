# pbiad

`pbiad` is the Rust CLI for installing and recommending the resources in this
marketplace for agentic Power BI development.

The source lives in `tools/pbiad/` in this repository.

The binary intentionally does not embed a frozen copy of the skills. A released
binary can fetch the latest marketplace from
`data-goblin/power-bi-agentic-development`, cache it locally, and install from
that cache. Use `--ref` to pin a branch, tag, or release when stability matters.

```bash
pbiad skills list
pbiad skills list --agent codex -v
pbiad skills recommend
pbiad skills setup
pbiad skills setup --recommend
pbiad skills add pbir-cli --agent codex --agent opencode
pbiad skills open pbir-cli
pbiad plugins setup
pbiad plugins setup --recommend
pbiad plugins add reports --agent codex
pbiad skills doctor
pbiad memory --agent claude-code --project-only
pbiad statusline setup
```

## Distribution model

The intended release path is:

1. Build and publish `pbiad` binaries on GitHub Releases.
2. Keep skills, hooks, and subagents in this repository as the source of truth.
3. At runtime, resolve a registry source:
   - local repo if the command is run from this checkout,
   - otherwise a cached clone of `data-goblin/power-bi-agentic-development`,
   - optionally pinned with `--ref`.
4. Install only the selected plugins/resources into each target agent.

This keeps old CLI binaries useful while the weekly marketplace release cadence
continues.

## Agent support

`pbiad` treats each agent as an adapter. It follows the broad `skills.sh`
agent-path matrix for basic skill installs, including Antigravity CLI (`agy`),
Hermes Agent, and Pi (`.pi/skills` and `~/.pi/agent/skills`), while keeping
special handling for agents with native plugin or subagent formats.

| Agent | Skills | Hooks | Subagents |
| --- | --- | --- | --- |
| Claude Code | direct skill symlink or native plugin install | native plugin install | native plugin install |
| Copilot CLI | direct skill symlink or native plugin install | native plugin install | native plugin install |
| Codex | symlink to `.agents/skills` | planned translator | convert to `.codex/agents/*.toml` |
| OpenCode | symlink to `.opencode/skills` | planned plugin translator | convert to `.opencode/agents/*.md` |
| Other skills.sh-compatible agents | symlink to each agent's skill root | skipped unless native support is added | skipped unless native support is added |

Hooks are deliberately conservative for Codex and OpenCode because their hook
schemas are not identical to Claude/Copilot plugin hooks. The CLI reports that
instead of silently installing incompatible lifecycle config.

## Skill vs plugin installs

`pbiad skills setup` manages individual skills. Installed skills are shown by
scope; each skill can be set to project, user, or none. Moving a skill from user
to project removes the old user install, and setting it to none removes managed
installs. Recommendations are opt-in with `--recommend`.

`pbiad skills add <skill>` installs only that skill into the selected agent's
native skill directory. Plugin bundle names are rejected here; use
`pbiad plugins add <plugin>`.

`pbiad plugins add <plugin>` installs the plugin bundle. For Claude Code and
Copilot CLI, this uses the native marketplace/plugin install command so hooks
and subagents stay attached. For Codex and OpenCode, `pbiad` symlinks all skills
and converts subagents, while skipping hooks until translators are tested.

`pbiad plugins setup` manages whole plugin bundles. Like skills setup, detected
recommendations are only used when `--recommend` is passed.

## Statusline setup

`pbiad statusline setup` configures the bundled Claude Code statusline. Claude
Code is the only enabled statusline target today; other agents can be added when
their statusline APIs are stable enough to support.

The interactive setup flow asks for:

- the agent, currently Claude Code only
- user or project settings
- whether to show time and folder
- Git metrics: branch, unpushed commits, pulls waiting, tracked files, and LOC
  changes
- model details: model family, model version, and effort
- usage limits: context window, 5-hour limit, and weekly limit
- limit visualization: label only, 20% increment bars, full bars to 100%, or
  thin bars to 100%
- OSC 8 interactions: click to open filepath, click to open lazygit, and click
  to show reset datetimes

The command copies `useful-stuff/status-lines/` into a managed
`pbiad-statusline` directory, writes `statusline.config.sh` with the selected
components, and updates Claude's `statusLine` setting to run the copied script.

## Detection and memory

`pbiad skills setup` preselects agents from installed commands and project-level
agent resources. It does not label options as recommended; project/user/none
state is shown directly in the tree.

`pbiad doctor` shows detected agents, project signals, Power BI tooling, and a
summary of memory/rules token load. Use `--all-agents` to show every supported
agent adapter.

`pbiad skills open [skill]` opens the source `SKILL.md`, using `$VISUAL`,
`$EDITOR`, or the OS opener.

`pbiad skills list` shows a compact tree grouped by project/user scope and
plugin bundle. Skill descriptions are hidden by default; use `--verbose` or
`-v` to show descriptions, paths, and project/user install counts. Use
`--agent codex` or repeat `--agent` to audit explicit agents.

`pbiad memory` lists memory, rules, instruction, and prompt files with an
approximate token count, sorted largest first. It intentionally excludes agent
settings and config files. Use `--agent claude-code` to audit one agent, or omit
`--agent` in an interactive terminal to pick agents in the TUI. Add `--open` to
pick and open a detected file.
