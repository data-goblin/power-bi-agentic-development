# Tabular Editor CLI + `pbir`

Use `te` for semantic-model objects and `pbir` for report objects. A model refactor is complete only when both layers agree on the same `Table.Field` identity.

| Layer | Tool | Owns |
|---|---|---|
| Semantic model | `te` | Tables, columns, measures, relationships, DAX, format strings, descriptions, display folders, validation, BPA, deployment |
| Report | `pbir` | Visual bindings, filters, conditional formatting, sort definitions, pages, bookmarks, themes, validation, Desktop refresh |

Modern `te mv` cascades model-internal references and reports the number changed. It cannot see report bindings, so follow a model rename or move with `pbir fields replace` or `pbir fields replace-table`. Do not run a blanket `te replace` after `te mv`; use it only for deliberately reviewed text that the cascade did not cover.

In one interactive shell, `te connect <workspace> <model>` sets the active model. In separate agent shell calls, pass `-s <workspace> -d <model>` each time or use a named `TE_SESSION`. Every `te` mutation needs `--save` to persist.

## Rename a measure or column

Discover both sides of the blast radius before changing either layer:

```powershell
te connect "Sales Workspace" "Sales Model"
te deps "'Actuals'[Actuals MTD]" --downstream
pbir fields find "Actuals.Actuals MTD" "Sales Flash Report.Report" --threshold 1.0
```

Rename in the model, gate it, preview the report rewrite, then apply:

```powershell
te mv "'Actuals'[Actuals MTD]" "'Actuals'[Sales MTD]" --save
te validate --errors-only
te bpa run --fail-on error

pbir fields replace "Sales Flash Report.Report" --from "Actuals.Actuals MTD" --to "Actuals.Sales MTD" --dry-run
pbir fields replace "Sales Flash Report.Report" --from "Actuals.Actuals MTD" --to "Actuals.Sales MTD"
pbir validate "Sales Flash Report.Report" --fields
pbir desktop refresh "Sales Flash Report.Report"
```

The `pbir` rewrite covers visual projections, selector metadata, filters, conditional formatting, and sort definitions. Re-test bookmarks after field renames because captured data states can require manual recreation through bookmark commands.

## Rename a table

Use the table-level report rewrite; do not loop over fields individually:

```bash
te deps OldSales --downstream -s "Workspace" -d "Model"
te mv OldSales Sales --save -s "Workspace" -d "Model"
te validate --errors-only -s "Workspace" -d "Model"

pbir fields replace-table "Report.Report" --from OldSales --to Sales --dry-run
pbir fields replace-table "Report.Report" --from OldSales --to Sales
pbir validate "Report.Report" --fields
```

## Move a measure between tables

Moving changes the report-visible identity even when the measure name stays the same:

```bash
te mv "'Actuals'[Margin]" "'_Measures'[Margin]" --save -s "Workspace" -d "Model"
te validate --errors-only -s "Workspace" -d "Model"
pbir fields replace "Report.Report" --from "Actuals.Margin" --to "_Measures.Margin" --dry-run
pbir fields replace "Report.Report" --from "Actuals.Margin" --to "_Measures.Margin"
pbir validate "Report.Report" --fields
```

## Add a model measure and use it in a report

Author complete measure metadata in one model mutation, validate it, refresh the report's model definition, then bind it:

```bash
te add "'_Measures'[Margin %]" -t Measure -i "DIVIDE([Margin], [Revenue])" \
  -q formatString -i "0.0%" \
  -q displayFolder -i "Profitability" \
  -q description -i "Margin as a percentage of revenue" \
  --save -s "Workspace" -d "Model"
te validate --errors-only -s "Workspace" -d "Model"
te bpa run --fail-on error -s "Workspace" -d "Model"

pbir model "Report.Report" -d -t _Measures
pbir visuals bind "Report.Report/Page.Page/Chart.Visual" \
  --add "Y:_Measures.Margin %" --type Measure
pbir validate "Report.Report" --fields
```

For a new thin report, deploy the model first, then create the report against it:

```bash
te deploy ./Model.SemanticModel -s "Workspace" -d "Model" --force --non-interactive
pbir new report "Margin.Report" --connection "Workspace/Model.SemanticModel"
```

## Metadata-only model changes

Changing a measure's expression, format string, description, display folder, or visibility does not change its `Table.Field` identity, so `pbir fields replace` is unnecessary:

```bash
te set "'_Measures'[Revenue]" \
  -q formatString -i '$#,0' \
  -q description -i "Net recognized revenue" \
  --save -s "Workspace" -d "Model"
te validate --errors-only -s "Workspace" -d "Model"
pbir desktop refresh "Report.Report"
```

Refresh or reopen Desktop to pick up model metadata. Run `pbir validate --fields` when the DAX change introduces or removes fields used by report calculations.

## Remove a field safely

Clean report references while the field still exists, then delete it from the model:

```bash
te deps "'Sales'[Legacy Region]" --downstream -s "Workspace" -d "Model"
pbir fields find "Sales.Legacy Region" "Report.Report" --threshold 1.0
pbir visuals bind "Report.Report/Page.Page/Chart.Visual" \
  --remove "Category:Sales.Legacy Region" --type Column --dry-run
pbir visuals bind "Report.Report/Page.Page/Chart.Visual" \
  --remove "Category:Sales.Legacy Region" --type Column
pbir validate "Report.Report" --fields

te rm "'Sales'[Legacy Region]" --save -s "Workspace" -d "Model"
te validate --errors-only -s "Workspace" -d "Model"
```

## Final gate

Use one confidence pass per logical refactor:

```bash
te validate --errors-only -s "Workspace" -d "Model"
te bpa run --fail-on error -s "Workspace" -d "Model"
pbir validate "Report.Report" --all
pbir desktop refresh "Report.Report"
pbir desktop screenshot "Report.Report" --all --output-dir screenshots
```

If Desktop is unavailable, stop after validation unless the user authorizes publishing to a sandbox workspace for rendered verification.
