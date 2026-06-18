---
name: paginated-report
version: 26.25
description: Author, validate, publish, and test Power BI paginated reports in the RDL format. Automatically invoke when the user mentions "paginated report", "RDL", ".rdl", "Report Builder", "Power BI Report Builder", "SSRS report", "PBIRS", "Power BI Report Server", or asks to "create a paginated report", "build an invoice/statement report", "make a print-perfect report", "connect a paginated report to a semantic model", "edit an RDL file", "publish an .rdl", or "render a paginated report to PDF/Excel".
---

# Paginated Reports (RDL)

A paginated report is a print-faithful, multi-page document (invoice, statement, operational list, regulatory filing) defined by a single `.rdl` XML file. The `.rdl` is plain, hand-editable, diff-friendly XML holding everything: data sources, datasets, parameters, page setup, layout, and expressions. Power BI Report Builder is a Windows GUI over this same XML, so a coding agent edits the artifact directly.

This skill teaches the RDL format and its unwritten rules, how to connect to data, the rendering quirks, and a dev loop that confirms a report actually renders. It is the home for everything RDL. For interactive screen-first reports (PBIR), use `reports:create-pbi-report` instead; see "Is paginated the right tool?" in `references/report-structure.md`. This is for Power BI paginated reports (the Power BI service / Fabric), not classic SSRS; the format is shared but the environment differs (see `references/differences-with-ssrs.md`).

## Before building: interview the user

A paginated report is a fixed-format document where the data source, parameters, and delivery target are expensive to change later. Before authoring anything, run a requirements interview using **`references/questionnaire.md`**. Treat it as a dynamic, two-way conversation, not a form: research the data source yourself (inspect it, run candidate DAX, read a similar example), bring concrete options and a quick Enter Data draft for the user to react to, and follow the threads that matter rather than reading a fixed list. Settle the essentials (purpose, data source, target workspace and capacity), reflect back a short brief, then build against it and refine the rest as the draft takes shape.

## Three rules that prevent most breakage

1. **Element order is load-bearing in practice.** Report Builder and the report processor's reader expect the conventional order and fail to load out-of-order children with no useful error (the failure is from the processor, not schema validation, so an XSD validator will not reliably catch a reorder). Preserve the documented order when editing. This is the number-one cause of a broken hand-authored `.rdl`.
2. **Validate after every structural edit.** Run `scripts/validate_rdl.py <file.rdl>` to catch order, name-collision, tablix-count, reference, and unit errors before publishing. A clean pass plus a successful render is the bar for "done".
3. **Reuse a template, do not hand-type from scratch.** The verbose XML (charts especially) is error-prone to write by hand. Copy the closest `assets/*.rdl` starter and change the data source, query, fields, and layout. Regenerate `rd:ReportID` to a fresh GUID when copying.

## Workflow

```
1. Pick a starting template       assets/enter-data-starter.rdl | semantic-model-starter.rdl | sql-starter.rdl
2. Iterate layout offline          edit XML; keep an Enter Data dataset so no live source is hit
3. Validate                        python3 scripts/validate_rdl.py report.rdl
4. Wire the real data source       swap <DataSource>/<DataSet><Query>; keep field names so layout is untouched
5. Validate again                  python3 scripts/validate_rdl.py report.rdl
6. Publish to a workspace          scripts/publish_rdl.sh report.rdl <workspaceId>
7. RENDER AND CONFIRM (hard gate)  scripts/export_rdl.sh <reportId> <workspaceId>  ->  open the PDF
```

Steps 2-3 are local and free. Do the layout work against the Enter Data inline dataset (a fixed handful of typed rows embedded in the `.rdl`) before touching a live source; re-querying a real source on every layout tweak is the biggest time sink. Keep the Enter Data field names identical to the real query's fields so swapping the source touches only the `<DataSource>` and `<DataSet><Query>`, never the layout. Publishing and rendering need a workspace on Premium/Embedded/Fabric capacity.

**Step 7 is the real bar, not step 5.** A green `validate_rdl.py` is necessary but not sufficient: it checks structure, never expressions, field references, or DAX, so a report with a wrong `DataField`, a mistyped measure, a `@`-prefix mismatch, or a parameter pointing at the wrong column passes validation, publishes, and only fails (or renders blank/wrong) at export. So the moment the real source is wired (step 4), render immediately and: confirm the PDF opens with the **expected, non-empty content**; read the export error body if it fails; and verify the data contract by running the exact `EVALUATE`/SQL against the live source (via `semantic-models:dax`) and checking the returned column names and types match the `<Field>` definitions. Do not call a report done on a green validator alone.

## Starting templates (assets/)

- **`enter-data-starter.rdl`**: portrait-letter report with a title header, page-number footer, and a 3-column table bound to an embedded Enter Data dataset. No data source needed; renders in the service with zero config. Best starting point for layout iteration and the fastest thing to test end-to-end.
- **`semantic-model-starter.rdl`**: connects to a Power BI semantic model (PBIDATASET) via DAX, with a single-value `Category` parameter wired through `TREATAS` (plain valid DAX; render-proven against a live model) and a dataset-driven default. Fill the `REPLACE_WITH_*` tokens (dataset GUID, workspace/model names, table/column/measure names).
- **`sql-starter.rdl`**: connects to Azure SQL (SQLAZURE) via T-SQL with a multi-value `Category` parameter. Fill the server/database tokens and adjust the query/fields.
- **`platform-template.json`**: the `.platform` sidecar Fabric Git expects beside an `.rdl` in a `<Name>.PaginatedReport/` folder.

## Scripts (scripts/)

- **`validate_rdl.py`**: stdlib-only structural validator (cross-platform). Checks XML well-formedness, the 2016 root namespace, a valid `rd:ReportID` GUID, top-level element order, `Name` uniqueness, tablix column/row/cell-span invariants, dataset-to-datasource and tablix-to-dataset references, embedded-image references, and dimension unit suffixes. It does not check expressions or live field references; those surface at render time. Run after every structural edit.
- **`publish_rdl.sh`** / **`publish_rdl.ps1`**: upload an `.rdl` via the Power BI Imports API (a multipart post `fab api` cannot do) and poll the import to completion. When the conflict mode is omitted they auto-detect `Abort` (new report) vs `Overwrite` (existing), and surface the API error body on failure. Token comes from `$PBI_TOKEN` or is minted inline via `az`; never written to disk. Usage: `publish_rdl.sh <file.rdl> <workspaceId> [Overwrite|Abort] [displayName]`.
- **`export_rdl.sh`** / **`export_rdl.ps1`**: the render-to-verify step. Trigger an export-to-file (PDF/XLSX/etc.), poll, and download the result. Same token handling. Usage: `export_rdl.sh <reportId> <workspaceId> [format] [outfile]`; set `PBI_PARAMS` to a JSON array to pass report parameters. (Status endpoint is `GET exports/{id}`, not `.../status`.) The `.ps1` variants are for Windows; `validate_rdl.py` is Python and runs everywhere.

## Connecting to data

A paginated report embeds its own data sources and datasets (the service does not support shared `.rds`/`.rsd`). Each `<DataSource>` sets a `DataProvider`; each `<DataSet>` is a query plus the fields it returns.

| Source | DataProvider | Query | Notes |
|---|---|---|---|
| Power BI semantic model | `PBIDATASET` | DAX (`EVALUATE`) | column field = `Table[Col]`, measure = `[Measure]`; columns return native types, measures return `System.String` (cast with `CDbl()` for math) |
| SQL Server / Azure SQL | `SQL` / `SQLAZURE` | T-SQL or stored proc | gateway needed for on-prem; set Azure SQL auth after upload |
| Analysis Services | `OLEDB-MD` | MDX | escaped-XML field refs; prefer a tabular DAX path |
| Inline test data | `ENTERDATA` | embedded `<XmlData>` | no source; all fields `System.String`; cast for math |
| Snowflake/Databricks/etc | via Power Query Online | "Get Data" | runs as a compute layer |

Parameters wire across three places that must agree: the `<ReportParameter>`, the dataset `<QueryParameter Name="@x">` whose `<Value>` is `=Parameters!x.Value`, and the query's `@x` reference. Give every parameter a default so the report opens without forcing a selection; back dropdowns with a values dataset; keep cascades shallow. Author the DAX with the **`semantic-models:dax`** skill (or `reports:pbir-cli`'s `model -q`) against the live model so it is verified before it goes in `<CommandText>` — do not hand-roll it. For a semantic model, a single-value parameter via `TREATAS` is the robust, render-proven pattern (it is what the starter uses); multi-select needs `RSCustomDaxFilter`, which is a fragile Report-Builder-generated construct (see the caveat in `references/data-sources.md`). Full connect-string anatomy (including the non-negotiable `sobe_wowvirtualserver-<guid>` and `Integrated Security=ClaimsToken` for PBIDATASET) and the Enter Data block are in `references/data-sources.md`.

## Rendering quirks to anticipate

- **Preview never equals PDF.** Report Builder and the service browser always preview through the HTML (soft page-break) renderer. Page counts, margins, and header height differ from a PDF/Image export. Verify the actual delivery format by exporting to it, not by trusting preview.
- **The PDF width trap.** Body `<Width>` + left + right margins must be `<= PageWidth`, or hard renderers emit blank pages to the right. Landscape Letter with 0.5in margins gives 10in usable width.
- **Two execution environments.** In the service a report runs "standard" or "optimized" automatically; the assignment depends on whether every RDL expression is in the optimized subset. The cost of falling to standard lands at startup (container reuse), not the per-row loop, so regaining the optimized path is not a general speed fix; profile before chasing it. VB date/string transforms inline in the RDL (e.g. `Weekday(...)`) force standard; move such computation into the query/model. **View > Diagnostics** names the exact non-optimized expressions.
- **Scope-bound expressions.** `Globals!PageNumber`/`TotalPages` work only in page headers/footers. RDL dataset/tablix filters apply after the full fetch, so they do not reduce data pulled; filter in the query.

Full renderer taxonomy, the standard-vs-optimized detail, pagination control (page breaks, `KeepTogether`, `KeepWithGroup`, `RepeatOnNewPage`), and expression scope rules are in `references/renderers.md`.

## Structuring a report

Lock the physical page frame (size, orientation, margins, usable width) before placing anything; every column width and font size is constrained by it. Build from a small set of regions: page header (title, logo, run date, parameter echo), body (the data region), page footer (page numbers, confidentiality). Choose the data region by data shape: table for fixed columns, matrix for data-driven columns, list for repeating free-form blocks, all of which are the same `<Tablix>`. Make pagination deliberate: group by the natural document unit, break between groups, and repeat headers across pages. Design guidance specific to paginated reports (including working from a mockup) is in `references/report-structure.md`.

## Reference files

- **`references/questionnaire.md`**: the intake interview to run before building (source, audience, purpose, parameters, distribution, design, workspace/capacity, Report Builder access) plus sensible defaults.
- **`references/differences-with-ssrs.md`**: how Power BI paginated reports differ from classic SSRS (same RDL, different environment); what to convert in SSRS-era samples.
- **`references/rdl-format.md`**: the standalone RDL XML format reference: namespaces, top-level order, data sources, datasets, ReportSections/page/header/footer, the full Tablix structure (flat and grouped), textboxes, images, charts, parameters, and the unwritten rules and common breakage. Read this before hand-editing RDL.
- **`references/data-sources.md`**: connecting to semantic models, SQL, Analysis Services, and other sources; connect strings, query languages, field naming, parameter binding, and the Enter Data connector.
- **`references/renderers.md`**: rendering extensions, standard vs optimized execution environments, pagination control, and expression scope quirks.
- **`references/report-structure.md`**: designing a good paginated report: page frame, region skeleton, choosing the data region, deliberate pagination, parameter UX, working from a mockup.
- **`references/dev-loop.md`**: the author/validate/test/publish loop, Enter Data iteration, PBIRS local rendering, publishing, and the Fabric Git on-disk layout.
- **`references/example-reports.md`**: curated real-world `.rdl` files on GitHub (Microsoft samples, a PBIDATASET example, parameters/matrix/sparkline examples) to copy verbose constructs from rather than hand-typing.

## Related skills

- **`semantic-models:dax`**: author and validate every DAX query a `PBIDATASET` dataset will run, against the live model, before pasting the `EVALUATE` into `<CommandText>`. Do not hand-roll DAX for a paginated report.
- **`fabric-cli`**: `references/paginated-reports.md` there documents the full Power BI REST surface for paginated reports (datasource management, gateway binding, RLS, admin, and the export-to-file options). Use it for everything past publish that the bundled scripts do not cover.
- **`reports:pbir-cli`**: an alternative way to discover model fields and run DAX (`model -q`) when authoring queries.
- **`reports:create-pbi-report`**: when the user actually wants an interactive report, not a paginated one.
