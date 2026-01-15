---
name: tabular-editor-docs
description: This skill should be used when the user asks about "Tabular Editor documentation", "TE docs", "how to do X in Tabular Editor", "Tabular Editor features", "TE3 features", "C# scripts in Tabular Editor", "DAX scripts", "workspace mode", or needs to search Tabular Editor documentation. Provides efficient local search of TabularEditorDocs repository instead of unreliable web fetching.
---

# Tabular Editor Documentation Search

Efficient local search of Tabular Editor documentation using the cloned TabularEditorDocs repository.


## Why Local Search

The Tabular Editor docs site (docs.tabulareditor.com) has URL redirect issues that cause 404 errors for many AI agents. Local search via ripgrep is:

- **Faster** - No HTTP latency
- **Reliable** - No 404s or JS redirect failures
- **Complete** - Full access to all documentation
- **Searchable** - Grep across entire doc corpus


## Setup

### 1. Clone the Repository

Clone the TabularEditorDocs repository to a local directory:

**Windows (PowerShell):**
```powershell
git clone https://github.com/TabularEditor/TabularEditorDocs.git C:\Git\TabularEditorDocs
```

**macOS/Linux:**
```bash
git clone https://github.com/TabularEditor/TabularEditorDocs.git ~/Git/TabularEditorDocs
```

### 2. Configure Path (Optional)

Set environment variable `TABULAR_EDITOR_DOCS` to your clone location:

**Windows (PowerShell):**
```powershell
$env:TABULAR_EDITOR_DOCS = "C:\Git\TabularEditorDocs"
# Or set permanently via System Properties > Environment Variables
```

**macOS/Linux:**
```bash
export TABULAR_EDITOR_DOCS=~/Git/TabularEditorDocs
```


## Directory Structure

| Path | Content |
|------|---------|
| `content/features/` | Feature documentation (BPA, DAX scripts, C# scripts) |
| `content/getting-started/` | Onboarding and setup guides |
| `content/how-tos/` | Task-specific guides |
| `content/tutorials/` | Step-by-step tutorials |
| `content/references/` | Preferences, shortcuts, release notes |
| `content/kb/` | Knowledge base articles (BPA rules, errors) |
| `content/troubleshooting/` | Problem resolution guides |


## Search Commands

Replace `<DOCS_PATH>` with your clone location (e.g., `C:\Git\TabularEditorDocs` on Windows or `~/Git/TabularEditorDocs` on macOS/Linux).

### Basic Topic Search

**Cross-platform (ripgrep):**
```bash
rg -i "topic" <DOCS_PATH>/content --type md
```

### Search with Context

```bash
rg -i "topic" <DOCS_PATH>/content --type md -C 3
```

### Search Specific Section

```bash
rg -i "topic" <DOCS_PATH>/content/features --type md
```

### Find Files by Name

**Windows (PowerShell):**
```powershell
Get-ChildItem -Path <DOCS_PATH>\content -Filter "*bpa*" -Recurse -File
```

**macOS/Linux:**
```bash
find <DOCS_PATH>/content -name "*bpa*" -type f
```


## Common Search Targets

| Topic | Search Path | Example Query |
|-------|-------------|---------------|
| BPA rules | `content/features/`, `content/kb/bpa-*` | `rg -i "expression" content/features/` |
| C# scripts | `content/features/CSharpScripts/` | `rg -i "helper method" content/features/CSharpScripts/` |
| DAX scripts | `content/features/dax-scripts.md` | Read file directly |
| Workspace mode | `content/features/workspace-mode*` | Read file directly |
| Preferences | `content/references/preferences.md` | `rg -i "setting-name" content/references/` |
| Shortcuts | `content/references/shortcuts3.md` | Read file directly |
| Release notes | `content/references/release-notes/` | `rg -i "feature" content/references/release-notes/` |


## URL Resolution

The docs site underwent a major reorganization. Use `references/url-redirects.md` for mapping old URLs to new paths when users provide outdated links.

### Quick URL Patterns

| Old Pattern | New Pattern |
|-------------|-------------|
| `/common/using-bpa.html` | `/getting-started/bpa.html` |
| `/te3/features/*.html` | `/features/*.html` |
| `/te2/*.html` | Various (check redirects) |
| `/onboarding/*.html` | `/getting-started/*.html` |


## Workflow

### When User Asks About TE Feature

1. Search local docs: `rg -i "feature-name" <DOCS_PATH>/content --type md -l`
2. Read relevant file(s)
3. Synthesize answer from documentation

### When User Provides Broken URL

1. Extract the path from URL (e.g., `/common/using-bpa.html`)
2. Check `references/url-redirects.md` for new path
3. Find corresponding local file in `content/`
4. Read and provide content

### When User Needs Comprehensive Info

1. List files in relevant directory
2. Read multiple related files
3. Combine information in response


## Knowledge Base Articles

The `content/kb/` directory contains detailed articles on specific topics:

- `bpa-*.md` - BPA rule explanations and fixes
- `DI*.md`, `DR*.md`, `RW*.md` - Error code documentation

Search KB for specific issues:
```bash
rg -i "error description" <DOCS_PATH>/content/kb --type md
```


## Updating Local Docs

Keep your local clone current:

**Windows (PowerShell):**
```powershell
Push-Location <DOCS_PATH>
git pull origin main
Pop-Location
```

**macOS/Linux:**
```bash
cd <DOCS_PATH> && git pull origin main
```


## Key Documentation Files

For common topics, read these files directly:

| Topic | File |
|-------|------|
| BPA overview | `content/getting-started/bpa.md` |
| BPA view | `content/features/views/bpa-view.md` |
| BPA sample expressions | `content/features/using-bpa-sample-rules-expressions.md` |
| C# script library | `content/features/CSharpScripts/csharp-script-library.md` |
| DAX scripts | `content/features/dax-scripts.md` |
| Preferences | `content/references/preferences.md` |
| Advanced Scripting | `content/how-tos/Advanced-Scripting.md` |


## Additional Resources

### Reference Files

- **`references/url-redirects.md`** - Complete URL redirect mapping from old to new paths
- **`references/doc-structure.md`** - Detailed documentation structure and file purposes
