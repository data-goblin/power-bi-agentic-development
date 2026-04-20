---
name: pbip
version: 0.26.0
description: Expert guidance for the Power BI Project (PBIP) file format; project structure, cross-cutting operations (renames, forking), and PBIX extraction/conversion. Automatically invoke when the user mentions PBIP, PBIX, .pbip/.pbism/.platform files, or asks about "PBIP project structure", "PBIP vs PBIX", "thin report vs thick report", "rename a table", "cascade rename", "fork a PBIP project", "convert pbix to pbip", "extract pbix", "what files are in a PBIP", "PBIP encoding", "definition.pbir", or discusses project-level file structure and post-rename verification.
---

# PBIP Project Format

PBIP (Power BI Project) is the developer-mode file format for Power BI. It decomposes a `.pbix` binary into human-readable text files organized in folders, enabling source control, external editing, and multi-author collaboration.

## General, critical guidance

- **This skill covers project structure, not file editing.** To modify TMDL files (semantic model), load the `tmdl` skill. To modify PBIR JSON files (report), load the `pbir-format` skill -- or preferably use the `pbir` CLI with the `pbir-cli` skill if available. Install with `uv tool install pbir-cli` or `pip install pbir-cli`; check with `pbir --version`. If the required skill is not loaded, ask the user to install the appropriate plugin before proceeding.
- **PBIX is a black box; PBIP is transparent.** PBIX is a single binary that cannot be diffed or edited externally. PBIP splits the same content into text files. Convert between them with File > Save As in PBI Desktop.
- **Thick vs thin reports:** A thick report bundles `.Report/` + `.SemanticModel/` in the same project (`definition.pbir` uses `byPath`). A thin report has `.Report/` only, connecting to a remote model via `byConnection`. Thin reports are preferred for managed/shared BI.
- **A project can contain multiple items.** Multiple `.Report/` and `.SemanticModel/` folders can coexist. The `.pbip` file is optional -- open `definition.pbir` directly.
- **UTF-8 without BOM.** All files must be saved as UTF-8 without BOM. A BOM prefix causes parse errors in some tools.
- **Git line endings:** PBI Desktop writes CRLF. Configure `core.autocrlf` or `* text=auto` in `.gitattributes` to normalize.
- **260-char Windows path limit.** Use short root paths. Deep nesting of page/visual GUIDs can exceed this limit.
- **PBI Desktop does not detect external changes.** Close and reopen PBI Desktop after editing files externally.
- **Rename cascades are cross-cutting.** Renaming a table, measure, or column requires updating references in TMDL files, visual JSONs, report extensions, culture files, DAX queries, and diagram layouts. Missing even one location causes broken visuals or DAX errors.
- **SparklineData metadata** selectors embed Entity references in compact strings that do not follow the standard `SourceRef.Entity` JSON structure. Easy to miss.
- **DAX query files exist in TWO locations:** `<Name>.SemanticModel/DAXQueries/` and `<Name>.Report/DAXQueries/`. Always check both during renames.

## Working with PBIX Files

A `.pbix` file is a ZIP archive following the OPC (Open Packaging Convention) standard. It can be extracted with standard zip tools to inspect its contents or manually assemble a PBIP from the extracted files.

### PBIX Internal Structure

**Thick PBIX** -- contains an embedded semantic model (`DataModel` binary). The report and model are bundled together:

```
ThickReport.pbix (ZIP archive)
+-- [Content_Types].xml          # OPC manifest (UTF-8 with BOM)
+-- Version                      # Power BI version string (UTF-16LE)
+-- Settings                     # Query settings JSON (UTF-16LE)
+-- Metadata                     # Creation timestamp JSON (UTF-16LE)
+-- SecurityBindings             # Binary (empty for new reports)
+-- DataModel                    # <-- THIS MAKES IT THICK: binary ABF blob (opaque, not programmatically readable)
+-- Report/
|   +-- definition/              # PBIR report definition (modern PBIX)
|   |   +-- report.json
|   |   +-- pages/
|   |   +-- ...
|   +-- Layout                   # Legacy monolithic JSON (legacy PBIX, UTF-16LE)
|   +-- StaticResources/         # Themes, images
```

**Thin PBIX** -- no embedded model. Uses a `Connections` file to reference a remote semantic model:

```
ThinReport.pbix (ZIP archive)
+-- [Content_Types].xml          # OPC manifest (UTF-8 with BOM)
+-- Version                      # Power BI version string (UTF-16LE)
+-- Settings                     # Query settings JSON (UTF-16LE)
+-- Metadata                     # Creation timestamp JSON (UTF-16LE)
+-- SecurityBindings             # Binary (empty for new reports)
+-- Connections                  # <-- Remote model reference (UTF-8 JSON, contains connection string)
+-- Report/
|   +-- definition/              # PBIR report definition (modern PBIX)
|   |   +-- report.json
|   |   +-- pages/
|   |   +-- ...
|   +-- Layout                   # Legacy monolithic JSON (legacy PBIX, UTF-16LE)
|   +-- StaticResources/         # Themes, images
```

A PBIX is thick if `DataModel` exists in the ZIP; thin if it has `Connections` instead. The `Report/` folder structure is the same in both cases. A PBIX will have either `Report/definition/` (modern PBIR format) or `Report/Layout` (legacy format), not both.

### Thick vs Thin PBIX

A **thick PBIX** contains a `DataModel` entry -- a binary ABF (Analysis Services Backup) blob with the semantic model data and metadata baked in. A **thin PBIX** has no `DataModel` and instead has a `Connections` file (UTF-8 JSON) pointing to a remote semantic model. The `DataModel` binary cannot be deserialized programmatically -- thick PBIX semantic models are opaque.

### Legacy vs Modern PBIX

Legacy PBIX files (pre-PBIR) store the report as a single `Report/Layout` file encoded in UTF-16LE -- a monolithic JSON blob with nested JSON strings (e.g. `config`, `filters`, `query` are JSON-encoded strings inside the outer JSON). Modern PBIX files store the report in `Report/definition/` using the PBIR JSON format with separate files per page and visual. Detect legacy format by checking for the `Report/Layout` entry in the ZIP.

### Encoding

PBIX internal files use mixed encodings:

| File | Encoding |
|------|----------|
| `Version`, `Settings`, `Metadata` | UTF-16LE |
| `Connections` | UTF-8 |
| `Report/definition/` contents | UTF-8 |
| `Report/Layout` (legacy) | UTF-16LE |
| `[Content_Types].xml` | UTF-8 with BOM |
| `SecurityBindings`, `DataModel` | Binary |

Mismatched encoding when reading or writing these files causes parse failures.

### Extracting a PBIX

```python
import zipfile
from pathlib import Path

pbix_path = Path("MyReport.pbix")
output_dir = Path("MyReport_extracted")

with zipfile.ZipFile(pbix_path, "r") as z:
    # Safety: validate no entries escape the target directory (Zip Slip protection)
    resolved_output = output_dir.resolve()
    for member in z.infolist():
        member_path = (output_dir / member.filename).resolve()
        if not member_path.is_relative_to(resolved_output):
            raise ValueError(f"Zip entry escapes target: {member.filename}")
    z.extractall(output_dir)

# Detect PBIX type
is_thick = (output_dir / "DataModel").exists()
is_legacy = (output_dir / "Report" / "Layout").exists()
is_modern = (output_dir / "Report" / "definition" / "report.json").exists()
```

```bash
# Quick extraction via CLI
unzip MyReport.pbix -d MyReport_extracted/

# Check contents without extracting
unzip -l MyReport.pbix
```

### Assembling a PBIP from an Extracted Thin PBIX

For thin PBIX files (no `DataModel`), a PBIP can be assembled from the extracted contents:

1. Extract the PBIX ZIP
2. Create the PBIP folder structure:
   ```
   MyReport/
   +-- MyReport.pbip
   +-- MyReport.Report/
   |   +-- definition.pbir
   |   +-- definition/           # Copy from extracted Report/definition/
   |   +-- StaticResources/      # Copy from extracted Report/StaticResources/
   |   +-- .platform
   ```
3. Create `MyReport.pbip`:
   ```json
   {
     "version": "1.0",
     "artifacts": [
       { "report": { "path": "MyReport.Report" } }
     ],
     "settings": { "enableAutoRecovery": true }
   }
   ```
4. Create `definition.pbir` with `byConnection` derived from the extracted `Connections` file. The `Connections` file contains a JSON array with connection string details:
   ```json
   {
     "$schema": "https://developer.microsoft.com/json-schemas/fabric/item/report/definitionProperties/2.0.0/schema.json",
     "version": "4.0",
     "datasetReference": {
       "byConnection": {
         "connectionString": "Data Source=powerbi://api.powerbi.com/v1.0/myorg/WorkspaceName;Initial Catalog=ModelName"
       }
     }
   }
   ```
5. Create `.platform` with a new `logicalId` GUID and `"type": "Report"`

**This only works for thin PBIX with modern PBIR format.** Thick PBIX files require the semantic model to be handled separately (e.g. exported via XMLA/TOM, or deployed from a `model.bim` or TMDL source). Legacy PBIX report content (`Report/Layout`) is not compatible with the PBIR `definition/` structure.

## PBIX vs PBIP

| Aspect | PBIX | PBIP |
|--------|------|------|
| Format | Single binary file | Folder of text files |
| Source control | Not diff-friendly | Git-ready, human-readable diffs |
| Collaboration | Single author at a time | Multiple authors, merge-friendly |
| External editing | Not supported | VS Code, Tabular Editor, scripts |
| Deployment | File > Publish | Git integration, Fabric APIs, fabric-cicd |
| Data | Contains cached data | `cache.abf` is gitignored; metadata only in Git |
| Convert | File > Save As > PBIP | File > Save As > PBIX |

## Project Structure

The `.Report/` folder is required in a PBIP. The `.SemanticModel/` folder is optional — a thin report has only `.Report/` and points at a remote semantic model via `definition.pbir` `byConnection`.

The `.pbi/` subfolders in both items (`localSettings.json`, `editorSettings.json`, `cache.abf`, etc.) are **all optional** — they are per-user/per-machine runtime state generated by Power BI Desktop. A freshly authored PBIP from an external tool may not have any of them, and the project still opens fine in Desktop.

```
<ProjectName>/
+-- <Name>.pbip                              # Entry point (references .Report folder) — optional
+-- .gitignore                               # Recommended; excludes .pbi/localSettings.json and cache.abf
+-- <Name>.SemanticModel/                    # OPTIONAL — absent for thin reports
|   +-- .pbi/                                # All contents OPTIONAL, per-user runtime state
|   |   +-- localSettings.json               # User-specific (gitignored)
|   |   +-- editorSettings.json              # Editor settings (committed)
|   |   +-- cache.abf                        # Data cache (gitignored)
|   |   +-- unappliedChanges.json            # Pending Power Query changes
|   |   +-- daxQueries.json                  # DAX query view tab settings
|   |   +-- tmdlscripts.json                 # TMDL view script tab settings
|   +-- definition.pbism                     # SM entry point (required if .SemanticModel exists)
|   +-- definition/                          # TMDL format (preferred) — see tmdl skill
|   +-- model.bim                            # TMSL format (legacy alt to definition/, mutually exclusive)
|   +-- diagramLayout.json                   # SM diagram (no external edit)
|   +-- DAXQueries/                          # .dax files from DAX query view
|   +-- TMDLScripts/                         # .tmdl files from TMDL view
|   +-- Copilot/                             # Copilot tooling metadata
|   +-- .platform                            # Fabric identity (displayName, logicalId)
+-- <Name>.Report/                           # REQUIRED
|   +-- .pbi/                                # OPTIONAL runtime state
|   |   +-- localSettings.json               # User-specific (gitignored)
|   +-- definition.pbir                      # Report entry point (required for PBIR format)
|   +-- definition/                          # PBIR format — see pbir-format skill
|   |   +-- report.json
|   |   +-- version.json
|   |   +-- pages/
|   |   |   +-- pages.json
|   |   |   +-- <page-slug>/                 # See "Page folder naming" below
|   |   |   |   +-- page.json
|   |   |   |   +-- visuals/...
|   +-- report.json                          # PBIR-Legacy format (legacy alt to definition/)
|   +-- mobileState.json                     # Mobile layout (no external edit)
|   +-- semanticModelDiagramLayout.json      # Diagram positions (table renames)
|   +-- CustomVisuals/                       # Private custom visual metadata
|   +-- StaticResources/
|   |   +-- SharedResources/                 # Base themes, shared resources
|   |   |   +-- BaseThemes/<name>.json       # Resolution path: <report>/StaticResources/SharedResources/<item.path>
|   |   +-- RegisteredResources/             # Custom themes, images, .pbiviz files
|   +-- DAXQueries/                          # .dax files from report DAX query view
|   +-- .platform                            # Fabric identity
```

## Page folder naming

Power BI Desktop uses opaque 20-character hex slugs for new page, visual, bookmark, and filter folders by default (e.g. `847663d71e27e0840063`). Per Microsoft docs, these can be **renamed to friendly names** but the replacement must satisfy:

- **Regex:** `^[\w-]+$` — word characters (letters, digits, underscore) or hyphen only.
- **No spaces, no dots, no other punctuation.** Names outside this set are **silently ignored** by Power BI Desktop and the page/visual vanishes from the loaded report. This is the hardest bug class to diagnose because there is no error dialog.
- **Folder name and `name` field must match exactly (case-sensitive).** The folder may be bare (`<slug>/`) or suffixed (`<slug>.Page/`) — both forms are valid on disk. pbir-cli uses the `.Page` suffix in its CLI path syntax; current Desktop saves omit the suffix.
- **`pages.json.pageOrder` entries must reference the slug**, not the display name. `activePageName` must be one of the entries in `pageOrder`.
- **Restart Desktop after external rename.** PBI Desktop does not detect file changes while open.

If you rename a page from a hex slug to a friendly name, you must also update every reference to the old slug in visual JSONs, filter configs, bookmarks, sparkline metadata, and DAX queries — see `references/rename-cascade.md`.

## SharedResources path resolution

Items listed in `resourcePackages[]` are resolved relative to:

```
<Report>/StaticResources/<package_type>/<item.path>
```

For a `SharedResources` package with an item `{ "path": "BaseThemes/Fluent2-CY26SU03.json" }`, Power BI Desktop looks for:

```
<Report>/StaticResources/SharedResources/BaseThemes/Fluent2-CY26SU03.json
```

**Missing resource files are a common blocking error.** If `report.json` declares `themeCollection.baseTheme.type = "SharedResources"` and points at a resource that doesn't exist on disk, the report will not open. `validate_pbip.py` checks this explicitly.

## What to Read for Common Tasks

| Task | Read |
|------|------|
| Inspect or extract a PBIX file | **Working with PBIX Files** section above -- internal structure, thick vs thin detection, encoding, extraction, assembling a PBIP from extracted contents |
| Understand entry point file structure | **`references/pbip-file-types.md`** -- `.pbip`, `.pbir`, `.pbism`, `.platform` JSON structure, version properties, byPath vs byConnection |
| Rename a table, measure, or column | **`references/rename-cascade.md`** -- before/after examples for every cascade location. See also `pbir-format` skill's `references/rename-patterns.md` for visual JSON patterns |
| Fork / duplicate a PBIP project | **`references/pbip-file-types.md`** -- update `.pbip` path, `.pbir` byPath, `.platform` logicalId and displayName |
| Work with Copilot tooling files | **`references/copilot-folder.md`** -- AI instructions, verified answers, schema, example prompts |
| Edit TMDL model files | **`tmdl`** skill -- syntax, authoring, column properties, naming conventions |
| Edit PBIR report files | **`pbir-format`** skill -- visual.json, theme, filters, report extensions, page layout |
| Verify no broken references after rename | Grep commands below |

## Forking a PBIP Project

1. **Copy the project folder** -- duplicate the entire root folder with a new name.
2. **Rename artifact folders** -- rename `.Report/` and `.SemanticModel/` subfolders to match the new project name.
3. **Rename and update `.pbip`** -- rename the `.pbip` file and update `artifacts[].report.path` to point to the renamed `.Report` folder.
4. **Update `.pbir`** -- if the report uses `byPath`, update the path to point to the renamed `.SemanticModel` folder.
5. **Update `.platform` files** -- set `displayName` to the new project name in each `.platform` file. Regenerate `logicalId` (new GUID) if deploying as a separate Fabric item.

## Verification

Two tools for validation, used together:

1. **`scripts/validate_pbip.py`** — project-level validator for cross-cutting concerns: `.pbip` root file, `.platform` identity, semantic model format (TMDL vs TMSL), `datasetReference` resolution, theme resource resolution on disk, **orphan page folders**, and the **silent-ignore page name regex rule** (page names outside `^[\w-]+$` are silently ignored by Power BI Desktop). Delegates deep `.Report` schema validation to `pbir validate` if it is on PATH.

   ```bash
   python3 scripts/validate_pbip.py <path-to-.pbip-or-project>           # validate
   python3 scripts/validate_pbip.py <path> --fix                         # scaffold .gitignore
   python3 scripts/validate_pbip.py <path> --json                        # machine-readable
   python3 scripts/validate_pbip.py <path> --no-pbir-cli                 # skip delegation
   ```

   Exit codes: `0` clean, `1` warnings only, `2` errors, `3` usage error.

2. **`pbir validate <Report.Report>`** (from the `pbir-cli` skill) — canonical JSON schema + PBIR structure validator for the `.Report` folder. Covers JSON syntax, schema compliance, required fields, and optional `--qa` / `--fields` / `--strict` checks.

3. **`pbip-validator`** agent — use for interactive, LLM-driven checking of orphaned references after renames, when you need reasoning over the whole project rather than a deterministic report.

**Known gotcha with `pbir validate`:** if the project's `.pbi/localSettings.json` uses a schema version newer than the one bundled in pbir-cli, `pbir validate` returns `SCHEMA_UNSUPPORTED`. Pass `--allow-download-schemas` to let it fetch the missing schema on demand, or ignore `.pbi/` files (they are per-user runtime state and not part of the committed definition).

After any rename or fork operation, verify no old references remain.

```bash
# Search for old name across all project files
grep -r "Old Name" "Project.Report/" "Project.SemanticModel/" --include="*.json" --include="*.tmdl" --include="*.dax"

# Search with word boundaries to avoid partial matches
grep -rP "\bOld Name\b" "Project.Report/" "Project.SemanticModel/"

# Look for old name in single-quoted DAX references
grep -r "'Old Name'" --include="*.tmdl" --include="*.dax"
```

Common missed locations:
1. SparklineData metadata -- compact string format outside standard JSON structure
2. Conditional formatting expressions -- `Entity` refs nested in `Conditional.Cases`
3. Filter config -- page-level and visual-level filters in `filterConfig` sections
4. Sort definitions -- `sortDefinition` blocks in visual JSON
5. DAX queries in Report folder -- the second DAX query location
6. Culture file linguisticMetadata -- `ConceptualEntity` and `ConceptualProperty` inside embedded JSON

## Related Skills

**Within this plugin:**
- **`tmdl`** -- TMDL syntax, authoring, and editing rules for direct `.tmdl` file editing
- **`pbir-format`** -- PBIR JSON format, visual.json, theme, filters, report extensions

**Other plugins:**
- **`semantic-models`** plugin -- tooling and workflows for semantic model development (naming conventions, model quality). Use for working with the actual model content, not just its file format.
- **`pbi-desktop`** plugin -- connecting to Power BI Desktop's local Analysis Services instance via TOM/ADOMD.NET
- **`tabular-editor`** plugin -- Tabular Editor CLI, C# scripting, BPA rules, documentation search

## References

**Project structure:**
- **`references/pbip-file-types.md`** -- Entry point file structures (`.pbip`, `.pbir`, `.pbism`, `.platform`), `.pbi/` subfolder, `DAXQueries/`, `TMDLScripts/`, `model.bim`, `.gitignore`, version properties, JSON examples
- **`references/copilot-folder.md`** -- Copilot/ folder structure (AI instructions, verified answers, schema, example prompts)

**Rename operations:**
- **`references/rename-cascade.md`** -- Detailed before/after examples for each rename cascade location (TMDL + report files)

**Fetching Docs:** To retrieve current PBIP reference docs, use `microsoft_docs_search` + `microsoft_docs_fetch` (MCP) if available, otherwise `mslearn search` + `mslearn fetch` (CLI). Search based on the user's request and run multiple searches as needed to ensure sufficient context before proceeding.

**External references:**
- [PBIP overview (Microsoft Learn)](https://learn.microsoft.com/en-us/power-bi/developer/projects/projects-overview)
- [Semantic model folder (Microsoft Learn)](https://learn.microsoft.com/en-us/power-bi/developer/projects/projects-dataset)
- [Report folder (Microsoft Learn)](https://learn.microsoft.com/en-us/power-bi/developer/projects/projects-report)
