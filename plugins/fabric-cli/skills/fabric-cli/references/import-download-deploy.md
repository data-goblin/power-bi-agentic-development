# Import, Download, and Deploy

How to get items out of Fabric, how to get them back in, and how to move them between workspaces for dev / test / prod promotion. Every Fabric item has a serializable definition and a stable GUID; everything below revolves around those two facts.

## Download from Fabric (export)

`fab export` pulls the definition of a single item to a local directory. `fab cp` with a local destination copies lakehouse Files instead, since Lakehouse items don't expose a real definition.

```bash
# Single item, default format
mkdir -p /tmp/exports
fab export "Production.Workspace/Sales.Report" -o /tmp/exports -f

# Explicit format (see "Supported item types" below for format-by-type)
fab export "ws.Workspace/ETL.Notebook" -o /tmp --format py -f

# Entire workspace (all items at once)
mkdir -p /tmp/backup
fab export "Production.Workspace" -o /tmp/backup -a -f
```

**Always `mkdir -p` the output directory first.** `fab export` does not create intermediate directories and will fail with `[InvalidPath] No such file or directory` if the parent doesn't exist.

**Names with apostrophes** (e.g. `Claude Code's Workspace`) work fine inside double quotes ; no shell escaping needed:

```bash
mkdir -p /tmp/exports
fab export "Claude Code's Workspace.Workspace/Report.Report" -o /tmp/exports -f
```

**`-f` flag behavior on export:** The `-f` (force) flag skips the sensitivity-label confirmation prompt AND exports the item definition without its sensitivity label. The warning `Item definition is exported without its sensitivity label and its data` is informational, not an error. The real error, if any, follows on the next line.

### Supported item types

| Type | Local format | Notes |
|---|---|---|
| `.Report` | PBIR folder | Double-click `.pbir` to open in Power BI Desktop (Developer Mode). See the [pbir-cli](../../../../reports/skills/pbir-cli/SKILL.md) and [pbir-format](../../../../pbip/skills/pbir-format/SKILL.md) skills for editing. |
| `.SemanticModel` | TMDL folder | Open with Power BI Desktop or Tabular Editor. See the [tmdl](../../../../pbip/skills/tmdl/SKILL.md) skill for authoring. |
| `.Notebook` | `.py` / `.ipynb` / folder | Fabric notebook format; pass `--format py` for plain Python. |
| `.DataPipeline` | JSON folder | Pipeline definition as nested JSON. |
| `.Lakehouse` | Metadata only | **Files are not part of the definition.** Use `fab cp` to copy Files contents separately. |
| `.Dashboard` | Not exportable | Tile-based dashboards; no definition surface. Use `fab cp` between workspaces. |
| `.SQLEndpoint` | Not exportable | Auto-provisioned with its parent Lakehouse. |

Check export support per item type with `fab desc .<ItemType>` ; the supported commands list includes `export` for every type that can round-trip.

### Export output structure

```
output/
  Report.Report/
    .platform
    definition.pbir
    definition/
      report.json
      pages/
  Model.SemanticModel/
    .platform
    definition/
      model.tmdl
      database.tmdl
      tables/
```

The `.platform` file is the item manifest (display name, type, item ID). The `definition/` subdirectory holds the editable source. Paths inside `definition/` are what the pbip and pbir-cli skills operate on.

### Full workspace snapshot (including lakehouse files)

`fab export -a` skips Lakehouse Files and will miss anything stored in `Files/` or `Tables/` inside a Lakehouse. For a true backup, use the [`download_workspace.py`](../scripts/download_workspace.py) script, which walks every item in the workspace, exports each definition, and additionally `fab cp`'s all lakehouse files to disk:

```bash
python3 scripts/download_workspace.py "Production.Workspace" ./backup
```

### Semantic model as PBIP project

`fab export` on a `.SemanticModel` produces a TMDL folder. For a full PBIP project (TMDL + blank report, openable directly in Power BI Desktop and ready for git), use [`export_semantic_model_as_pbip.py`](../scripts/export_semantic_model_as_pbip.py):

```bash
python3 scripts/export_semantic_model_as_pbip.py \
  "Production.Workspace/Sales.SemanticModel" -o ./sales-pbip
```

The resulting project layout matches what Power BI Desktop creates when you save as PBIP. See the [pbip](../../../../pbip/skills/pbip/SKILL.md) skill for structure, rename workflows, and the pbir / tmdl companion skills for editing reports and models inside a PBIP project.

## Upload back to Fabric (import)

`fab import` sends a local definition back to Fabric. If the destination already exists it is overwritten; if not, a new item is created.

```bash
# Create new or overwrite existing
fab import "ws.Workspace/New.Notebook" -i ./local-path/Nb.Notebook -f

# Import a report back to a specific workspace
fab import "Production.Workspace/Sales.Report" -i /tmp/exports/Sales.Report -f
```

**Always pass `-f`** for non-interactive execution. Without it, `fab import` prompts for overwrite confirmation and will hang in scripts, CI, or anywhere stdin is not a terminal.

### Reports imported without their model need rebinding

A thin `.Report` is a pointer to a `.SemanticModel` via its ID. When you import a report to a different workspace than the original, the dataset ID in `definition.pbir` is still the source ID and must be rebound to the target:

```bash
# After importing a report to the target workspace
fab set "Production.Workspace/Sales.Report" \
  -q semanticModelId \
  -i "<target-model-id>"
```

See [reports.md](./reports.md) for alternative byPath / byConnection rebinding patterns and the full thin-report workflow.

### Bulk import from a directory

```bash
# Import every item in a directory
for item in ./exports/*; do
  name=$(basename "$item")
  fab import "Production.Workspace/$name" -i "$item" -f
done
```

### Bulk export by type (round-trip prep)

```bash
# Export every semantic model in a workspace
fab ls "ws.Workspace" | grep ".SemanticModel" | while read item; do
  fab export "ws.Workspace/$item" -o ./models -f
done

# Export every report
fab ls "ws.Workspace" | grep ".Report" | while read item; do
  fab export "ws.Workspace/$item" -o ./reports -f
done
```

The `fab ls` + `while read` pattern is fragile for names with spaces; prefer `fab ls -q "[].name" -o /tmp/names.json` and a Python loop for production automation.

## Copy and move between workspaces

`fab cp` copies an item directly between workspaces in the same tenant without a local round-trip. It's dramatically faster than export + import when you don't need to edit the definition in between.

```bash
# Copy a single item
fab cp "Dev.Workspace/Pipeline.DataPipeline" "Production.Workspace" -f

# Copy with rename
fab cp "Dev.Workspace/Report.Report" "Production.Workspace/ProdReport.Report" -f

# Copy an entire workspace (items + folder structure)
fab cp "Dev.Workspace" "Production.Workspace" -r -f

# Block the copy if an item with the same name exists in a different folder
fab cp "Dev.Workspace/Report.Report" "Production.Workspace" -bpc -f
```

`fab mv` has the same ergonomics but removes the source after a successful write. Always `fab ls` the source tree first to confirm exactly what will move.

### After copying a thin report

Thin reports copied with `fab cp` carry their original `semanticModelId`. If the target workspace has its own copy of the model, rebind:

```bash
fab set "Production.Workspace/Report.Report" -q semanticModelId -i "<prod-model-id>"
```

## Environment migration (Dev → Test → Prod)

Two supported paths:

1. **Deployment pipelines** (recommended for governed environments) ; see [deployment-pipelines.md](./deployment-pipelines.md) for the Fabric vs. Power BI pipelines API, selective deploy mechanics, `allowPurgeData` / `allowTakeOver` flags, and LRO polling. Pipelines preserve item IDs across stages, so thin reports don't need rebinding.
2. **Manual export / import** (ad-hoc, dev work, or cross-tenant):

   ```bash
   # 1. Export dev
   mkdir -p /tmp/migration
   fab export "Dev.Workspace" -o /tmp/migration -a -f

   # 2. Import to prod, item by item
   fab import "Production.Workspace/Pipeline.DataPipeline" \
     -i /tmp/migration/Pipeline.DataPipeline -f
   fab import "Production.Workspace/Sales.SemanticModel" \
     -i /tmp/migration/Sales.SemanticModel -f
   fab import "Production.Workspace/Sales.Report" \
     -i /tmp/migration/Sales.Report -f

   # 3. Rebind thin reports (the model ID is different in prod)
   fab set "Production.Workspace/Sales.Report" \
     -q semanticModelId \
     -i "<prod-model-id>"

   # 4. Smoke-test the deployed items
   fab api -A powerbi \
     "groups/<prod-ws-id>/datasets/<prod-model-id>/refreshes" \
     -X post -i '{"type":"Full"}'
   ```

**Order matters.** Deploy dependencies first (Lakehouse / Warehouse → Semantic Model → Report → Dashboard), otherwise the downstream item lands broken. Deployment pipelines handle the ordering for you; manual import does not.

### Cross-tenant forks

`fab cp` is tenant-scoped and cannot move items between tenants. For cross-tenant work:

1. `download_workspace.py` or `fab export` into a local directory
2. `fab auth login` to the target tenant
3. `fab import` each item into the target workspace
4. Rebind thin reports and re-establish gateway / connection references (connection IDs are tenant-local)

## PBIP and git-integrated workflows

PBIP is the local source-control format for semantic models and reports. Use PBIP when you want:

- Multi-author editing via git branches
- External editors (Tabular Editor, VS Code, Cursor) on the model and report source
- CI validation via [`pbip`](../../../../pbip/skills/pbip/SKILL.md) + [`pbir-cli`](../../../../reports/skills/pbir-cli/SKILL.md) + [`tmdl`](../../../../pbip/skills/tmdl/SKILL.md) + [`pbir-format`](../../../../pbip/skills/pbir-format/SKILL.md) skills

Typical flow:

1. **Export or convert** ; `fab export` a semantic model and its reports into a PBIP folder, or use the `export_semantic_model_as_pbip.py` script for a complete project.
2. **Edit locally** ; use the pbip / pbir-cli / tmdl skills to manipulate TMDL tables, measures, and PBIR visuals. Report renames cascade through `definition.pbir` and all visual bindings ; the pbip skill handles that.
3. **Commit to git** ; PBIP text files are diff-friendly and merge well.
4. **Publish back** ; either `fab import` each item or, for workspaces connected to git, let the Fabric git integration sync the changes (see [workspaces.md](./workspaces.md#git-integration)).

The pbip, pbir-cli, tmdl, and pbir-format skills are the authoritative references for everything inside a PBIP folder. `fab` owns the round-trip into and out of the Fabric service; the PBIP skills own what happens between the export and the import.

## See also

- [deployment-pipelines.md](./deployment-pipelines.md) ; CI/CD promotion via deployment pipelines
- [reports.md](./reports.md) ; thin-report rebinding, PBIR format specifics
- [semantic-models.md](./semantic-models.md) ; TMDL round-trips, Direct Lake / Import / DirectQuery migration
- [workspaces.md](./workspaces.md) ; git integration, workspace-level operations
- [`scripts/download_workspace.py`](../scripts/download_workspace.py) ; full workspace backup including lakehouse files
- [`scripts/export_semantic_model_as_pbip.py`](../scripts/export_semantic_model_as_pbip.py) ; PBIP project export
