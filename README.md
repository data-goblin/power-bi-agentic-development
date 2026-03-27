<h1 align="center">power-bi-agentic-development</h1>

<p align="center">
  A marketplace for skills and tools for agentic Power BI development
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-0.8.5-blue" alt="Version">
  <img src="https://img.shields.io/badge/tabular_editor-2%20%7C%203-orange" alt="Tabular Editor">
  <img src="https://img.shields.io/badge/license-GPL--3.0-green" alt="License">
</p>

> **These skills are under active development with a daily release cadence.** Breaking changes, new skills, and restructuring may occur frequently.

---

## Installation

These skills are intended for use in Claude Code, Desktop, or Cowork. However, you can use them in other tools, if you wish, like Codex, Gemini CLI, or GitHub Copilot.

### Claude Code

Enter the following commands in the terminal:

```bash
# Add marketplace source (if not already added)
claude plugin marketplace add data-goblin/power-bi-agentic-development

# Install plugins
claude plugin install tabular-editor@power-bi-agentic-development
claude plugin install semantic-models@power-bi-agentic-development
claude plugin install pbi-desktop@power-bi-agentic-development
claude plugin install pbip@power-bi-agentic-development
claude plugin install reports@power-bi-agentic-development

# From the Fabric CLI marketplace (separate repo)
claude plugin marketplace add data-goblin/fabric-cli-plugin
claude plugin install fabric-cli-plugin@fabric-cli-plugin
```

### GitHub Copilot

The standalone [Copilot CLI](https://docs.github.com/en/copilot/how-tos/copilot-cli) supports plugin installation from GitHub repos:

```bash
copilot plugin install data-goblin/power-bi-agentic-development
```

In **VS Code**, you can use skills by placing them in `.github/skills/<skill-name>/SKILL.md` with YAML frontmatter:

```yaml
---
name: 'bpa-rules'
description: 'Create and improve Best Practice Analyzer rules for Tabular Editor'
user-invocable: true
---
```

Then paste the skill content below the frontmatter. Skills appear as slash commands in Copilot Chat.

You can also drag any `.md` skill file into Copilot Chat or reference it with `#file` to use as one-off context.

> **Note:** Some plugin features like agents and hooks may behave differently across tools. The core knowledge in the skill files is tool-agnostic.


## Overview

### Skills

| Skill | Plugin | Description |
|-------|--------|-------------|
| [`bpa-rules`](plugins/tabular-editor/skills/bpa-rules/) | tabular-editor | Create and improve Best Practice Analyzer rules |
| [`c-sharp-scripting`](plugins/tabular-editor/skills/c-sharp-scripting/) | tabular-editor | C# scripting and macros for Tabular Editor (CRUD of model objects and common patterns for streamlining model dev) |
| [`te2-cli`](plugins/tabular-editor/skills/te2-cli/) | tabular-editor | Tabular Editor 2 CLI usage and automation |
| [`te-docs`](plugins/tabular-editor/skills/te-docs/) | tabular-editor | Tabular Editor documentation search, TE3 config files (.tmuo, preferences) |
| [`connect-pbid`](plugins/pbi-desktop/skills/connect-pbid/) | pbi-desktop | Connect to PBI Desktop's local AS instance via TOM and ADOMD.NET |
| [`tmdl`](plugins/pbip/skills/tmdl/) | pbip | Author and edit TMDL files directly in PBIP projects |
| [`pbip`](plugins/pbip/skills/pbip/) | pbip | Power BI Project (PBIP) format, structure, and file types |
| [`pbir-format`](plugins/pbip/skills/pbir-format/) | pbip | Skill for working with PBIR metadata files (visual.json, report.json, themes, filters, report extensions / thin measures, visual calculations) |
| [`pbi-report-design`](plugins/reports/skills/pbi-report-design/) | reports | Power BI report design principles, layout, KPI/card/table patterns |
| [`deneb-visuals`](plugins/reports/skills/deneb-visuals/) | reports | Deneb custom visuals with Vega and Vega-Lite specs |
| [`r-visuals`](plugins/reports/skills/r-visuals/) | reports | R script visuals (ggplot2) in Power BI reports |
| [`python-visuals`](plugins/reports/skills/python-visuals/) | reports | Python script visuals (matplotlib/seaborn) in Power BI reports |
| [`svg-visuals`](plugins/reports/skills/svg-visuals/) | reports | SVG visuals via DAX measures in Power BI reports |

### Commands

> In Claude Code, slash commands and skills have coalesced. Commands are simply more prescriptive workflows, but they take the same structure as a skill. Skills are not workflows nor should they be prescriptive.

| Command | Plugin | Description |
|---------|--------|-------------|
| [`/suggest-rule`](plugins/tabular-editor/commands/suggest-rule.md) | tabular-editor | Generate BPA rules from descriptions |
| [`/standardize-naming-conventions`](plugins/semantic-models/skills/standardize-naming-conventions/) | semantic-models | Audit and standardize naming conventions in semantic models |

### Agents

> Subagents have isolated context windows and are appropriate for tasks that benefit from this isolation. Agents are not for specialization or enhancing context; that is the purview of a skill usable by your main agent _or_ a subagent.

| Agent | Plugin | Description |
|-------|--------|-------------|
| [`bpa-expression-helper`](plugins/tabular-editor/agents/bpa-expression-helper.md) | tabular-editor | Debug and improve BPA rule expressions |
| [`pbip-validator`](plugins/pbip/agents/pbip-validator.md) | pbip | Validate PBIP project structure, TMDL syntax, and PBIR schemas |
| [`query-listener`](plugins/pbi-desktop/agents/query-listener.md) | pbi-desktop | Listen to query traces from Power BI Desktop visuals in real time |
| [`deneb-reviewer`](plugins/reports/agents/deneb-reviewer.md) | reports | Review Deneb visual specs for Vega/Vega-Lite syntax and conventions |
| [`svg-reviewer`](plugins/reports/agents/svg-reviewer.md) | reports | Review SVG DAX measures for syntax and design quality |
| [`r-reviewer`](plugins/reports/agents/r-reviewer.md) | reports | Review R visual scripts (ggplot2) for Power BI conventions |
| [`python-reviewer`](plugins/reports/agents/python-reviewer.md) | reports | Review Python visual scripts (matplotlib/seaborn) for Power BI conventions |


## Related Projects

- [fabric-cli-plugin](https://github.com/data-goblin/fabric-cli-plugin) - Microsoft Fabric CLI skills and MCP servers
- [TabularEditor/BestPracticeRules](https://github.com/TabularEditor/BestPracticeRules) - Standard BPA rule collections
- **pbir-cli** (not yet released) - CLI tool for PBIR report operations (create, validate, modify). Some skills in the `reports` plugin reference `pbir` CLI commands that will become available when this tool is released. In the meantime, use direct JSON editing with the `pbir-format` skill from the `pbip` plugin.


## Use or re-use of these skills

These skills are intended for free community use.

You do not have the license to copy and incorporate them into your own products, trainings, courses, or tools. If you copy these skills - manually or by using an agent to rewrite them - you must include attribution and a link to this original project.


<br>

---

<p align="center">
  <em>Built with assistance from <a href="https://claude.ai/claude-code">Claude Code</a>. AI-generated code has been reviewed but may contain errors. Use at your own risk.</em>
</p>

<p align="center">
  <em>Context files are human-written and revised by Claude Code after iterative use.</em>
</p>

---

<p align="center">
  <a href="https://github.com/data-goblin">Kurt Buhler</a> · <a href="https://data-goblins.com">Data Goblins</a> · part of <a href="https://tabulareditor.com">Tabular Editor</a>
</p>
