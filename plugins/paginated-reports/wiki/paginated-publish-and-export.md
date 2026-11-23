---
title: Publishing an RDL and exporting it to confirm it renders
summary: The Imports API upload, the three-step export-to-file flow, item-type strings and the Fabric Git folder layout.
kind: recipe
status: current
sources:
  - url: https://learn.microsoft.com/en-us/rest/api/power-bi/imports/post-import-in-group
  - url: https://learn.microsoft.com/en-us/rest/api/power-bi/reports/export-to-file-in-group
last_updated: 2026-11-23
last_verified: 2026-11-23
review_cadence_days: 90
skills: [paginated-reports/paginated-report]
---

# Publishing an RDL and exporting it to confirm it renders

The scripts `publish_rdl.sh` and `export_rdl.sh` (`.ps1` twins for Windows) in `skills/paginated-report/scripts/` wrap the calls below. They need `curl`, `jq` and either `$PBI_TOKEN` or the `az` CLI to mint one; the token is never written to disk.

## Upload ([Imports API](https://learn.microsoft.com/en-us/rest/api/power-bi/imports/post-import-in-group))

```bash
publish_rdl.sh Report.rdl <workspaceId> [Overwrite|Abort] [displayName]
```

```yaml
endpoint: multipart POST to the Imports API, not the Fabric Items API (fab api cannot send the multipart body)
datasetDisplayName: must end in .rdl
nameConflict: Abort or Overwrite only; Overwrite on a report that does not exist returns 404 and Abort on an existing name errors, so the script detects which one applies
size: 20 MB maximum (Unverified)
completion: asynchronous; poll the import until Succeeded or Failed
after_publish: Azure SQL needs its authentication type set in workspace settings; on-premises sources need a gateway bound; a PBIDATASET source with ClaimsToken needs nothing
capacity: the workspace must be on Premium, Embedded or Fabric capacity; shared capacity accepts the upload and does not render the report
```

## Export ([export-to-file](https://learn.microsoft.com/en-us/rest/api/power-bi/reports/export-to-file-in-group))

```bash
export_rdl.sh <reportId> <workspaceId> [format] [outfile]
```

```yaml
step_1: POST .../ExportTo
step_2: poll GET .../exports/{id} until Succeeded (the status URL is the export resource itself, not .../exports/{id}/status)
step_3: GET .../exports/{id}/file
export_id: opaque base64; URL-encode it into the path
parameters: PBI_PARAMS holds a JSON array of report parameters
```

Learn's REST pages were not re-read for this edit; the flow below is carried over from the scripts and earlier notes.

A non-empty PDF is the pass condition: check the file size, and `pdftotext file.pdf - | wc -w` greater than zero when poppler is installed.

## Item types

```yaml
path_extension: .PaginatedReport
Power BI REST reportType: PaginatedReport
Power BI REST format: RDL
Fabric Items API type: PaginatedReport
```

## Fabric Git layout (Unverified)

Earlier notes in this repository describe a folder `<Name>.PaginatedReport/` holding the `.rdl` and a `.platform` file (see `assets/platform-template.json`), no `definition/` folder, and note that the Fabric Items API cannot create a paginated report with a definition payload. The public json-schemas repository has no paginated report item folder to validate the `.platform` against, and the Learn REST definition page was not found on 2026-11-23. Round-trip it in a test workspace before relying on it.
