---
title: Report extension measures and visual calculations with pbir
summary: When a measure belongs in the report, the flags that make pbir dax measures add succeed, and what breaks a report in Desktop.
kind: recipe
status: current
sources:
  - url: https://learn.microsoft.com/en-us/power-bi/transform-model/desktop-measures
  - url: https://learn.microsoft.com/en-us/power-bi/transform-model/desktop-visual-calculations-overview
tools:
  pbir: 0.9.33
last_updated: 2026-11-23
last_verified: 2026-11-23
review_cadence_days: 90
verified_by:
  - pbir dax measures add --help
  - pbir dax viscalcs add --help
skills: [reports/pbir-cli, reports/create-pbi-report]
---

# Report extension measures and visual calculations

Extension measures live in the thin report (`reportExtensions.json`) and run in report context. Visual calculations live on one visual ([Learn](https://learn.microsoft.com/en-us/power-bi/transform-model/desktop-visual-calculations-overview)). Function lists are on Learn and [dax.guide](https://dax.guide); this page only covers the pbir surface.

## Put it in the report only for report-specific work

- Formatting logic: colour, icon or title text for conditional formatting
- Showing a value only for the latest period, or only when one category is selected
- A calculation unique to one report's story

Business logic reusable across reports (revenue, margin, growth) belongs in the semantic model. Extension measures are invisible to other reports.

## Add one

```bash
pbir dax measures add "R.Report" -t Sales -n "Status Color" -d Text \
  -e 'IF([Revenue] >= [Target], "good", "bad")'
```

- `-d/--data-type` is required: Text for colours, icons, dynamic titles and image URLs; Double or Integer for numbers. A wrong type hides the measure from the conditional-formatting picker
- `-t` must name a table that already exists in the model, even for a helper such as `_Fmt`. A measure on a phantom table breaks every visual that references it in Desktop. Check `pbir model "R.Report" -d` first and do not bypass with `--no-validate`
- `--data-category ImageUrl` for SVG or image measures that tables and matrices render as images
- `-F` format string, `--description` optional

## Manage

```bash
pbir dax measures update "R.Report" "Sales.Status Color" --expression-file status.dax --data-type Text
pbir dax measures rename "R.Report" "Sales.Old" "New"
pbir dax measures list "R.Report"
pbir rm "R.Report" --measure "Sales.Status Color" -f
```

- Keep long DAX in a file and pass `--expression-file`; it avoids shell quoting
- Use the qualified `Table.Measure` name in automation; an ambiguous short name reports candidates instead of updating the first match
- `rename` also rewrites other extension measures that reference the measure
- Test an expression with `pbir model "R.Report" -q "EVALUATE ROW(\"x\", [Revenue])"` before saving it

## Dynamic titles

Wrap the selection in `SELECTEDVALUE(col, "fallback")`; without the fallback the title disappears under multi-select. Keep the text measure and the colour measure separate. A measure-driven title and a literal title cannot coexist: clear the literal first.

## Visual calculations

```bash
pbir dax viscalcs add --help
pbir dax viscalcs list "R.Report/P.Page/V.Visual"
```

Visual calculations are scoped to one visual and read its bound fields; bind the inputs first.
