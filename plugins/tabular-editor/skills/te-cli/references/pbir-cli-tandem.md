# `te` + `pbir` tandem workflows

`te` owns semantic-model objects; `pbir` owns report objects. The contract between them is the `Table.Field` identity used by report bindings.

Modern `te move` cascades references inside the semantic model and reports how many it changed. It cannot see report bindings, filters, sort definitions, or conditional formatting. After a model rename or move, update the report separately with `pbir fields replace` or `pbir fields replace-table`. Do not run a blanket `te replace` after `te move`; reserve it for reviewed text the cascade did not cover.

Every `te` mutation needs `--save`. Use `te connect <workspace> <model>` in an interactive shell; in separate agent calls, pass `-s` and `-d` each time or use a named `TE_SESSION`.

## Rename or move a field

```bash
te deps "'Actuals'[Actuals MTD]" --downstream -s "Workspace" -d "Model"
pbir fields find "Actuals.Actuals MTD" "Report.Report" --threshold 1.0

te move "'Actuals'[Actuals MTD]" "'Actuals'[Sales MTD]" --save -s "Workspace" -d "Model"
te validate --errors-only -s "Workspace" -d "Model"
te bpa run --fail-on error -s "Workspace" -d "Model"

pbir fields replace "Report.Report" --from "Actuals.Actuals MTD" --to "Actuals.Sales MTD" --dry-run
pbir fields replace "Report.Report" --from "Actuals.Actuals MTD" --to "Actuals.Sales MTD"
pbir validate "Report.Report" --fields
```

For a table rename, use the table-level report operation:

```bash
te move OldSales Sales --save -s "Workspace" -d "Model"
te validate --errors-only -s "Workspace" -d "Model"
pbir fields replace-table "Report.Report" --from OldSales --to Sales --dry-run
pbir fields replace-table "Report.Report" --from OldSales --to Sales
pbir validate "Report.Report" --fields
```

Moving a measure between tables also changes its report identity. Table-qualified DAX references (`Actuals[Margin]`) do NOT cascade on a cross-table move; the save gate rejects the move with `DAX0002` if one exists, so find and rewrite those first:

```bash
te find "Actuals[Margin]" --in expressions -s "Workspace" -d "Model"
te move "'Actuals'[Margin]" "'_Measures'[Margin]" --save -s "Workspace" -d "Model"
pbir fields replace "Report.Report" --from "Actuals.Margin" --to "_Measures.Margin"
```

## Add a model measure, then bind it

Create the expression and metadata together, validate the model, refresh report schema discovery, then bind the measure:

```bash
te add "'_Measures'[Margin %]" -t Measure -i "DIVIDE([Margin], [Revenue])" \
  -q formatString -i "0.0%" \
  -q displayFolder -i "Profitability" \
  -q description -i "Margin as a percentage of revenue" \
  --save -s "Workspace" -d "Model"
te validate --errors-only -s "Workspace" -d "Model"

pbir model "Report.Report" -d -t _Measures
pbir visuals bind "Report.Report/Page.Page/Chart.Visual" \
  --add "Y:_Measures.Margin %" --type Measure
pbir validate "Report.Report" --fields
```

Metadata-only changes such as expression text, format string, description, display folder, and visibility do not change `Table.Field`; no report rewrite is needed. Refresh or reopen Desktop after saving them.

## Remove a field

Remove report references while the field still exists, then delete the model object:

```bash
te deps "'Sales'[Legacy Region]" --downstream -s "Workspace" -d "Model"
pbir fields find "Sales.Legacy Region" "Report.Report" --threshold 1.0
pbir visuals bind "Report.Report/Page.Page/Chart.Visual" \
  --remove "Category:Sales.Legacy Region" --type Column
pbir validate "Report.Report" --fields

te remove "'Sales'[Legacy Region]" --save -s "Workspace" -d "Model"
te validate --errors-only -s "Workspace" -d "Model"
```

## Deploy and publish order

```bash
te validate --errors-only -m ./Model.SemanticModel
te bpa run --fail-on error -m ./Model.SemanticModel
te deploy ./Model.SemanticModel -s "Workspace" -d "Model" --force --non-interactive
pbir report rebind "Report.Report" "Workspace.Workspace/Model.SemanticModel"
pbir validate "Report.Report" --all
pbir publish "Report.Report" "Workspace.Workspace/Report.Report" -f
```

Deploy the model before rebinding or publishing the report so field validation resolves against the new model schema.
