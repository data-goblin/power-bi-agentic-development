---
name: pbip
description: Power BI Project (PBIP) structure and gotchas. Use for .pbip, .pbism, .platform and definition.pbir files, thick vs thin reports, byPath vs byConnection, page folder names that vanish in Desktop, Desktop not picking up external edits (Apply external changes), unappliedChanges.json, PBIX to PBIP conversion, forking or renaming a project, and project-level validation.
---

# PBIP projects

Learn: [PBIP overview](https://learn.microsoft.com/en-us/power-bi/developer/projects/projects-overview), [semantic model folder](https://learn.microsoft.com/en-us/power-bi/developer/projects/projects-dataset), [report folder](https://learn.microsoft.com/en-us/power-bi/developer/projects/projects-report), [external editing](https://learn.microsoft.com/en-us/power-bi/developer/projects/projects-external-editing). This skill holds the gotchas and the validators. Semantic model edits go through `te` (tmdl skill), report edits through `pbir` (pbir-cli skill); `pbir-format` is read-only context.

## Rules

- A PBIX cannot be converted by script. Only Desktop, File > Save as > Power BI Project, converts it. Do not unzip a PBIX or rebuild PBIR from it; ask for a PBIP source instead
- Page, visual and bookmark folder names must be letters, digits, underscore or hyphen, at most 50 characters (the `name` property in the schemas). Desktop silently ignores anything else: no error, the page just vanishes. Rename with `pbir pages rename`, never by renaming the folder
- `definition.pbir` `byConnection` only reaches a Fabric-hosted semantic model. For any other Analysis Services model use `byPath` to a semantic model folder that holds `modelReference.json` (schema `fabric/item/semanticModel/modelReference`)
- Desktop does not reload external edits unless the preview feature "Detect and reload external PBIP changes" is on (Desktop August 2026 or later); then it shows an Apply external changes banner. Renaming a PBIR folder still needs a restart. Without the feature, close and reopen Desktop
- Not editable externally: `definition.pbir`, `report.json` (PBIR-Legacy), `mobileState.json`, `semanticModelDiagramLayout.json`. `cache.abf` is never reloaded
- `.pbi/unappliedChanges.json` holds pending Power Query edits made in Desktop; applying them overwrites expression edits made outside. Apply or discard them in Desktop and save before editing M expressions in TMDL
- On a composite or Direct Lake model, editing a synced object needs `changedProperty` entries and the `PBI_RemovedChildren` annotation in TMDL
- PBIR is the default and generally available; Desktop converts PBIR-Legacy (`report.json` at the report root) to PBIR when it saves. Sensitivity labels, report linguistic schema and saving to OneDrive or SharePoint are not supported in a PBIP
- `pagesMetadata` 1.1.0: `pageOrder` entries without a folder are ignored, folders missing from `pageOrder` are appended, an invalid `activePageName` is a non-blocking error Desktop fixes, and `landingPageName` beats `activePageName`
- UTF-8 without BOM everywhere. Windows path limit is 260 characters, so keep project roots short (page and visual folders are 20-character ids by default)
- Rename cascade: `te mv --save` on the model, then `pbir fields replace` or `pbir fields replace-table` per report, then validate both sides. By hand-search only what those tools skip: [rename gaps](../../wiki/pbip-rename-gaps.md)

## Validate

```bash
te validate --model <Name>.SemanticModel --errors-only --non-interactive
pbir validate <Name>.Report --fields --strict
python3 scripts/validate_pbip.py <project folder> --no-pbir-cli
```

- `te validate` takes the `.SemanticModel` folder (needs `definition.pbism`) or its `definition` folder
- `pbir validate` checks schemas, required fields and (with `--fields`) that every field exists in a local `byPath` model. If it returns `SCHEMA_UNSUPPORTED` for a `.pbi` file, pass `--allow-download-schemas` or ignore `.pbi/`, which is per-user state
- `scripts/validate_pbip.py` covers what those two skip: `.pbip`, `.platform`, `byPath` resolution, theme resource files on disk, orphan page folders, page-name rule, `.gitignore`. Exit 0 clean, 1 warnings, 2 errors. `--fix` scaffolds a `.gitignore`
- The pbip hooks run the same tools after each edit; the pbip-validator agent triages the findings of a whole project

## Where things live

```yaml
thick report: .Report + .SemanticModel in one project, definition.pbir byPath
thin report: .Report only, definition.pbir byConnection (Fabric model)
.pbip: optional entry point; definition.pbir opens directly
DAXQueries/: in .SemanticModel (DAX query view); one beside the report is unverified, so search both on renames
TMDLScripts/: in .SemanticModel
.gitignore: **/.pbi/localSettings.json and **/.pbi/cache.abf
fork a project: rename folders and .pbip, fix byPath, set displayName and a new logicalId in each .platform
```

## Wiki

- [Entry files with schema-checked examples](../../wiki/pbip-entry-files.md): `.pbip`, `.platform` 2.1.0, `definition.pbir`, `definition.pbism`
- [Rename cascade gaps](../../wiki/pbip-rename-gaps.md)
- [The Copilot folder](../../wiki/pbip-copilot-folder.md)
