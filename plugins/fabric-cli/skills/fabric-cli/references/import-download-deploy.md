# Import, download and promote

Getting item definitions out of Fabric, back in, and between workspaces. Every item has a serializable definition and a stable GUID; the rest follows from those.

## Learn

```yaml
item definitions: https://learn.microsoft.com/en-us/rest/api/fabric/articles/item-management/item-management-overview
Git integration: https://learn.microsoft.com/en-us/fabric/cicd/git-integration/intro-to-git-integration
long-running operations: https://learn.microsoft.com/en-us/rest/api/fabric/articles/long-running-operation
fab commands: https://microsoft.github.io/fabric-cli/
```

Options for every command: `fab export --help`, `fab import --help`, `fab cp --help`, `fab bulk-export --help`.

## Export

```bash
mkdir -p ./exports
fab export "Production.Workspace/Sales.Report" -o ./exports -f
fab export "ws.Workspace/ETL.Notebook" -o ./exports --format py -f
fab export "Production.Workspace" -o ./backup -a -f
fab bulk-export "Production.Workspace" -o ./backup --recursive
```

- Create the output directory first; `fab export` does not and fails with `[InvalidPath] No such file or directory`
- `-f` skips the sensitivity-label prompt and exports without the label; the warning "Item definition is exported without its sensitivity label and its data" is informational, the real error follows on the next line
- `bulk-export` keeps folder structure and bindings, and needs `--recursive` for workspace and folder targets; plain `export -a` flattens
- Names with apostrophes work inside double quotes
- Check which types round-trip with `fab desc .<ItemType>` (the command list includes `export`)

```yaml
Report: PBIR folder (.platform, definition.pbir, definition/)
SemanticModel: TMDL folder (.platform, definition/model.tmdl, tables/)
Notebook: .py, .ipynb or folder, chosen with --format
DataPipeline: JSON folder
Lakehouse: metadata only; Files are not in the definition, copy them with fab cp
Dashboard, SQLEndpoint: not exportable (use fab cp for dashboards; the SQL endpoint comes with its lakehouse)
```

- `.platform` is the manifest (display name, type, logical id); `definition/` is the editable source, which the `pbir-cli`, `pbir-format`, `tmdl` and `pbip` skills edit
- Export skips lakehouse `Files` and `Tables`; for a full backup run `uv run ${CLAUDE_SKILL_DIR}/scripts/download_workspace.py "Production.Workspace" ./backup`, which also copies lakehouse files

### PBIP project from a model

```bash
fab export "Production.Workspace/Sales.SemanticModel" -o ./sales-pbip -f
pbir new report "./sales-pbip/Sales.Report" --connection "Production.Workspace/Sales.SemanticModel" --format pbir
pbir report merge-to-thick "./sales-pbip/Sales.Report" "./sales-pbip/Sales.SemanticModel" --output ./sales-project
```

Create report files through `pbir`, never by hand-writing PBIR JSON.

## Import

```bash
fab import "ws.Workspace/New.Notebook" -i ./local/Nb.Notebook -f
fab import "Production.Workspace/Sales.Report" -i ./exports/Sales.Report -f
```

- Creates the item or overwrites an existing one; always pass `-f` in scripts, because without it the overwrite prompt hangs when stdin is not a terminal
- Definition create and update are long-running operations; `fab import` measured 25 to 60 s for one notebook on fab 1.7.0 because it polled at the server's `Retry-After: 20` while the work finished in about 1 s (F2 capacity, 40 KB notebook); fab 1.9.0 release notes say LRO polling was improved without a number, so re-measure there
- For hand-rolled REST on definition-based items, poll create-with-definition and `updateDefinition` at about 0.3 s, and honour `Retry-After` on 429
- `uv run ${CLAUDE_SKILL_DIR}/scripts/deploy_notebook.py "ws.Workspace/ETL.Notebook" -i ./ETL.Notebook` tight-polls (`--poll-interval`, default 0.3 s), auto-detects create versus update, takes a fab-export folder or a bare `.ipynb`, and supports `--update-only` and `--format json`
- Import order matters when doing it by hand: Lakehouse or Warehouse, then SemanticModel, Report, Dashboard; pipelines order it for you

### Rebind thin reports

A thin report points at a model by id. After import or copy into another workspace the id is still the source's:

```bash
fab set "Production.Workspace/Sales.Report" -q semanticModelId -i "<target-model-id>"
```

See [reports.md](./reports.md) for byPath and byConnection rebinding.

## Copy and move

```bash
fab cp "Dev.Workspace/Pipeline.DataPipeline" "Production.Workspace" -f
fab cp "Dev.Workspace/Report.Report" "Production.Workspace/ProdReport.Report" -f
fab cp "Dev.Workspace" "Production.Workspace" -r -f
fab cp "Dev.Workspace/Report.Report" "Production.Workspace" -bpc -f
```

- `cp` works inside one tenant with no local round trip; it copies definitions, not data
- `-r` copies a whole workspace with folders; `-bpc` blocks the copy when a same-name item exists in a different folder
- `fab mv` removes the source after a successful write; `fab ls` the source first

## Promoting between environments

- Governed path: deployment pipelines or the config-file deploy subcommand (see [deployment-pipelines.md](./deployment-pipelines.md)); pipelines keep item ids, so thin reports need no rebinding
- Manual path: export, import each item, rebind thin reports, refresh models
- Cross-tenant: `fab cp` is tenant-scoped; export, `fab auth login` to the target tenant, import, then rebind reports and recreate connections and gateway references (connection ids are tenant-local)

## Git and PBIP

PBIP is the local source-control format. Flow: `fab export` (or `pbir download`, `pbir report convert`), edit locally with `te` for models and `pbir` for reports, commit, then `fab import` or let Fabric Git integration sync (see [../../../wiki/workspaces.md](../../../wiki/workspaces.md)).
