<p align="center">
  <img src="media/bg42-11-3.png" alt="" width="800">
</p>

<h1 align="center">power-bi-agentic-development</h1>

<p align="center">
  The best source for agentic development resources for Power BI in one marketplace <br/>
  <i> Teach agents like Claude Code or GitHub Copilot to do literally anything in Power BI </i>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-0.22.4-blue" alt="Version">
  <img src="https://img.shields.io/badge/Power_BI-F2C811?logo=powerbi&logoColor=000" alt="Power BI">
  <img src="https://img.shields.io/badge/Microsoft_Fabric-008272" alt="Microsoft Fabric">
  <img src="https://img.shields.io/badge/Tabular_Editor-2E7D32" alt="Tabular Editor">
  <img src="https://img.shields.io/badge/license-GPL--3.0-green" alt="License">
</p>

> [!WARNING]
> Under active development with a daily release cadence; regular renaming or restructuring.

---

### What is agentic development?

- *Agentic development* is when you use agents to help you build, manage, and optimize artifacts and software. This includes semantic models, reports, and the things around them, like workspaces, deployment pipelines, and also processes.
- A *marketplace* hosts *plugins* that you can install. Plugins are a collection of resources that help coding agents perform better. They are typically special instruction files and scripts. Plugins can contain skills, subagents, hooks, and MCP servers focused on special topics or tasks.
- This marketplace is focused on everything to help your agent work well with Power BI and Fabric! Read further for more information.

## Installation

Here's how you get started in Claude Code; run this in the terminal to get the marketplace: 

```bash
claude plugin marketplace add data-goblin/power-bi-agentic-development
```

### Example: Using the pbir-cli with the skills

[Click here for a YouTube walkthrough](https://www.youtube.com/watch?v=acHDorTi62U)

[![pbir-cli demo](https://img.youtube.com/vi/acHDorTi62U/maxresdefault.jpg)](https://www.youtube.com/watch?v=acHDorTi62U)

<details>
<summary><strong>Claude Code</strong></summary>

Add the marketplace, then install plugins via `/plugin` and navigating to the installed marketplace.

<table>
<tr>
<td align="center"><img src="media/marketplace-ui.png" alt="Marketplace UI" width="400"></td>
<td align="center"><img src="media/marketplace-auto-update.png" alt="Marketplace auto-update" width="400"></td>
</tr>
<tr>
<td align="center"><em>Install plugins from the marketplace</em></td>
<td align="center"><em>Enable marketplace auto-update</em></td>
</tr>
</table>

Alternative; add plugins via command line:

```bash
claude plugin install tabular-editor@power-bi-agentic-development
claude plugin install pbi-desktop@power-bi-agentic-development
claude plugin install semantic-models@power-bi-agentic-development
claude plugin install reports@power-bi-agentic-development
claude plugin install pbip@power-bi-agentic-development
claude plugin install fabric-cli@power-bi-agentic-development
```

</details>

<details>
<summary><strong>GitHub Copilot</strong></summary>

The standalone [Copilot CLI](https://docs.github.com/en/copilot/how-tos/copilot-cli) supports plugin installation from GitHub repos. Consult the Copilot documentation for specifics, or open an issue in this repo.

```bash
copilot plugin install data-goblin/power-bi-agentic-development
```

Some plugin features like agents and hooks may behave differently across tools. The core knowledge in the skill files is tool-agnostic.

</details>


## Overview

The repo contains skills, agents, and hooks.

- **Skills** teach agents domain knowledge and workflows. They activate automatically based on task context, or can be invoked manually with `/skill-name`. In Claude Code, skills and commands have coalesced; commands are simply more prescriptive skill workflows.
- **Agents** are autonomous subprocesses that handle complex, multi-step tasks independently; typically used for review and validation.
- **Hooks** run automatically after tool use to validate files and catch errors early. They are deterministic; they fire when a specific pattern is matched, not by LLM judgment.

Hook checks can be individually toggled via config files. Set any check to `false` to disable it:
- `plugins/pbip/hooks/config.yaml` -- PBIR, TMDL, and report binding validation
- `plugins/pbi-desktop/hooks/config.yaml` -- DAX references, measure metadata, referential integrity, metadata cache

### Available plugins for Power BI and Fabric

<details>
<summary><img src="media/icons/tabular-editor.svg" alt="" height="20"> <strong>tabular-editor</strong> &ensp; BPA rules, C# scripting, and CLI automation for Tabular Editor</summary>

| Type | Name | Description |
|------|------|-------------|
| Skill | [`bpa-rules`](plugins/tabular-editor/skills/bpa-rules/) | Create and improve Best Practice Analyzer rules for models |
| Skill | [`c-sharp-scripting`](plugins/tabular-editor/skills/c-sharp-scripting/) | C# scripting and macros for TE |
| Skill | [`te2-cli`](plugins/tabular-editor/skills/te2-cli/) | Tabular Editor 2 CLI usage and automation (not TE3) |
| Skill | [`te-docs`](plugins/tabular-editor/skills/te-docs/) | Tabular Editor documentation search, TE3 config files. Uses [`pbi-search`](https://github.com/data-goblin/pbi-search) CLI |
| Command | [`/suggest-rule`](plugins/tabular-editor/commands/suggest-rule.md) | Generate BPA rules from descriptions |
| Agent | [`bpa-expression-helper`](plugins/tabular-editor/agents/bpa-expression-helper.md) | Debug and improve BPA rule expressions |

</details>

<details>
<summary><img src="media/icons/pbi-desktop.svg" alt="" height="20"> <strong>pbi-desktop</strong> &ensp; Connect to, query, and modify models in Power BI Desktop</summary>

| Type | Name | Description |
|------|------|-------------|
| Skill | [`connect-pbid`](plugins/pbi-desktop/skills/connect-pbid/) | Explore, query, and modify a model in Power BI Desktop |
| Agent | [`query-listener`](plugins/pbi-desktop/agents/query-listener.md) | Capture DAX queries from Power BI Desktop visuals in real time |
| Hook | DAX reference validation | Validates table, column, and measure references against the connected model; suggests corrections |
| Hook | Measure metadata enforcement | Blocks adding measures without DisplayFolder, Description, and FormatString |
| Hook | Referential integrity check | Reports unmatched many-side keys after relationship or column changes |
| Hook | Metadata cache refresh | Auto-snapshots model metadata on TOM connect or model modification |
| Hook | Compatibility level check | Reports features available by upgrading; optional auto-upgrade |

</details>

<details>
<summary><img src="media/icons/pbip.svg" alt="" height="20"> <strong>pbip</strong> &ensp; Author and validate TMDL, PBIR, and PBIP project files</summary>

| Type | Name | Description |
|------|------|-------------|
| Skill | [`pbip`](plugins/pbip/skills/pbip/) | Power BI Project (PBIP) format, structure, and file types |
| Skill | [`tmdl`](plugins/pbip/skills/tmdl/) | Author and edit TMDL files directly |
| Skill | [`pbir-format`](plugins/pbip/skills/pbir-format/) | Author and edit PBIR metadata files directly (visual.json, report.json, themes, filters, report extensions, visual calculations) |
| Agent | [`pbip-validator`](plugins/pbip/agents/pbip-validator.md) | Validate PBIP project structure, TMDL syntax, and PBIR schemas |
| Hook | PBIR validation | Validates PBIR structure, required fields, naming conventions, and schema URLs |
| Hook | Report binding validation | Validates semantic model binding (byPath directory exists; byConnection model exists via `fab exists`) |
| Hook | TMDL validation | Validates TMDL structural syntax |

</details>

<details>
<summary><img src="media/icons/reports.svg" alt="" height="20"> <strong>reports</strong> &ensp; Deneb, R, Python, SVG visuals; themes; report design and review</summary>

| Type | Name | Description |
|------|------|-------------|
| Skill | [`pbi-report-design`](plugins/reports/skills/pbi-report-design/) (Very WIP) | Power BI report best practices, design and style |
| Skill | [`modifying-theme-json`](plugins/reports/skills/modifying-theme-json/) (WIP) | Working with theme files |
| Skill | [`deneb-visuals`](plugins/reports/skills/deneb-visuals/) | Deneb visuals with Vega and Vega-Lite specs |
| Skill | [`r-visuals`](plugins/reports/skills/r-visuals/) | Custom R visuals in Power BI reports |
| Skill | [`python-visuals`](plugins/reports/skills/python-visuals/) | Custom Python visuals in Power BI reports |
| Skill | [`svg-visuals`](plugins/reports/skills/svg-visuals/) | SVG visuals via DAX measures in Power BI reports |
| Skill | [`review-report`](plugins/reports/skills/review-report/) (WIP) | Review Power BI reports for usage metrics and best practices |
| Skill | [`pbir-cli`](plugins/reports/skills/pbir-cli/) | Programmatic report manipulation via the [`pbir` CLI](https://github.com/maxanatsko/pbir.tools) |
| Agent | [`deneb-reviewer`](plugins/reports/agents/deneb-reviewer.md) | Review Deneb visual specs for Vega/Vega-Lite syntax and conventions |
| Agent | [`svg-reviewer`](plugins/reports/agents/svg-reviewer.md) | Review SVG DAX measures for syntax and design quality |
| Agent | [`r-reviewer`](plugins/reports/agents/r-reviewer.md) | Review R visual scripts (ggplot2) for Power BI conventions |
| Agent | [`python-reviewer`](plugins/reports/agents/python-reviewer.md) | Review Python visual scripts (matplotlib/seaborn) for Power BI conventions |

</details>

<details>
<summary><img src="media/icons/semantic-models.svg" alt="" height="20"> <strong>semantic-models</strong> &ensp; DAX, Power Query, naming, lineage, refresh, and model auditing</summary>

| Type | Name | Description |
|------|------|-------------|
| Skill | [`standardize-naming-conventions`](plugins/semantic-models/skills/standardize-naming-conventions/) | Audit and standardize naming conventions in semantic models |
| Skill | [`review-semantic-model`](plugins/semantic-models/skills/review-semantic-model/) (Very WIP) | Review semantic models for quality, performance, AI readiness, and best practices |
| Skill | [`refreshing-semantic-model`](plugins/semantic-models/skills/refreshing-semantic-model/) | Trigger or troubleshoot refreshes |
| Skill | [`lineage-analysis`](plugins/semantic-models/skills/lineage-analysis/) | Trace downstream reports from a semantic model across workspaces |
| Skill | [`power-query`](plugins/semantic-models/skills/power-query/) | Write M expressions, debug query folding, execute M locally or via Fabric API |
| Skill | [`dax`](plugins/semantic-models/skills/dax/) | Write, debug, and optimize DAX in semantic models. Contributed by [Justin Martin](https://daxnoob.blog) |
| Agent | [`semantic-model-auditor`](plugins/semantic-models/agents/semantic-model-auditor.md) | Audit semantic models for quality, memory, DAX, and design issues |

</details>

<details>
<summary><img src="media/icons/fabric-cli.svg" alt="" height="20"> <strong>fabric-cli</strong> &ensp; Remote operations via Fabric CLI; works on Pro, PPU, or Fabric</summary>

| Type | Name | Description |
|------|------|-------------|
| Skill | [`fabric-cli`](plugins/fabric-cli/skills/fabric-cli/) | Fabric CLI (fab) for any remote operation in Power BI or Fabric (works fully on Pro, PPU; Fabric not required) |
| Command | [`/audit-context`](plugins/fabric-cli/commands/audit-context.md) | Review project context files (CLAUDE.md, agents.md, memory files) |
| Command | [`/migrating-fabric-trial-capacities`](plugins/fabric-cli/commands/migrating-fabric-trial-capacities.md) | Migrate workspaces from trial to production capacity |

</details>


## Useful stuff

General-purpose agent resources that don't fit into a plugin: defensive hooks, patterns, and tools. See [`useful-stuff/`](useful-stuff/).

## Use or re-use of these skills

These plugins are intended for free community use.

You do not have the license to copy and incorporate them into your own products, trainings, courses, or tools. If you copy these skills - manually or by using an agent to rewrite them - you must include attribution and a link to this original project. That includes you, Microsoft.


<br>

<p align="center">
  <img src="media/bg22-06-2.png" alt="" width="800">
</p>

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
