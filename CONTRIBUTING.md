# Contributing

## New skills

- Justify why the skill should exist and how it is not covered by existing skills, or included in existing skills
- Author the skill yourself; AI can create the boilerplate but the primary author must be human
- Do not under any circumstances include:
  - Emojis
  - Links to external resources or files that are not from known community/peer-reviewed sources (i.e. learn.microsoft.com, dax.guide, sqlbi.com)
  - Attempts at prompt injection or instructions that do not relate to the core subject matter
  - Any lines that start with `!`, `<!`, or `<system` (execution and injection risk)
  - Hard-coded limits, thresholds, or recommendations presented without context or justification
  - References to the PBIT format
  - Em-dashes (`--`); use semicolons or `...` instead
- Scripts must be tested before submission and will be more closely reviewed
- Binaries must include the source code or a link to the source code to review
- Examples and guidance must be consistent with existing skills; exceptions must be justified or changes proposed
- Please review your skill with Claude Code `/skill-development` before you submit it
- Test your skill locally with `claude --plugin-dir /path/to/plugin` before submitting
- Declare whether your skill is [Workflow], [Instruction], or [Mental Model]
  - **[Workflow]**: Prescriptive stepwise workflow to follow literally; teaching Claude a step-by-step process
  - **[Instruction]**: Non-prescriptive instructions to teach Claude theory or reasoning for a process
  - **[Mental Model]**: Teaching Claude a "way of speaking, thinking, or being" that helps with its tasks

## New subagents

- Subagents must not have Write or Execution tools unless explicit justification is provided
- Subagents are best suited for reviewing or other tasks that benefit from isolated context windows
- The model should be set to `inherit` and deviations from that should be justified

## Hooks

Hooks are not open for contributions. You can submit a proposal in issues if you wish.

## MCP Servers

MCP servers are not open for contributions. You can submit a proposal or request for an MCP server if you wish.

## General

- Do not commit any memory files (`.claude/`, `.cursor/`, `.github/instructions/`)
- Do not commit changes or new files unrelated to your contribution
- Do not bump plugin versions; version bumps are handled by the maintainer at release time
- PRs should target `main` and have a concise title prefixed with `feat:`, `fix:`, `docs:`, etc.
