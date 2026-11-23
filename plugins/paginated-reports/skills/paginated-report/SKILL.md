---
name: paginated-report
description: Authors, validates, publishes and renders Power BI paginated reports (.rdl). Use for "paginated report", ".rdl", "Report Builder", "Power BI Report Builder", "PBIRS", invoices or statements that must print, a paginated report on a semantic model (PBIDATASET), or publishing and exporting an .rdl to PDF. Not for interactive PBIR reports.
---

# Paginated reports (RDL)

## Rules

- Copy the closest starter in `assets/` and change data source, query, fields and layout; do not type RDL from scratch. Give the copy a fresh `rd:ReportID`
- Edit the XML directly; Report Builder is only a GUI over it. Order that Report Builder writes: DataSources, DataSets, ReportSections, ReportParameters, ReportParametersLayout. The 2016 schema does not enforce it, so keep it anyway: [element order and page frame](../../wiki/rdl-structure-and-order.md)
- PDF width trap: `ReportSection/Width` + `LeftMargin` + `RightMargin` must be at most `PageWidth` or PDF, Image and Word add blank pages on the right. HTML preview never shows it. Landscape Letter with 0.5in margins leaves 10in
- Preview is HTML; judge pagination only from an export in the delivery format
- Semantic model source: `DataProvider` PBIDATASET, `Initial Catalog=sobe_wowvirtualserver-<model id>`, `Integrated Security=ClaimsToken`. Column fields are `Table[Column]`, measures `[Measure]` and always `System.String` (cast with `CDbl`). Query parameters carry no `@` in the QueryParameter name for DAX and carry it for SQL; use single-value `TREATAS` rather than hand-written `RSCustomDaxFilter`: [connection, fields, parameters](../../wiki/pbidataset-connection-and-fields.md)
- XML-escape query text (`&amp;&amp;` for DAX `&&`, `&lt;=` for `<=`). Dimensions need a unit (`in cm mm pt pc`, never px)
- Filter and aggregate in the query: dataset and tablix filters run after the full fetch. Move date and string logic out of RDL expressions so the report can run in the optimized environment (Diagnostics button lists the offenders)
- Volume: about 1,000,000 rows of 15 to 20 columns on the standard environment, about twice that on optimized; a query returning more than 2 GB is aborted. Details and what the service does not support (shared datasets, linked reports, custom fonts and assemblies, US-format DateTime parameters, 250 data sources): [limits](../../wiki/paginated-limits-and-differences.md)
- Interactive, screen-first reports belong in PBIR (`reports` plugin). Classic SSRS differs: embed every data source and use the 2016 schema

## Workflow

1. Ask for purpose, data source, parameters, output format, page size and orientation, and the target workspace (Premium, Embedded or Fabric capacity). Propose a draft rather than collecting a long list
2. Start from `assets/enter-data-starter.rdl` (no source needed), `assets/semantic-model-starter.rdl` or `assets/sql-starter.rdl`. Build the layout against the Enter Data dataset first and keep its field names equal to the real query's
3. Validate after every structural edit: `python3 scripts/validate_rdl.py report.rdl`. The plugin's PostToolUse hook runs the same checks on every `.rdl` write and blocks on errors; it needs Python 3.8 or later and says so on stderr when it is missing
4. Wire the real source, validate again, and run the exact `EVALUATE` or SQL against the live source to confirm column names and types match the `<Field>` definitions (`te query` for a model)
5. Publish: `scripts/publish_rdl.sh report.rdl <workspaceId>` (Imports API upload, picks Abort or Overwrite itself). Confirm the workspace with the user first
6. Render and confirm: `scripts/export_rdl.sh <reportId> <workspaceId> pdf out.pdf`. The report is done only when the PDF is non-empty and shows the expected rows; a green validator is not enough. Details: [publish and export](../../wiki/paginated-publish-and-export.md)

## What the validator checks

Well-formedness, 2016 namespace, `ReportID` GUID, top-level order, unique names, tablix column, row and cell counts, dataset, data source and image references, unit suffixes, the PDF width trap, and that every `Fields!X`, `Parameters!X` and `ReportItems!X` in an expression resolves to a field of the dataset in scope, a report parameter or a named item. It warns on QueryParameters the query never uses. It does not check DAX, SQL or rendering.

## References

- Real samples to copy constructs from (charts, matrix, sparklines): [example reports](../../wiki/paginated-example-reports.md)
- REST surface beyond publish and export (data source binding, gateways, RLS, admin): `references/paginated-reports.md` in the fabric-cli skill
- Author DAX for `PBIDATASET` datasets with the `dax` skill of the semantic-models plugin before pasting it into `<CommandText>`
