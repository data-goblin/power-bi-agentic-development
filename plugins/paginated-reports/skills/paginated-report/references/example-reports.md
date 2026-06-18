# Real-World Example Reports

Authentic, Report-Builder-authored Power BI paginated report `.rdl` files on GitHub. Use these to learn the exact XML a real report produces and to copy verbose constructs (charts, matrices, sparklines, drill-down groups, parameter wiring) rather than hand-typing them. The bundled `assets/*.rdl` starters are deliberately minimal; these are fuller, real reports.

These are linked, not redistributed here. Fetch a raw file with WebFetch (`raw.githubusercontent.com`; encode spaces in the path as `%20`), read the relevant fragment, adapt it, regenerate `rd:ReportID`, and re-run `scripts/validate_rdl.py`. All of the files below are the 2016 RDL schema and pass that validator. Some older samples elsewhere use shared data sources or pre-2016 schemas; convert those before publishing to the service (see `references/differences-with-ssrs.md`).

## Microsoft training (Power BI)

From official Microsoft Learning courses (MIT-licensed repos):

- **PL-300, Power BI Data Analyst** — `Daily Sales Orders.rdl`: a paginated report with a parameter and a tablix. Compact, clean, real Report Builder output; a good first authentic example.
  - View: `https://github.com/MicrosoftLearning/PL-300-Microsoft-Power-BI-Data-Analyst/blob/Main/Allfiles/Demos/Solutions/Demo-09/Daily%20Sales%20Orders.rdl`
  - Raw: `https://raw.githubusercontent.com/MicrosoftLearning/PL-300-Microsoft-Power-BI-Data-Analyst/Main/Allfiles/Demos/Solutions/Demo-09/Daily%20Sales%20Orders.rdl`
- **DP-500, Azure Data Analyst** — `Sales Order Report.rdl`: a larger paginated report with an embedded image and a parameter.
  - View: `https://github.com/MicrosoftLearning/DP-500-Azure-Data-Analyst/blob/main/Allfiles/15/Solution/Sales%20Order%20Report.rdl`

## Microsoft official paginated report samples

`microsoft/Reporting-Services` (MIT, branch `master`, folder `PaginatedReportSamples/`) is Microsoft's own paginated report sample set. Richer constructs than the training reports:

- `Invoice.rdl` — single-document invoice: header block, line-item table, totals (the model for statement/invoice reports).
- `RegionalSales.rdl` — table with an embedded chart per group (sparkline pattern).
- `CountrySalesPerformance.rdl` — KPI-style layout with charts and indicators.
- `OrganizationExpenditures.rdl` — matrix with column groups and subtotals.
- `Transcript.rdl` — list-style repeating layout; `Labels.rdl` — multi-column label sheet; `Letter.rdl` — form-letter / mail-merge list.
- Folder: `https://github.com/microsoft/Reporting-Services/tree/master/PaginatedReportSamples`
- Raw pattern: `https://raw.githubusercontent.com/microsoft/Reporting-Services/master/PaginatedReportSamples/Invoice.rdl`

## Semantic model (PBIDATASET) example

`PowerBiDevCamp/App-Owns-Data-Starter-Kit` — `SalesSummaryPaginated.rdl` connects to a Power BI semantic model with a DAX query. The clearest reference for the `PBIDATASET` connect string and DAX `DataField` naming (note it ships a placeholder dataset GUID and a reused `rd:ReportID` for templating; replace both).
- `https://github.com/PowerBiDevCamp/App-Owns-Data-Starter-Kit/blob/main/AppOwnsDataAdmin/wwwroot/PBIX/SalesSummaryPaginated.rdl`

## Parameters, matrix, and sparklines

`guyinacube/demo-files` (branch `master`, folder `video demos/RDL/`) has paginated report demos:

- `20181205 - 1 - Datasource Dataset Params.rdl` — wiring a data source, dataset, and parameters together (the fiddliest part to hand-author).
- `20181212 - 2 - Matrix.rdl` — a matrix (column-group) tablix.
- `20190109 - Final.rdl` — Azure SQL stored procedure, cascading parameters, sparklines, embedded images.
- Folder: `https://github.com/guyinacube/demo-files/tree/master/video%20demos/RDL`

## How to use an example

1. Identify the construct needed (a chart, a matrix, a parameter cascade, a list layout).
2. Pick the example above that shows it; WebFetch its raw URL and read just that fragment.
3. Copy the fragment in, adapt names/fields, keep element order intact, regenerate `rd:ReportID`, ensure `Name` attributes are unique.
4. Run `scripts/validate_rdl.py`, then publish and render to confirm (`scripts/publish_rdl.sh` then `scripts/export_rdl.sh`).

These repositories are third-party; consult each for its own license before reusing its content.
