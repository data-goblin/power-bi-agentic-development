<h1 align="center">power-bi-agentic-development</h1>

<p align="center">
  Skills and tools for agentic Power BI semantic model development with Tabular Editor
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-0.2.0-blue" alt="Version">
  <img src="https://img.shields.io/badge/tabular_editor-2%20%7C%203-orange" alt="Tabular Editor">
  <img src="https://img.shields.io/badge/license-MIT-green" alt="License">
</p>

---

## Installation

```bash
# Add marketplace source (if not already added)
/plugin marketplace add data-goblin/power-bi-agentic-development

# Install the plugin
/plugin install power-bi-agentic-development@data-goblin
```

Or: `/plugin` > Browse Plugins > Select marketplace


## What's Included

### Skills

| Skill | Description |
|-------|-------------|
| `bpa-rules` | Create and improve Best Practice Analyzer rules |
| `c-sharp-scripting` | C# scripting for Tabular Editor (TOM API, LINQ, WinForms) |
| `c-sharp-macros` | Tabular Editor macro development |
| `tabular-editor-cli` | Tabular Editor CLI usage and automation |
| `tabular-editor-config` | TE3 config files (TMUO, preferences, BPA settings) |
| `tabular-editor-docs` | Local search of Tabular Editor documentation |

### Commands

| Command | Description |
|---------|-------------|
| `/suggest-rule` | Generate BPA rules from descriptions |

### Agents

| Agent | Description |
|-------|-------------|
| `bpa-expression-helper` | Debug and improve BPA rule expressions |

### Scripts

| Script | Description |
|--------|-------------|
| `bpa_rules_audit.py` | Comprehensive audit of BPA rules across all sources (built-in, URL, model, user, machine) |


## Requirements

- [Tabular Editor 2](https://github.com/TabularEditor/TabularEditor/releases) or [Tabular Editor 3](https://tabulareditor.com/)
- For XMLA operations: Power BI Premium or Fabric capacity with XMLA read/write enabled
- For `tabular-editor-docs` skill: Clone [TabularEditorDocs](https://github.com/TabularEditor/TabularEditorDocs) locally


## Skills Overview

### BPA Rules (`bpa-rules`)

Create Best Practice Analyzer rules for semantic model validation:
- Rule JSON structure and schema
- Dynamic LINQ expressions for detecting violations
- FixExpression for auto-remediation
- TMDL annotation patterns

### C# Scripting (`c-sharp-scripting`)

Write C# scripts to manipulate semantic model metadata:
- TOM API access (Model, Tables, Measures, Columns, etc.)
- LINQ fundamentals for filtering and transforming collections
- WinForms patterns for interactive dialogs
- Selected object patterns for IDE use
- Helper methods (Output, SelectMeasure, FormatDax, etc.)

### Tabular Editor CLI (`tabular-editor-cli`)

Automate model operations via command line:
- Script execution against XMLA endpoints
- CI/CD integration patterns
- Authentication (Azure AD, Service Principal)
- Deployment and schema comparison

### Tabular Editor Config (`tabular-editor-config`)

Manage Tabular Editor configuration files:
- TMUO (user options) file structure
- Preferences JSON schema
- BPA rule file locations
- Workspace connections


## Related Projects

- [fabric-cli-plugin](https://github.com/data-goblin/fabric-cli-plugin) - Microsoft Fabric CLI skills and MCP servers
- [TabularEditor/BestPracticeRules](https://github.com/TabularEditor/BestPracticeRules) - Standard BPA rule collections


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
