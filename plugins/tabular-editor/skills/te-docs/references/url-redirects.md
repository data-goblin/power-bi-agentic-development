# Tabular Editor URL Redirects

The docs site underwent a major reorganization. This file maps old URLs to new paths.

**Note:** The web server returns HTTP 404 for old URLs instead of proper 301 redirects, causing issues for AI agents and automated tools. Use this mapping to find the correct local file path.

## Key BPA Redirects

| Old URL | New URL | Local File |
|---------|---------|------------|
| `/common/using-bpa.html` | `/getting-started/bpa.html` | `content/getting-started/bpa.md` |
| `/onboarding/bpa.html` | `/getting-started/bpa.html` | `content/getting-started/bpa.md` |
| `/te3/views/bpa-view.html` | `/features/views/bpa-view.html` | `content/features/views/bpa-view.md` |
| `/te2/Best-Practice-Analyzer.html` | `/features/Best-Practice-Analyzer.html` | `content/features/Best-Practice-Analyzer.md` |
| `/common/using-bpa-sample-rules-expressions.html` | `/features/using-bpa-sample-rules-expressions.html` | `content/features/using-bpa-sample-rules-expressions.md` |

## Section Mappings

| Old Path Pattern | New Path Pattern |
|------------------|------------------|
| `/common/*` | `/features/*` or `/getting-started/*` |
| `/onboarding/*` | `/getting-started/*` |
| `/te2/*` | Various (`/features/`, `/how-tos/`, `/references/`) |
| `/te3/features/*` | `/features/*` |
| `/te3/views/*` | `/features/views/*` |
| `/te3/tutorials/*` | `/tutorials/*` |
| `/te3/other/release-notes/*` | `/references/release-notes/*` |

## Complete Redirect Table

| Old URL | New URL |
|---------|---------|
| `/common/CSharpScripts/*` | `/features/CSharpScripts/*` |
| `/common/desktop-limitations.html` | `/getting-started/desktop-limitations.html` |
| `/common/policies.html` | `/references/policies.html` |
| `/common/save-to-folder.html` | `/features/save-to-folder.html` |
| `/common/script-helper-methods.html` | `/features/script-helper-methods.html` |
| `/common/xmla-as-connectivity.html` | `/how-tos/xmla-as-connectivity.html` |
| `/onboarding/boosting-productivity-te3.html` | `/getting-started/boosting-productivity-te3.html` |
| `/onboarding/creating-and-testing-dax.html` | `/getting-started/creating-and-testing-dax.html` |
| `/onboarding/cs-scripts-and-macros.html` | `/getting-started/cs-scripts-and-macros.html` |
| `/onboarding/dax-script-introduction.html` | `/getting-started/dax-script-introduction.html` |
| `/onboarding/general-introduction.html` | `/getting-started/general-introduction.html` |
| `/onboarding/importing-tables-data-modeling.html` | `/getting-started/importing-tables-data-modeling.html` |
| `/onboarding/installation.html` | `/getting-started/installation.html` |
| `/onboarding/migrate-from-desktop.html` | `/getting-started/migrate-from-desktop.html` |
| `/onboarding/migrate-from-te2.html` | `/getting-started/migrate-from-te2.html` |
| `/onboarding/parallel-development.html` | `/getting-started/parallel-development.html` |
| `/onboarding/personalizing-te3.html` | `/getting-started/personalizing-te3.html` |
| `/onboarding/refresh-preview-query.html` | `/getting-started/refresh-preview-query.html` |
| `/te2/Advanced-Filtering-of-the-Explorer-Tree.html` | `/how-tos/Advanced-Filtering-of-the-Explorer-Tree.html` |
| `/te2/Advanced-Scripting.html` | `/how-tos/Advanced-Scripting.html` |
| `/te2/Best-Practice-Analyzer-Improvements.html` | `/features/Best-Practice-Analyzer.html` |
| `/te2/Command-line-Options.html` | `/features/Command-line-Options.html` |
| `/te2/FAQ.html` | `/references/FAQ.html` |
| `/te2/Getting-Started.html` | `/getting-started/Getting-Started-te2.html` |
| `/te2/Importing-Tables.html` | `/how-tos/Importing-Tables.html` |
| `/te2/Keyboard-Shortcuts.html` | `/references/Keyboard-Shortcuts2.html` |
| `/te2/Master-model-pattern.html` | `/how-tos/Master-model-pattern.html` |
| `/te2/Useful-script-snippets.html` | `/features/Useful-script-snippets.html` |
| `/te2/Workspace-Database.html` | `/features/Workspace-Database.html` |
| `/te3/features/code-actions.html` | `/features/code-actions.html` |
| `/te3/features/csharp-scripts.html` | `/features/csharp-scripts.html` |
| `/te3/features/dax-debugger.html` | `/features/dax-debugger.html` |
| `/te3/features/dax-editor.html` | `/features/dax-editor.html` |
| `/te3/features/dax-optimizer-integration.html` | `/features/dax-optimizer-integration.html` |
| `/te3/features/dax-query.html` | `/features/dax-query.html` |
| `/te3/features/dax-scripts.html` | `/features/dax-scripts.html` |
| `/te3/features/deployment.html` | `/features/deployment.html` |
| `/te3/features/diagram-view.html` | `/features/views/diagram-view.html` |
| `/te3/features/preferences.html` | `/references/preferences.html` |
| `/te3/features/shortcuts.html` | `/references/shortcuts3.html` |
| `/te3/features/tmdl.html` | `/features/tmdl.html` |
| `/te3/getting-started.html` | `/getting-started/getting-started.html` |
| `/te3/tutorials/calendars.html` | `/tutorials/calendars.html` |
| `/te3/tutorials/udfs.html` | `/tutorials/udfs.html` |
| `/te3/tutorials/workspace-mode.html` | `/features/workspace-mode.partial.html` |

## Source

Full redirect mapping is in `<DOCS_PATH>/redirects.json` (in your local TabularEditorDocs clone)
