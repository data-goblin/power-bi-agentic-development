---
title: Renaming or moving model objects without breaking the report
summary: Order of operations for te and pbir so a model rename, move or removal also reaches report bindings.
kind: recipe
status: current
sources:
  - url: https://learn.microsoft.com/en-us/power-bi/developer/projects/projects-report
tools:
  pbir: 0.9.33
  te: 0.8.1.1
last_updated: 2026-11-23
last_verified: 2026-11-23
review_cadence_days: 90
verified_by:
  - pbir fields replace --help
  - pbir fields replace-table --help
  - te mv --help
skills: [reports/pbir-cli]
---

# Renaming or moving model objects without breaking the report

`te mv` cascades references inside the model and reports how many it changed. It cannot see report bindings, so a report keeps the old `Table.Field` until `pbir` rewrites it. Do not follow `te mv` with a blanket text replace; use the pbir commands, which cover visual projections, selectors, filters, conditional formatting and sort definitions.

In separate shell calls `te` does not keep a connection: pass `-s <workspace> -d <model>` each time (or a named `TE_SESSION`), and every mutation needs `--save`.

## Rename a measure or column

```bash
te deps "'Actuals'[Actuals MTD]" --downstream -s "WS" -d "Model"
pbir fields find "Actuals.Actuals MTD" "Report.Report" --threshold 1.0
te mv "'Actuals'[Actuals MTD]" "'Actuals'[Sales MTD]" --save -s "WS" -d "Model"
te validate --errors-only -s "WS" -d "Model"
pbir fields replace "Report.Report" --from "Actuals.Actuals MTD" --to "Actuals.Sales MTD" --dry-run
pbir fields replace "Report.Report" --from "Actuals.Actuals MTD" --to "Actuals.Sales MTD"
pbir validate "Report.Report" --fields
```

Re-test bookmarks afterwards: captured data states can need recreation.

## Rename a table, or move a measure to another table

A table rename uses `pbir fields replace-table "Report.Report" --from OldSales --to Sales` (dry run first). Moving a measure changes its `Table.Field` identity even when the name stays, so use `pbir fields replace` with the old and new qualified names.

## Remove a field

Clean the report while the field still exists, then delete it from the model:

```bash
pbir visuals bind "R.Report/P.Page/V.Visual" --remove "Category:Sales.Legacy Region" --type Column --dry-run
pbir validate "R.Report" --fields
te rm "'Sales'[Legacy Region]" --save -s "WS" -d "Model"
```

## Metadata-only changes

Expression, format string, description, display folder or visibility changes keep the identity, so no `pbir fields` step is needed. Refresh or reopen Desktop to pick up model metadata and run `pbir validate --fields` when a DAX change adds or removes fields the report uses.

## New thin report on a new model

Deploy the model first (`te deploy ... --execute`), then `pbir new report "X.Report" --connection "WS/Model.SemanticModel"`.

## Final gate

`te validate --errors-only`, `te bpa run --fail-on error`, `pbir validate "Report.Report" --all`, then a render check ([render verification](pbir-render-verification.md)).
