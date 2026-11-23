---
title: Export a paginated report to a file with fab api
summary: Recipe for the ExportTo, status and file calls on a paginated report, plus datasource update, gateway bind and the .rdl import gotchas.
kind: recipe
status: current
sources:
  - url: https://learn.microsoft.com/en-us/rest/api/power-bi/reports/export-to-file-in-group
  - url: https://learn.microsoft.com/en-us/power-bi/developer/embedded/export-paginated-report
tools:
  fab: 1.7.0
last_updated: 2026-11-23
last_verified: 2026-11-23
review_cadence_days: 90
skills: [fabric-cli/fabric-cli]
---

# Export a paginated report to a file with fab api

Learn: [Export To File In Group](https://learn.microsoft.com/en-us/rest/api/power-bi/reports/export-to-file-in-group), [Export paginated reports](https://learn.microsoft.com/en-us/power-bi/developer/embedded/export-paginated-report) (formats, parameters, RLS, SSO identity blob, limits).

Paginated reports (.rdl) share the Reports API with .pbix reports. Tell them apart with `reportType`: `PaginatedReport` or `PowerBIReport`; `format` is `RDL`. All calls use `fab api -A powerbi` and the `groups/<ws-id>/reports/<report-id>` path.

```bash
fab api -A powerbi "groups/$WS_ID/reports" -q "text.value[?reportType=='PaginatedReport'].{name:name, id:id}"
```

## Export flow

Asynchronous, three calls, all against the report:

```bash
EXPORT_ID=$(fab api -A powerbi -X post "groups/$WS_ID/reports/$REPORT_ID/ExportTo" -i '{"format": "PDF", "paginatedReportConfiguration": {"parameterValues": [{"name": "Month", "value": "2026-03"}], "formatSettings": {"PageHeight": "11in", "PageWidth": "8.5in"}}}' -q "text.id")
fab api -A powerbi "groups/$WS_ID/reports/$REPORT_ID/exports/$EXPORT_ID" -q "text.status"
fab api -A powerbi "groups/$WS_ID/reports/$REPORT_ID/exports/$EXPORT_ID/file" > invoice.pdf
```

Poll the middle call until `Succeeded` (also `NotStarted`, `Running`, `Failed`); wait for the `Retry-After` header between polls. The file URL expires 24 hours after completion.

## Gotchas

- Use `paginatedReportConfiguration`, not `powerBIReportConfiguration`; all `parameterValues` values are strings; a multi-value parameter repeats the same `name` once per value.
- `formatSettings` takes report-server device info keys (`PageHeight`, `StartPage`, `EndPage`, `OutputFormat`, `AccessiblePDF`, `UseReportPageSize`). `PNG` as a format is Power BI reports only; for images use format `IMAGE` with `OutputFormat` (TIFF default, BMP, EMF, GIF, JPEG, PNG).
- `identities` with an RLS `username` must be a real Entra user; with SSO add `identityBlob.value`, an access token for `https://database.windows.net` (Azure SQL) or the Dataverse environment URL.
- Not supported: SSO semantic model datasource with an effective identity; DirectQuery to AAS or another model with an effective identity; UNC hyperlinks do not render.
- The report needs Premium, Embedded or Fabric capacity. Export is limited to 60 minutes. Learn says 250 concurrent render requests per capacity (the old note said 500, wrong), and PPU allows one request per 5 minutes before HTTP 429.

## Datasources, binding, import

```yaml
GET datasources: groups/<ws>/reports/<id>/datasources (paginated reports only)
update: POST .../Default.UpdateDatasources with updateDetails[]; same schema required, no type change, no ODBC, caller must own the datasource
take ownership first: POST .../Default.TakeOver (no body)
gateway: POST .../Default.BindToGateway with gatewayObjectId and bindDetails[]; on-premises gateways only
rebind to another semantic model: POST .../Rebind with datasetId
```

- Import an .rdl: `datasetDisplayName` must end in `.rdl`, `nameConflict` is only `Abort` or `Overwrite`, 20 MB maximum, asynchronous (`importState` goes Publishing then Succeeded or Failed). `fab api` cannot send multipart, so upload with another HTTP client. Unverified: this was not tested on fab 1.7.0.
- Download the definition: `fab api -A powerbi "groups/$WS_ID/reports/$REPORT_ID/Export" > Report.rdl`.

Unverified: request bodies were not re-run on fab 1.7.0. The status call is `GET .../exports/<id>` per Learn; the earlier reference wrongly appended `/status`.
