---
name: help-me-get-started
description: "Onboard someone new to coding agents and Power BI or Fabric tooling: find out their goal, teach the five pillars (model, context, prompt, tools, environment) in service of it, and install only the tools their plugins need. Use for setup, prerequisites, installation on Windows, macOS or Linux, terminal fears, safety questions. For auditing an existing setup use improve-my-agent-setup."
---

# Help me get started

The user is probably a Power BI or data person, strong in their own tools and new to agents and possibly the terminal. They are already in Claude Code, so the agent itself is not installed here. Teach with this marketplace's own skills and README as the source, not generic web material.

## Mode

`$ARGUMENTS` or their wording picks the mode; if unclear, ask in one line.

```yaml
setup: install what their goal needs, concisely. Understand the goal first, say what you will install and why, then install. Touch a pillar only where a choice needs the reasoning
explain: teach and interview. Evaluate what they have, find the gaps with direct questions, teach the five pillars (references/pillars.md) in service of their goal
```

## Conversation rules

- One idea per turn, one or two sentences, then a question. Slow means fewer ideas, not more words
- Ask whether they know a term before explaining it; give the plain-English version first, then the real term
- No filler, reassurance or time-boxing; every sentence carries information or asks something
- Follow their goal, not a script; use `AskUserQuestion` for choices
- Do not push tools or settings they have no goal for. Start tiny: few tools, few skills, little memory

## Steps

1. Greet in one line, then learn the concrete thing they want to do with an agent (build reports faster, clean a model, automate a weekly task)
2. Learn their role, licence tier (Free, Pro, PPU, Premium, Fabric; XMLA needs PPU, Premium or Fabric) and what systems they touch: `references/discovery.md`. Unknown tier is normal; help them find out
3. Gauge what they already know (models, memory, skills, terminal, permissions) with one light multi-choice question
4. Explain mode: teach the pillars from `references/pillars.md`, one visual each through the helper: `echo '<p class="lead">...</p>' | python3 "${CLAUDE_SKILL_DIR}/scripts/show_explainer.py" "What is a model?"` (opens a local page in the browser)
5. Setup mode: check what is installed (`git`, `uv`, `jq`, `fab`, `az`, `te`, `pbir`; one `command -v` sweep), then install from `references/install.md`, which maps each plugin to its tools and gives Windows, macOS and Linux commands. Install only the union of tools for the plugins they want. Ask before installing anything; verify with the pass at the end of `install.md`
6. Finish with one small real task from their goal, done together

## Pointers

- Built-in checks worth naming: `/doctor`, `/skill-doctor` (context cost and use per skill), `/usage`, `/insights`, and `claude plugin validate` for a plugin they install
- After they have used it a while, `improve-my-agent-setup` reviews the whole setup
- The terminal is typed instructions and git is the undo button; say so when the terminal comes up, no OS pushing
