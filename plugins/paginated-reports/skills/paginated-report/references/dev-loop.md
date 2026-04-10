# Dev / Test Loop

How to iterate on an `.rdl` and confirm it actually renders, with the least infrastructure. The full Power BI REST surface for paginated reports (upload, export-to-file, datasource management, gateway binding, RLS) is documented in the `fabric-cli` skill at `references/paginated-reports.md`; this reference covers the loop and the things specific to authoring, and points there for the API details rather than repeating them.

## The loop

```
1. Author / edit the .rdl  (edit XML directly, or in Power BI Report Builder)
2. Validate structurally    scripts/validate_rdl.py Report.rdl
3. Iterate layout offline    Enter Data dataset -> render in Report Builder or local PBIRS
4. Publish to a workspace    scripts/publish_rdl.sh Report.rdl <workspaceId>
5. Render / export to verify  scripts/export_rdl.sh <reportId> <workspaceId>   (or open in browser)
6. (Optional) commit to Git   upload to the workspace first, then commit via Fabric Git
```

Steps 2 and 3 are local and free; do most of the work there before touching the service. Step 4 onward needs Premium/Embedded/Fabric capacity for the report to actually run.

## Iterate layout with Enter Data before wiring the real source

The biggest time sink is re-querying a live source on every layout tweak. Avoid it: build the layout against an Enter Data inline dataset (a fixed, typed handful of rows embedded in the `.rdl`, see `references/data-sources.md`), get the tablix, grouping, page breaks, and formatting right, then swap the data source and dataset query for the real one. The field names in the Enter Data set should match the real query's fields so the swap touches only the `<DataSource>` and `<DataSet><Query>`, not the layout. `enter-data-starter.rdl` is set up this way.

## Validate before publishing

`scripts/validate_rdl.py` runs the cheap, deterministic structural checks that catch the breakage hand-editing introduces: XML well-formedness, the 2016 root namespace, a present and valid `rd:ReportID` GUID, top-level element ordering, `Name` uniqueness, tablix column/row/cell count invariants, dataset-to-datasource references, and embedded-image references. It does not validate expressions, field references against a live model, or render correctness; those surface only at render time. Run it after every structural edit. A clean validator pass plus a successful render is the bar before calling a report done.

## Local rendering with Power BI Report Server (PBIRS)

PBIRS is an on-premises Windows web server that hosts and renders `.rdl` files with the same RDL processor as the cloud service. A Microsoft recommendation for the dev loop: render locally on PBIRS during layout iteration, before publishing.

Why it helps:

- Instant publish (copy the `.rdl` to the web portal at `http://localhost/reports`); no cloud round-trip, no capacity needed.
- Same render engine, so layout and pagination behavior are faithful.
- Local SQL sources need no gateway; Report Builder previews live against PBIRS.

Cloud-only features PBIRS lacks: Power BI semantic models as a data source, Git integration, sensitivity labels, accessible PDF, PPTX export. So a report that targets a semantic model cannot be rendered end-to-end on PBIRS, but its layout and pagination still can (point it at Enter Data or a local SQL stand-in for the local loop, then swap to PBIDATASET for the service).

Free Developer/Evaluation editions exist (`microsoft.com/power-platform/products/power-bi/report-server`); production needs SQL Server Enterprise + Software Assurance. Do not install anything without asking the user.

One gotcha: the **Enter Data (`ENTERDATA`) extension is not registered on PBIRS by default**. To render an Enter Data report locally, add it to the `<Data>` section of `RsReportServer.config`:

```xml
<Extension Name="ENTERDATA" Type="Microsoft.ReportingServices.DataExtensions.XmlDPConnection,Microsoft.ReportingServices.DataExtensions">
  <Configuration><ConfigName>ENTERDATA</ConfigName></Configuration>
</Extension>
```

In the Power BI service, Enter Data works with no configuration.

## Publishing to the Power BI service / Fabric

Upload is the Power BI **Imports** API (a multipart form post), not the Fabric Items API. `scripts/publish_rdl.sh` wraps it: it takes a token from `$PBI_TOKEN` or mints one inline via `az account get-access-token`, auto-picks `Abort` (new report) or `Overwrite` (existing one), posts the `.rdl`, and polls the import to `Succeeded`/`Failed`. Usage:

```bash
scripts/publish_rdl.sh /path/to/Report.rdl <workspaceId> [Overwrite|Abort]
```

Key constraints: `datasetDisplayName` must end in `.rdl`; `nameConflict` is only `Abort` or `Overwrite`, and the two are asymmetric (`Overwrite` requires the report to already exist or returns a 404, `Abort` creates a new one but errors on a name clash, which is why the script auto-detects); max 20 MB; import is async. After publish, set the data source authentication (Azure SQL needs its auth type set in workspace settings; on-prem needs a gateway bound). For a PBIDATASET source using `Integrated Security=ClaimsToken`, no credential setup is needed; it renders as the signed-in user (SSO).

Render to confirm with `scripts/export_rdl.sh <reportId> <workspaceId> [format]` (set `PBI_PARAMS` to a JSON array to pass report parameters). It wraps the three-step export-to-file flow: `POST .../ExportTo`, poll `GET .../exports/{id}` until `Succeeded` (note: the status URL is the export resource itself, **not** `.../exports/{id}/status`), then `GET .../exports/{id}/file`. The export id is opaque base64 and must be URL-encoded into the path. The `fabric-cli` reference covers the wider option surface (RLS identities, format settings, image sub-formats).

Confirm the target workspace with the user before uploading. Discover candidates with `fab` (the `fabric-cli` skill): the workspace must be backed by Premium/Embedded/Fabric capacity for a paginated report to run; shared capacity will accept the upload but the report will not render.

## Fabric Git on-disk layout

When a workspace is connected to Git, a paginated report exports as a folder containing just the `.rdl` plus a `.platform` file:

```
SalesReport.PaginatedReport/
  SalesReport.rdl
  .platform
```

```json
{
  "version": "2.0",
  "$schema": "https://developer.microsoft.com/json-schemas/fabric/platform/platformProperties.json",
  "config": { "logicalId": "<guid>" },
  "metadata": { "type": "PaginatedReport", "displayName": "SalesReport", "description": "" }
}
```

There is no `definition/` subfolder and no JSON sidecar; the whole report is the single `.rdl`. Constraints: in earlier previews the report had to exist in the service before committing to Git; current Fabric Git can import a `<Name>.PaginatedReport/` folder directly, but this is preview-grade so verify the round-trip in your own tenant before relying on Git-first creation. Deleting requires removing the whole folder, renaming in Git does not work (rename in the service then re-sync), and Git integration needs Fabric capacity and is in preview.

Note the Fabric Items REST API does **not** support creating a PaginatedReport with a definition payload or getting its definition (only Update-metadata and List). Use the Power BI Imports API (`publish_rdl.sh`) for create/update and `fab .../Export` for download, not the Fabric Items definition round-trip.

## Item-type strings

```
fab path extension        .PaginatedReport
Power BI REST reportType   PaginatedReport
Power BI REST format       RDL
Fabric Items API type      PaginatedReport
```
