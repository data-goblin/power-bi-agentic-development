---
name: lineage-analysis
description: Find which Fabric reports and other items consume a semantic model across workspaces, before renaming, changing or deleting it. Use for "what depends on this model", downstream reports, cross-workspace impact. Not for dependencies inside a model; use `te deps` for those.
---

# Downstream consumers of a semantic model

Run this before any rename, deletion or breaking change; `te deps` only sees references inside the model.

```bash
MODEL_ID=$(fab get "Workspace.Workspace/Model.SemanticModel" -q "id" | tr -d '"')
fab api -A powerbi "groups" -q "value[].id"
fab api -A powerbi "groups/<workspaceId>/reports" -q "value[?datasetId=='$MODEL_ID'].{name:name,id:id,type:reportType}"
```

Loop the second call over every workspace you can read. Reports in unreadable workspaces do not show. The report list has no PBIR versus PBIRLegacy field (the REST response has none); use `pbir` on the report or the item definition format to tell them apart.

With a tenant admin token, use the scanner API instead: `fab api -A powerbi -X post "admin/workspaces/getInfo?lineage=true&datasourceDetails=true" -i body.json`, then poll `admin/workspaces/scanStatus/{scanId}` and read `admin/workspaces/scanResult/{scanId}`.

Not covered by the report scan, so say so in the answer: Excel live connections, composite models built on this model, notebooks (sempy), data agents, paginated reports, dataflows, XMLA clients. The lineage view in the service shows more item types.

Sources: https://learn.microsoft.com/en-us/rest/api/power-bi/reports/get-reports-in-group ; https://learn.microsoft.com/en-us/rest/api/power-bi/admin/workspace-info-post-workspace-info
