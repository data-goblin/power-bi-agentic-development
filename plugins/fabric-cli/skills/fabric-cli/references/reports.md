# Reports

What `fab` does with Power BI reports: inspect, export, import, copy, rebind, delete. Authoring and editing report content belongs to `pbir` (see the `pbir-cli` skill), never to hand-edited PBIR JSON.

## Learn

```yaml
report REST (Fabric): https://learn.microsoft.com/en-us/rest/api/fabric/report/items
report definition: https://learn.microsoft.com/en-us/rest/api/fabric/articles/item-management/definitions/report-definition
PBIR format: https://learn.microsoft.com/en-us/power-bi/developer/projects/projects-report
rebind REST (Power BI): https://learn.microsoft.com/en-us/rest/api/power-bi/reports/rebind-report-in-group
```

## Inspect

`fab get -q` is applied to the item itself, so there is no `text.` prefix and `-q id` prints the bare value.

```bash
fab get "ws.Workspace/Report.Report" -q id
fab get "ws.Workspace/Report.Report" -q "definition.parts[].path"
fab get "ws.Workspace/Report.Report" -q "definition.parts[?contains(path,'definition.pbir')].payload | [0]"
fab get "ws.Workspace/Report.Report" -q "definition.parts[?contains(path,'/visuals/')]" > visuals.json
```

- `definition.pbir` holds the model binding: `datasetReference.byConnection.connectionString` with `semanticmodelid=<guid>` for a service report, or `byPath` for a local PBIP; the `pbir-format` skill documents both
- Parts: `definition/report.json`, `definition/version.json`, `definition/pages/<page-id>/page.json`, `definition/pages/<page-id>/visuals/<visual-id>/visual.json`
- Count visuals by type: `jq -r '.[] | .payload.visual.visualType' < visuals.json | sort | uniq -c | sort -rn`
- List fields used: `jq` over `payload.visual.query.queryState.*.projections[].field` (`Column` or `Measure` with `Expression.SourceRef.Entity` and `Property`); use `pbir` commands where they cover it

## Export, import, copy

```bash
mkdir -p ./exports
fab export "ws.Workspace/Report.Report" -o ./exports -f
fab import "ws.Workspace/NewName.Report" -i ./exports/Report.Report -f
fab cp "dev.Workspace/Report.Report" "prod.Workspace" -f
```

- Import creates or overwrites; a different target name imports the report under a new name
- Create the export directory first; see [import-download-deploy.md](./import-download-deploy.md)
- Create a blank thin report with `pbir new report`; `fab mkdir "ws.Workspace/New Report.Report" -P semanticModelId=<model-id>` creates a report bound to that model (the parameter is optional; [mkdir](https://microsoft.github.io/fabric-cli/commands/fs/mkdir/))
- Clone onto another model: `pbir download` the template, `pbir cp`, `pbir report rebind <report> "ws.Workspace/NewModel.SemanticModel"`, `pbir validate <report> --all`, `pbir publish <report> "ws.Workspace/NewReport.Report"`

## Rebind

A thin report points at its model by id. After copying or importing it into another workspace, rebind it:

```bash
fab set "ws.Workspace/Report.Report" -q semanticModelId -i "<model-id>"
```

- Check the current binding first with the `definition.pbir` query above
- Deployment pipelines keep item ids, so promoted reports need no rebind (see [deployment-pipelines.md](./deployment-pipelines.md))
- `fab set` also renames (`-q displayName`) and sets `-q description`

## Delete

`fab rm "ws.Workspace/Report.Report" -f` is permanent unless the tenant has item recovery on (see [commands.md](./commands.md)).

## Permissions

`fab acl` does not work on reports (workspace, connection and gateway only; `fab acl ls` on a report returns `[UnsupportedCommand]`). Workspace roles: `fab acl ls "ws.Workspace"`. The [Power BI Reports REST reference](https://learn.microsoft.com/en-us/rest/api/power-bi/reports) has no report-user operations, so no REST call manages per-report users; see [permissions.md](./permissions.md).

## Troubleshooting

- Not found: `fab exists "ws.Workspace"`, then `fab ls "ws.Workspace"`
- Wrong binding: compare `definition.pbir` against the model id from `fab get -q id`
- Import fails: check the exported folder has `.platform` and `definition.pbir`, and that `definition/` JSON parses; run `pbir validate` on it
