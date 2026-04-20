# Converting and Restructuring Reports

Guide for converting between Power BI formats, splitting thick reports into thin, combining reports, and rebinding to different models.

## Format Overview

| Format | Structure | Source control | Notes |
|--------|-----------|----------------|-------|
| **PBIX** | Single binary file | No | Legacy sharing format |
| **PBIP** (PBIR-Legacy) | Folder with single `report.json` | Partial | Old project format, modifications not officially supported |
| **PBIP** (PBIR) | Folder with `definition/` containing separate JSON per visual/page | Yes | Current recommended format |

**Thick report**: PBIP containing both `.Report/` and `.SemanticModel/` (report + local model bundled together).
**Thin report**: `.Report/` only, connected to a published semantic model via workspace reference.

## Checking Current Format

```bash
pbir ls                                          # Shows format in parentheses: (pbip), (pbir), (pbix)
pbir get "Report.Report"                         # Report properties including format details
pbir model "Report.Report"                       # Connection type: byPath (thick) vs byConnection (thin)
```

## Converting Between PBIP, PBIR, and PBIX

### PBIP/PBIR to PBIX

```bash
pbir report convert "Report.Report" -F pbix
pbir report convert "Report.Report" -F pbix --name "Exported" --open   # Rename and open in Desktop
pbir report convert "Report.Report" -F pbix -f                         # Overwrite existing
```

### PBIX to PBIP/PBIR

```bash
pbir report convert "Report.Report" -F pbip
pbir report convert "Report.Report" -F pbir                            # PBIR enhanced format
pbir report convert "Report.Report" -F pbip --validate                 # Validate after conversion
```

### Copy with Format Conversion

`pbir cp` can convert format during copy:

```bash
pbir cp "Source.Report" "Target.Report" --format pbix
pbir cp "Source.Report" "Target.Report" --format pbir -f
```

### PBIR-Legacy to PBIR (Enhanced Format)

Converting from PBIR-Legacy (single `report.json`) to PBIR (separate JSON files per visual/page) **must be done in Power BI Desktop**:

1. Open the `.pbip` file in Power BI Desktop
2. File > Save As > select "Power BI Project (PBIR)" format
3. This is a one-way upgrade -- cannot revert from the UI

There is no CLI command for this conversion because the PBIR-Legacy format uses a fundamentally different JSON structure that requires Desktop's internal migration logic.

## Thick to Thin Report (Split)

A thick PBIP bundles report + semantic model together. Splitting separates them: the model gets published to a workspace, and the report is rebind to reference the published model.

```bash
# Split and publish model to workspace (uses active connection if no --target)
pbir report split-from-thick ThickProject --target "Workspace.Workspace/Model.SemanticModel"

# Specify output location and format
pbir report split-from-thick ThickProject -t "W.Workspace/M.SemanticModel" -F pbir -o ./output

# Uses active connection for target
pbir connect MyWorkspace
pbir report split-from-thick ThickProject
```

What this does:
1. Publishes the `.SemanticModel/` to the target workspace
2. Creates a thin `.Report/` that references the published model via `byConnection`
3. Removes the local `.SemanticModel/` dependency

## Thin to Thick Report (Merge)

Combine a thin report with a local semantic model into a thick PBIP:

```bash
pbir report merge-to-thick "Report.Report" "Model.SemanticModel"
pbir report merge-to-thick "Report.Report" "Model.SemanticModel" -o ./thick-output
```

What this does:
1. Copies both `.Report/` and `.SemanticModel/` into a single PBIP project
2. Updates `definition.pbir` to use `byPath` reference to the local model

## Rebinding to a Different Model

Change which semantic model a report connects to without changing report content:

```bash
# Rebind to a published workspace model
pbir report rebind "Report.Report" "Workspace.Workspace/Model.SemanticModel"

# Rebind to a local model (byPath)
pbir report rebind "Report.Report" --local "../Model.SemanticModel"

# Rebind using active connection
pbir connect MyWorkspace
pbir report rebind "Report.Report"
```

**Warning**: Rebinding to a model with different table/column names will break field bindings. After rebinding, validate and check for broken fields:

```bash
pbir validate "Report.Report"
pbir fields list "Report.Report"                 # Check field references
pbir tree "Report.Report" -v                     # Visual-level field audit
```

## Combining Multiple Reports

Merge pages, visuals, filters, and theme from multiple reports into one:

```bash
# Merge two reports (first report wins on conflicts like theme, report-level filters)
pbir report merge "Sales.Report" "Inventory.Report" -o "Combined.Report"

# Merge three or more
pbir report merge "R1.Report" "R2.Report" "R3.Report" -o "All.Report" -f
```

Conflict resolution: the **first report** listed takes priority for report-level settings (theme, report filters, bookmarks, extension measures). Pages from all reports are included, with name conflicts resolved by appending suffixes.

After merging, validate and review:

```bash
pbir validate "Combined.Report"
pbir tree "Combined.Report" -v                   # Verify all pages and visuals present
pbir theme colors "Combined.Report"              # Check theme (from first report)
pbir dax measures list "Combined.Report"         # Check extension measures
```

## Splitting a Report by Page

Split a multi-page report into separate single-page reports:

```bash
pbir report split-pages "Report.Report"
pbir report split-pages "Report.Report" -o ./split-reports
pbir report split-pages "Report.Report" -o ./split -F pbir   # Output as PBIR format
```

Each output report gets one page, plus the original report's theme, filters, bookmarks, and extension measures.

## Downloading from Fabric Workspace

```bash
pbir download "Workspace/Report" -o ./local --format pbir
pbir download "Workspace/Report" -o ./local --format pbip --open       # Open in Desktop
pbir download "Workspace/Report" -o ./local --format pbir --auto-deploy
```

## Recommended Workflow

1. **Check current format**: `pbir ls` to identify format and `pbir model` to check connection type
2. **Convert**: `pbir report convert` for format changes, `pbir report split-from-thick` for thick-to-thin
3. **Rebind** (if needed): `pbir report rebind` to point at correct model
4. **Validate**: `pbir validate` to catch broken field references or structural issues
5. **Verify**: `pbir tree -v` to confirm visuals and fields are intact
