---
title: Paginated report limits and what the service does not support
summary: Volume ceilings, the optimized environment, unsupported SSRS features and parameter quirks in Power BI paginated reports.
kind: reference
status: current
sources:
  - url: https://learn.microsoft.com/en-us/power-bi/paginated-reports/paginated-reports-faq
  - url: https://learn.microsoft.com/en-us/power-bi/guidance/report-paginated-performance-scalability-considerations
  - url: https://learn.microsoft.com/en-us/power-bi/paginated-reports/paginated-reports-diagnostics
last_updated: 2026-11-23
last_verified: 2026-11-23
review_cadence_days: 60
skills: [paginated-reports/paginated-report]
---

# Paginated report limits and what the service does not support

Both Learn pages were re-read on 2026-11-23.

## Volume

```yaml
standard_environment: processing stops at roughly 1,000,000 rows of 15 to 20 typical columns
optimized_environment: about twice that
nature_of_limit: total data volume, not row count; images (byte[]) cut the row count sharply; the limit is now a failure, not slowness
per_query_hard_abort: a dataset query fetching more than 2,000,000,000 bytes is aborted and rendering fails
excel_exports: large ungrouped data dumps are heavy in Excel; CSV is lighter
```

## Execution environment

- The report runs in the optimized environment only if every RDL expression is in the supported subset; the user cannot choose it. Learn's example of an unsupported expression is `If(Weekday(Fields!SalesDate.Value) > 5, "Relax", "Work")`; move such logic into the dataset query, the model or Power Query
- The Diagnostics button on the report shows "Execution environment" and, when standard, the list of unsupported expressions
- Learn does not say where the cost of the standard environment lands (startup or per row); do not claim either

## Not supported in the service

```yaml
shared_data_sources: .rds files, use named connections instead
shared_datasets: .rsd files; a semantic model can be the source instead
linked_reports: no
custom_fonts: no
custom_assemblies: no; use embedded code or Azure Functions
pin_to_dashboard: not supported (Learn points to the ideas forum)
dataset_caches: none; every parameter query reruns when the report opens or a cascade changes
data_sources_per_report: 250 maximum; above that the report does not publish, and a published one stops rendering
datetime_parameters: always fetched in US format MM/DD/YYYY regardless of design
embedded_dataset_timeout: 600 seconds default, up to 2147483646 in Dataset Properties
```

## Parameters and filters

- Dataset, tablix and group filters declared in the RDL run after the full fetch; they do not reduce the data pulled. Filter in the query
- Parameter queries run sequentially; keep cascades shallow and each parameter query under about 1,000 values (Learn); use ENTERDATA for a static list

## Preview versus PDF

Report Builder and the service browser preview through the HTML renderer with soft page breaks, so page counts, margins and header height differ from a PDF export. Export to the delivery format to check.
