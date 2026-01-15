# TabularEditorDocs Repository Structure

Clone path: `<DOCS_PATH>` (configure via environment variable `TABULAR_EDITOR_DOCS` or use your local clone location)

## Top-Level Structure

```
TabularEditorDocs/
├── content/           # All documentation markdown files
├── _site/             # Built HTML output (generated)
├── configuration/     # Build configuration
├── templates/         # DocFX templates
├── redirects.json     # URL redirect mappings
└── gen_redirects.py   # Redirect generation script
```

## Content Directory

### features/

Feature documentation for Tabular Editor 2 and 3.

| Subdirectory | Content |
|--------------|---------|
| `CSharpScripts/` | C# script library (Beginner, Advanced, Templates) |
| `views/` | UI views (BPA, diagram, data refresh, properties, etc.) |
| `Semantic Model/` | Semantic model types, Direct Lake, DirectQuery |

Key files:
- `dax-scripts.md` - DAX scripting feature
- `dax-editor.md` - DAX editor features
- `dax-debugger.md` - DAX debugging
- `csharp-scripts.md` - C# scripting overview
- `tmdl.md` - TMDL support
- `deployment.md` - Deployment features
- `Best-Practice-Analyzer.md` - BPA feature overview
- `using-bpa-sample-rules-expressions.md` - BPA expression examples

### getting-started/

Onboarding and setup documentation.

Key files:
- `bpa.md` - BPA introduction and setup
- `installation.md` - Installation guide
- `general-introduction.md` - Tabular Editor overview
- `dax-script-introduction.md` - DAX scripts intro
- `cs-scripts-and-macros.md` - C# scripts and macros intro
- `migrate-from-desktop.md` - Migration from Power BI Desktop
- `migrate-from-te2.md` - Migration from TE2 to TE3
- `workspace-mode.md` - Workspace mode introduction

### tutorials/

Step-by-step tutorials.

| Subdirectory | Content |
|--------------|---------|
| `data-security/` | RLS, OLS setup and testing |
| `incremental-refresh/` | Incremental refresh setup and management |

Key files:
- `calendars.md` - Calendar table creation
- `udfs.md` - User-defined functions
- `direct-lake-guidance.md` - Direct Lake best practices
- `powerbi-xmla.md` - Power BI XMLA endpoint usage
- `new-pbi-model.md` - Creating new Power BI models
- `connecting-to-azure-databricks.md` - Databricks integration

### how-tos/

Task-specific guides.

Key files:
- `Advanced-Scripting.md` - Advanced scripting techniques
- `Importing-Tables.md` - Table import procedures
- `Master-model-pattern.md` - Master model development pattern
- `xmla-as-connectivity.md` - XMLA/AS connectivity
- `powerbi-xmla-pbix-workaround.md` - PBIX workarounds

### references/

Reference documentation.

| Subdirectory | Content |
|--------------|---------|
| `release-notes/` | Version release notes (3_0_1.md through 3_24_2.md) |

Key files:
- `preferences.md` - All TE3 preferences/settings
- `shortcuts3.md` - TE3 keyboard shortcuts
- `downloads.md` - Download links
- `release-history.md` - Version history
- `FAQ.md` - Frequently asked questions
- `whats-new.md` - What's new overview

### kb/

Knowledge base articles.

**BPA Rules:**
- `bpa-*.md` - Individual BPA rule explanations

**Error Codes:**
- `DI*.md` - Data import errors
- `DR*.md` - Data refresh errors
- `RW*.md` - Read/write errors

### troubleshooting/

Problem resolution guides.

Key files:
- `licensing-activation.md` - License issues
- `proxy-settings.md` - Proxy configuration
- `direct-lake-entity-updates-reverting.md` - Direct Lake issues

### security/

Security and privacy documentation.

Key files:
- `security-privacy.md` - Security features
- `privacy-policy.md` - Privacy policy
- `third-party-notices.md` - Third-party components

## Search Tips

### Find BPA Content
```bash
rg -i "bpa|best.practice" content/ --type md -l
```

### Find C# Script Examples
```bash
ls content/features/CSharpScripts/
rg -i "example|snippet" content/features/CSharpScripts/ --type md
```

### Find Preferences/Settings
```bash
rg -i "preference|setting" content/references/preferences.md -C 3
```

### Find Release Notes for Feature
```bash
rg -i "feature-name" content/references/release-notes/ --type md
```

### Find KB Article by Error
```bash
rg -i "error message" content/kb/ --type md
```
