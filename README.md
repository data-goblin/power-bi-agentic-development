<h1 align="center">power-bi-agentic-development</h1>

<p align="center">
  A marketplace for skills and tools for agentic Power BI development
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-0.7.0-blue" alt="Version">
  <img src="https://img.shields.io/badge/tabular_editor-2%20%7C%203-orange" alt="Tabular Editor">
  <img src="https://img.shields.io/badge/license-GPL--3.0-green" alt="License">
</p>

---

## Installation

These skills are intended for use in Claude Code, Desktop, or Cowork. However, you can use them in other tools, if you wish, like Codex, Gemini CLI, or GitHub Copilot.

To install these skills in Claude Code, enter the following commands in the terminal:

```bash
# Add marketplace source (if not already added)
claude plugin marketplace add data-goblin/power-bi-agentic-development

# Install plugins
claude plugin install tabular-editor@power-bi-agentic-development
claude plugin install pbi-desktop@power-bi-agentic-development
claude plugin install pbip@power-bi-agentic-development

# From the Fabric CLI marketplace (separate repo)
claude plugin marketplace add data-goblin/fabric-cli-plugin
claude plugin install fabric-cli-plugin@fabric-cli-plugin
```


## Overview

### Skills

| Skill | Plugin | Description |
|-------|--------|-------------|
| [`bpa-rules`](plugins/tabular-editor/skills/bpa-rules/) | tabular-editor | Create and improve Best Practice Analyzer rules |
| [`c-sharp-scripting`](plugins/tabular-editor/skills/c-sharp-scripting/) | tabular-editor | C# scripting for Tabular Editor (TOM API, LINQ, WinForms) |
| [`c-sharp-macros`](plugins/tabular-editor/skills/c-sharp-macros/) | tabular-editor | Tabular Editor macro development |
| [`tabular-editor-cli`](plugins/tabular-editor/skills/tabular-editor-cli/) | tabular-editor | Tabular Editor CLI usage and automation |
| [`tabular-editor-config`](plugins/tabular-editor/skills/tabular-editor-config/) | tabular-editor | TE3 config files (TMUO, preferences, BPA settings) |
| [`tabular-editor-docs`](plugins/tabular-editor/skills/tabular-editor-docs/) | tabular-editor | Local search of Tabular Editor documentation |
| [`connect-pbid`](plugins/pbi-desktop/skills/connect-pbid/) | pbi-desktop | Connect to PBI Desktop's local AS instance via TOM and ADOMD.NET |
| [`tmdl`](plugins/pbip/skills/tmdl/) | pbip | Author and edit TMDL files directly in PBIP projects |
| [`pbip`](plugins/pbip/skills/pbip/) | pbip | Power BI Project (PBIP) format, structure, and file types |
| [`pbir-format`](plugins/pbip/skills/pbir-format/) | pbip | Skill for working with PBIR metadata files (visual.json, report.json, themes, filters, expressions) |

### Commands

| Command | Plugin | Description |
|---------|--------|-------------|
| [`/suggest-rule`](plugins/tabular-editor/commands/suggest-rule.md) | tabular-editor | Generate BPA rules from descriptions |

### Agents

| Agent | Plugin | Description |
|-------|--------|-------------|
| [`bpa-expression-helper`](plugins/tabular-editor/agents/bpa-expression-helper.md) | tabular-editor | Debug and improve BPA rule expressions |


## Related Projects

- [fabric-cli-plugin](https://github.com/data-goblin/fabric-cli-plugin) - Microsoft Fabric CLI skills and MCP servers
- [TabularEditor/BestPracticeRules](https://github.com/TabularEditor/BestPracticeRules) - Standard BPA rule collections


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
