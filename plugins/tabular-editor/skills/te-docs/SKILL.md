---
name: te-docs
version: 0.8.1
description: "This skill should be used when the user asks about 'Tabular Editor documentation', 'TE docs', 'how to do X in Tabular Editor', 'Tabular Editor features', 'TE3 features', '.tmuo files', 'Tabular Editor user options', 'TE3 preferences', 'Preferences.json', 'UiPreferences.json', 'Layouts.json', 'workspace database settings', 'deployment preferences', 'data source overrides', 'keyboard shortcuts', 'DAX editor settings', 'TMDL options', 'per-model TE3 configuration', or needs to search Tabular Editor documentation. Provides Tabular Editor documentation search and configuration file guidance."
---

# Tabular Editor Documentation & Configuration

Guidance for searching Tabular Editor documentation and understanding TE3 configuration files (.tmuo, Preferences.json, etc.).

## Documentation Search

The Tabular Editor docs site (docs.tabulareditor.com) has URL redirect issues that cause 404 errors for AI agents. Local search via ripgrep is faster and more reliable.

### Setup

Clone the TabularEditorDocs repository:

```bash
git clone https://github.com/TabularEditor/TabularEditorDocs.git ~/Git/TabularEditorDocs
```

### Search Commands

```bash
# Search by topic
rg -i "topic" ~/Git/TabularEditorDocs/content --type md

# Search with context
rg -i "topic" ~/Git/TabularEditorDocs/content --type md -C 3

# Search specific section
rg -i "topic" ~/Git/TabularEditorDocs/content/features --type md
```

### Key Documentation Files

| Topic | File |
|-------|------|
| BPA overview | `content/getting-started/bpa.md` |
| C# script library | `content/features/CSharpScripts/csharp-script-library.md` |
| DAX scripts | `content/features/dax-scripts.md` |
| Preferences | `content/references/preferences.md` |
| Keyboard shortcuts | `content/references/shortcuts3.md` |
| Advanced Scripting | `content/how-tos/Advanced-Scripting.md` |

### Directory Structure

| Path | Content |
|------|---------|
| `content/features/` | Feature docs (BPA, DAX scripts, C# scripts) |
| `content/getting-started/` | Onboarding and setup |
| `content/how-tos/` | Task-specific guides |
| `content/references/` | Preferences, shortcuts, release notes |
| `content/kb/` | Knowledge base (BPA rules, error codes) |

## Configuration Files (.tmuo)

TMUO files store developer- and model-specific preferences in Tabular Editor 3.

### Critical

- TMUO files contain user-specific settings -- **never commit to version control**
- Credentials are encrypted with Windows User Key -- **cannot be shared between users**
- Add `*.tmuo` to `.gitignore` in all projects
- File naming: `<ModelFileName>.<WindowsUserName>.tmuo`

### Structure

```json
{
  "UseWorkspace": true,
  "WorkspaceConnection": "localhost",
  "WorkspaceDatabase": "MyModel_Workspace_JohnDoe",
  "Deployment": {
    "TargetConnectionString": "powerbi://api.powerbi.com/v1.0/myorg/Workspace",
    "TargetDatabase": "MyModel",
    "DeployPartitions": false,
    "DeployModelRoles": true
  },
  "DataSourceOverrides": {
    "SQL Server": {
      "ConnectionString": "Data Source=localhost;Initial Catalog=DevDB"
    }
  }
}
```

### Sections

| Section | Purpose |
|---------|---------|
| `UseWorkspace` | Enable workspace database mode |
| `WorkspaceConnection` | Server for workspace database |
| `WorkspaceDatabase` | Workspace database name (unique per dev/model) |
| `Deployment` | Target server, database, and deploy options |
| `DataSourceOverrides` | Override connections for workspace |
| `TableImportSettings` | Settings for Import Tables feature |

### Deployment Options

| Field | Type | Description |
|-------|------|-------------|
| `TargetConnectionString` | string | Target server connection |
| `TargetDatabase` | string | Target database name |
| `DeployPartitions` | bool | Deploy partition definitions |
| `DeployModelRoles` | bool | Deploy security roles |
| `DeployModelRoleMembers` | bool | Deploy role members |
| `DeploySharedExpressions` | bool | Deploy shared M expressions |

## Application Preferences

TE3 stores application-level preferences in `%LocalAppData%\TabularEditor3\`:

| File | Purpose |
|------|---------|
| `Preferences.json` | Application settings (proxy, updates, telemetry) |
| `UiPreferences.json` | UI state (window positions, panel sizes) |
| `Layouts.json` | Saved layout configurations |

## References

- **`references/doc-structure.md`** -- Detailed documentation structure
- **`references/url-redirects.md`** -- Old-to-new URL mapping for broken links
- **`schema/`** -- JSON schemas for tmuo, preferences, layouts, UI preferences
- **`scripts/validate_config.py`** -- Validate TE3 config files
- **`scripts/validate_tmuo.py`** -- Validate TMUO files

## Fetching Docs

Tabular Editor product docs (docs.tabulareditor.com) are not on Microsoft Learn -- use the local clone approach above. For underlying Analysis Services and Power BI concepts, use `microsoft_docs_search` + `microsoft_docs_fetch` (MCP) if available, otherwise `mslearn search` + `mslearn fetch` (CLI). Search based on the user's request and run multiple searches as needed to ensure sufficient context before proceeding.

## External

- [Tabular Editor User Options](https://docs.tabulareditor.com/references/user-options.html)
- [Workspace Mode](https://docs.tabulareditor.com/features/workspace-mode.partial.html)
- [Preferences Reference](https://docs.tabulareditor.com/references/preferences.html)
