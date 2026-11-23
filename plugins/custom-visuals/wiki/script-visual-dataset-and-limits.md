---
title: Script visual dataset, row cap and limits
summary: How Power BI builds the dataset for R and Python visuals, why rows collapse, and the caps for rows, bytes, time and output.
kind: reference
status: current
sources:
  - url: https://learn.microsoft.com/en-us/power-bi/connect-data/desktop-python-visuals
  - url: https://learn.microsoft.com/en-us/power-bi/visuals/service-r-visuals
  - url: https://learn.microsoft.com/en-us/power-bi/create-reports/desktop-r-visuals
last_updated: 2026-11-23
last_verified: 2026-11-23
review_cadence_days: 60
verified_by:
  - pbir visuals bind --help
skills: [custom-visuals/python-visuals, custom-visuals/r-visuals]
---

# Script visual dataset, row cap and limits

Both languages share one mechanic (Learn, Python tutorial, Tips): the `dataset` data frame is built from the fields in the Values well, grouped like a table visual with the default "Don't summarize". Identical rows across all bound columns appear once.

## Getting one row per record

Bind a column that is unique per record (a transaction key, or an index column added in Power Query). A measure does not do this. Check the result inside the script with `len(dataset)` (Python) or `nrow(dataset)` (R).

```bash
pbir add visual pythonVisual "Report.Report/Page.Page" --name Strip -d "Values:Sales.Region" -d "Values:Sales.Amount" -d "Values:Sales.TransactionKey"
```

Consequence: the 150,000 row cap applies after grouping. Adding a unique key makes the cap bite sooner, so filter the visual or page first.

## Caps

```yaml
rows: 150000 after grouping; extra rows are dropped and a message shows on the image
input_bytes: 250 MB
string_value: truncated beyond 32766 characters
resolution: 72 DPI, only the default plotting device renders
timeout_python: 5 minutes in Desktop, 1 minute in the service
timeout_r: 60 seconds in the service
r_output_desktop: 2 MB
service_payload: 30 MB (compressed input data plus script; this is not an output limit)
column_renaming: not supported, scripts see the original column names
row_order: arbitrary, sort inside the script
```

Desktop figures (5 minute timeout, R 2 MB output) are from the Learn Desktop pages; service figures (1 minute Python timeout, 30 MB payload) are from the [Python package page](https://learn.microsoft.com/en-us/power-bi/connect-data/service-python-packages-support), all re-read 2026-11-23. The R package page states the same 30 MB payload.

## Not supported

- Cross-filtering from the visual and tooltips (the image is static); the visual does respond to filters and highlighting
- Publish to web; app-owns-data embedding (support ended May 2026 per Learn)
- Fields from unrelated tables (Desktop raises an error, like any visual)
- Viewers outside Premium or Fabric capacity unless the author has Pro or PPU; the service needs a Fabric-enabled region
