---
name: te-docs
version: 0.22.4
description: Tabular Editor documentation search and configuration file guidance (.tmuo, Preferences.json, UiPreferences.json, Layouts.json). Automatically invoke when the user asks about "TE docs", "Tabular Editor features", "TE3 preferences", ".tmuo files", "workspace database settings", "DAX editor settings", "per-model TE3 configuration", or needs to search Tabular Editor documentation for how-to guidance.
---

# Tabular Editor Documentation & Configuration

Guidance for searching Tabular Editor documentation and understanding TE3 configuration files (.tmuo, Preferences.json, etc.).

## Pre-flight

Before using documentation search, verify `pbi-search` is installed:

```bash
pbi-search --version
```

If the command is not found, inform the user and offer two options:

1. **Install `pbi-search`** (recommended): see `bin/README.md` for install instructions via `cargo install` or GitHub Releases at [data-goblin/pbi-search](https://github.com/data-goblin/pbi-search)
2. **Search without the CLI**: use the `microsoft-learn` MCP tools (`microsoft_docs_search`, `microsoft_docs_fetch`) for Microsoft Learn content, or `WebFetch` to retrieve docs directly from these sources:
   - Tabular Editor docs: `https://docs.tabulareditor.com/`
   - DAX reference: `https://dax.guide/<function>/`
   - SQLBI articles: `https://www.sqlbi.com/articles/`
   - Data Goblins: `https://data-goblins.com/`

The CLI is strongly preferred; it searches all sources simultaneously and returns clean markdown. The fallback requires manual URL construction and multiple fetches.

## Documentation Search

Use the `pbi-search` CLI — the preferred way to search Tabular Editor docs and related Power BI/DAX resources. It searches Tabular Editor docs, DAX.guide, SQLBI, Microsoft Learn (Power BI + Fabric), the TE blog, and Data Goblins simultaneously, returning clean markdown.

After install, populate the local manifest cache (once):

```bash
pbi-search sync        # ~13s
```

### Searching

```bash
# Search all sources
pbi-search search "creating measures"

# Search only Tabular Editor docs
pbi-search search "BPA rules" --source te-docs

# Search TE blog + TE docs
pbi-search search "incremental refresh" --source te-docs --source te-blog

# JSON output for structured use in agents
pbi-search search "workspace mode" --source te-docs --json

# Include content excerpts
pbi-search search "calculated columns" --source te-docs --excerpts
```

### Fetching full docs

```bash
# Tabular Editor doc by bare path (from search results)
pbi-search fetch features/Best-Practice-Analyzer

# Any supported URL
pbi-search fetch https://docs.tabulareditor.com/features/workspace-mode
pbi-search fetch https://dax.guide/calculate/

# Extract a specific section
pbi-search fetch features/Best-Practice-Analyzer --section "Creating rules"

# Truncate for context budget
pbi-search fetch features/creating-measures --max-chars 3000 --json
```

### Agent search workflow

1. `pbi-search search "<topic>" --source te-docs --json` — find relevant docs
2. Use the `path` or `url` from results: `pbi-search fetch <path>`
3. No results? Broaden: `pbi-search search "<topic>"` (all sources)
4. DAX questions: always add `--source dax-guide`

### Available sources

| ID | Content |
|----|---------|
| `te-docs` | Tabular Editor docs (features, how-tos, KB, references) |
| `dax-guide` | ~480 DAX function reference pages |
| `te-blog` | Tabular Editor blog |
| `ms-learn` | Microsoft Learn — Power BI + Fabric (live, no sync needed) |
| `sqlbi` | ~370 SQLBI technical articles |
| `data-goblins` | Data Goblins Power BI posts |

### Richer search quality (optional)

Default sync builds a fast title-only index. For conceptual queries ("remove filters from column") run once with descriptions:

```bash
pbi-search sync --descriptions   # fetches meta descriptions; ~30s extra
```

---

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

## External

- [pbi-search on GitHub](https://github.com/data-goblin/pbi-search)
- [Tabular Editor User Options](https://docs.tabulareditor.com/references/user-options.html)
- [Workspace Mode](https://docs.tabulareditor.com/features/workspace-mode.partial.html)
- [Preferences Reference](https://docs.tabulareditor.com/references/preferences.html)
