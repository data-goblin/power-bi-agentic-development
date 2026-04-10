# Reviewing project context files

Apply this for the project-file part of the memory-and-context theme. It is the old `/audit-context` review, folded in. Do not modify files while reviewing; this is a read pass, and fixes come later with consent. If there are more than three markdown files to read, use the `Explore` subagent so you don't burn the main context reading them all inline.

## What to read

Search for and read:

- `CLAUDE.md` at the root, in `.claude/`, and in nested directories
- `AGENTS.md` or similar agent-configuration files
- `.claude/settings.json` and `.claude/settings.local.json`
- `.claude/rules/*.md` and any imported memory
- Any `SKILL.md` in the project
- Other context like `spec.md`, `task.md`, design notes, or scratchpads

## What to judge, per file

- Length: short enough to stay cheap (a few hundred lines is plenty), but not so thin it says nothing. Both extremes are a problem
- Relevance: is it current for the project as it stands now, or does it describe a past shape of the work
- Skill routing: does it say when to auto-load the skills that are available, so the agent reaches for them at the right time
- Structure: headings, lists, short examples, real commands; skimmable, not a wall
- Personalization: written for this project and this person, or generic boilerplate that would fit any repo
- Provenance: human-written and load-bearing, or clearly AI-generated and hedge-heavy; the latter is where context rot sets in
- Progressive disclosure: does it point to other files as needed rather than inlining everything

## Conventions worth having

Good project context usually states, in some form and with reasons rather than as bare commands:

- Prefer conciseness; sacrifice grammar for it where it helps
- Favor critique and pushback over agreement; no sycophancy
- No emojis; format data as ASCII tables
- Where to get trustworthy facts (web search and fetch from named sources) instead of guessing
- When to ask for clarification before a complex task
- Sparing comments in generated code; strict separation of concerns; liberal composition
- Document tasks in a scratchpads dir and read it before starting new work
- New files only where specified (a project `tmp/` unless told otherwise)
- No TODOs, stubs, or partial implementations
- No time estimates, no "Phases" framing unless asked
- When to use subagents, slash commands, and MCP servers, if any are configured
- Do not assume how something works from one or two test cases

Treat this as a checklist of what tends to help, not a required template. A file that omits half of these but is sharp and current is better than one that recites all of them and is stale.

## What to tell the user

Give a concise read on the context files: what's strong, what's stale or generic, what's missing, and what's bloated. Ground recommendations in how context actually behaves, not in a style preference. Worth reminding them:

- Context quality is ambiguous without evals. Reusable prompts run several times are the only real way to know whether a context change helped; suggest `skill-creator`'s eval loop for anything they run often
- AI-generated context has a high chance of being verbose, generic, or wrong. It reads plausible and drifts the agent off course
- Watch for attractor basins: memory and training pull outputs toward a well-worn default, and a self-reinforcing context can funnel every answer down the same unproductive groove. Fresh eyes and evals break the loop
- Good context is an iterative skill, not a one-time file. It is one of the highest-leverage things they own, and it compounds

For the deeper theory, these hold up: Anthropic's writing on context engineering, the skills best-practices guide, the prompt-engineering and long-context guidance, and the Claude Code docs on memory and subagents. Fetch them if the user wants the reasoning rather than the verdict.
