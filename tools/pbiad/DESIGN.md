# pbiad Design Notes

## Name

The repo remains `power-bi-agentic-development`; the binary is `pbiad`.

`pbiad` is short enough for daily CLI use and still expands cleanly to
Power BI Agentic Development.

## UX References

- shadcn CLI: registry-driven `add`, prompt-based multiselect, dry-run friendly
  behavior, clear summaries.
- Vercel CLI: project-aware recommendations, setup/link/status/doctor mental
  model, JSON output for automation.
- Vercel Labs `skills` / skills.sh: broad agent-path compatibility, automatic
  agent detection, project/global install scopes, and symlink-first installs.
- Local Rust CLIs:
  - `pbirust`: thin `clap` entry point, command modules, stable text/json output
    contracts, integration-testable CLI behavior.
  - `fit-cli`: `agent-setup` precedent, provider/tool detection, `indicatif`
    and `clap_complete` usage.
  - `tmdl-validate` and `camera-hub-ctl`: pragmatic single-binary utilities
    with direct `anyhow` error handling.

## Registry Model

The marketplace already has the right source of truth:

- `.claude-plugin/marketplace.json`
- `plugins/*/.claude-plugin/plugin.json`
- `plugins/*/skills/*/SKILL.md`
- `plugins/*/agents/*.agent.md`
- `plugins/*/hooks/hooks.json`

`pbiad` reads those files directly. Extra `pbiad.toml` files can be added later
for recommendation metadata, but the first version avoids duplicating registry
data.

The Rust CLI source lives under `tools/pbiad/`.

## Latest Skills From Releases

The binary should not embed marketplace content. Released binaries can stay
small and fetch the latest repo content at runtime:

```bash
pbiad skills setup --source latest
pbiad skills setup --source latest --ref v26.26.1
```

Implementation:

1. Prefer a local checkout when run from this repo.
2. Fall back to a cached clone of
   `https://github.com/data-goblin/power-bi-agentic-development.git`.
3. Refresh with `--refresh`.
4. Pin with `--ref` when users want stability.

This matches the repo's weekly release cadence without requiring a new binary
for every skills update.

## Agent Adapter Rules

Claude Code and Copilot CLI can consume this repo as a native plugin
marketplace, so `pbiad` should prefer their plugin install commands when the
user selects a plugin. That keeps skills, hooks, and subagents together.

When the user selects a single skill, `pbiad` installs only that skill through
the agent's native skill directory:

- Claude Code project: `.claude/skills/<skill>/SKILL.md`
- Claude Code user: `~/.claude/skills/<skill>/SKILL.md`
- Copilot CLI project: `.github/skills/<skill>/SKILL.md`
- Copilot CLI user: `~/.copilot/skills/<skill>/SKILL.md`

Codex and OpenCode support the same skill shape directly, so `pbiad` symlinks
skill directories:

- Codex project: `.agents/skills/<skill>/SKILL.md`
- Codex user: `~/.agents/skills/<skill>/SKILL.md`
- OpenCode project: `.opencode/skills/<skill>/SKILL.md`
- OpenCode user: `~/.config/opencode/skills/<skill>/SKILL.md`

Subagents are converted:

- Codex: `.codex/agents/<plugin>-<agent>.toml`
- OpenCode: `.opencode/agents/<plugin>-<agent>.md`

Hooks are intentionally conservative. Claude/Copilot plugin hooks are not the
same as Codex/OpenCode hook/plugin schemas, so the first version reports them
as skipped for those agents until a tested translator exists.

The broader skills.sh-compatible adapter table is metadata-driven in
`src/agents.rs`. Generic adapters install skills only, using each agent's
documented project/global skill roots. Pi is included with `.pi/skills` for
project installs and `~/.pi/agent/skills` for user installs. Antigravity CLI is
detected with `agy` first, with older Antigravity command names retained as
aliases. Hermes Agent is included in the primary setup picker group.

## Detection Surface

Setup should not tell the user what is "recommended" in option labels, and it
should not apply recommendations unless `--recommend` is passed. Skill setup
should manage individual skills, while plugin setup should manage whole plugin
bundles. The skill setup flow should:

1. Detect installed agent commands and project-level agent resources.
2. Preselect those detected agents.
3. Show state as hints, such as found, project skills, or project subagents.
4. Show each plugin as an expanded/collapsible tree node.
5. Show each individual skill with project/user/none placement.
6. Treat the placement as final desired state: project/user installs or moves
   the skill, and none removes managed installs.

The default install scope is project when a Power BI project, Git checkout, or
project-level agent resources are detected; otherwise it falls back to user
scope for non-project directories.

The setup tree uses `●` for project, `◆` for user, and `○` for none. Plugin
headers use a caret and can be collapsed with space; enter applies the current
state. `pbiad skills list --verbose` keeps the older detailed view with
descriptions, source paths, and project/user install counts.

Parked for later: a persisted `pbiad config` source manager and optional local
skill-store repo are noted in the gitignored root `AGENTS.md`.

## Memory and Rules

The memory view scans common project and user files:

- `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, `CONVENTIONS.md`
- `.claude/rules`, `.github/instructions`, `.github/prompts`
- `.cursor/rules`, `.windsurf/rules`, `.kiro/steering`, `.roo/rules`

Token counts are approximate and intentionally cheap: bytes divided by four,
rounded up. The goal is quick visibility into prompt load, not tokenizer-perfect
accounting. Entries are sorted largest first, and agent settings/config files
are intentionally excluded.

Memory listing supports `--agent <agent>` for scripted audits. In interactive
terminals, omitting `--agent` shows an agent picker. Shared files are included
with every selected agent so agent-specific audits still include common project
instructions.
