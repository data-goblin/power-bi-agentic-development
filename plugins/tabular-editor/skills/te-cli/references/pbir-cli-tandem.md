# `te` + `pbir` tandem workflows

`te` (Tabular Editor CLI) owns the semantic model: tables, columns, measures, relationships, DAX expressions, BPA, validation, and deployment to a workspace. `pbir` (pbir CLI) owns the Power BI report layer (.pbir): pages, visuals, field references and bindings, filters, themes, bookmarks, and extension measures. Neither tool crosses the line. `te` has no visibility into report JSON, and `pbir` cannot mutate TMDL or run DAX as a model edit. The contract that joins them is the `Table.Field` string: `te` changes an object's identity in the model, then `pbir` rewrites every report binding that still points at the old `Table.Field`. Run both halves, or ship a broken model or a broken report.

Two rules before every command: model edits in `te` stage in memory and need `--save` to persist; `te replace` and `pbir fields replace` are dry-run-leaning (`te replace` previews unless `--save` is passed; `pbir fields replace` runs for real unless `--dry-run` is passed). When a flag or argument order is unfamiliar, run `te <command> --help` or `pbir <command> --help` first; both CLIs are evolving and the help text is authoritative.

## 1. Rename a measure (model) and repair report bindings

The most common refactor. `te mv` renames the object only; it does not rewrite DAX that calls the old name, so `te replace --in expressions` is a mandatory second step.

```bash
# te: confirm the object and find DAX that calls it by name
te find "OldRevenue" --in names --paths-only -m ./Model.SemanticModel
te find "OldRevenue" --in expressions -m ./Model.SemanticModel   # measures, calc columns, KPIs, role filters, calc-group selection
te deps "_Measures/OldRevenue" --downstream -m ./Model.SemanticModel   # blast radius

# te: rename the object, then fix every DAX reference to the old name
te mv "_Measures/OldRevenue" "_Measures/Revenue" --save -m ./Model.SemanticModel
te replace "OldRevenue" "Revenue" --in expressions --save -m ./Model.SemanticModel

# te: gate before touching the report
te validate -m ./Model.SemanticModel --errors-only

# pbir: find report bindings on the old reference (run --help to confirm arg order)
pbir fields find "Report.Report" -f "_Measures.OldRevenue"

# pbir: preview, then apply the report-side rewrite
pbir fields replace "Report.Report" --from "_Measures.OldRevenue" --to "_Measures.Revenue" --dry-run
pbir fields replace "Report.Report" --from "_Measures.OldRevenue" --to "_Measures.Revenue"

# pbir: confirm every binding resolves against the model
pbir validate "Report.Report" --fields
```

Per-step purpose:

```yaml
te find --in names: confirm the measure exists and get its path before touching anything
te find --in expressions: discover DAX that calls the old name by value; te mv will NOT fix these
te deps --downstream: list measures/columns downstream to show the full impact
te mv: rename the TOM object (the name property only)
te replace --in expressions: rewrite every DAX call of the old name across the model; needs --save
te validate --errors-only: confirm no broken DAX references remain
pbir fields find: locate visuals, filters, and CF entries bound to the old reference
pbir fields replace --dry-run: preview the report rewrite
pbir fields replace: rewrite queryState projections, queryRefs, and nativeQueryRefs in one pass
pbir validate --fields: confirm all bindings resolve; zero broken references expected
```

## 2. Rename a column (model) and repair report bindings

Same shape as a measure rename, plus column-only metadata to check after `te mv`.

```bash
te find "OldColumnName" --in names --paths-only -m ./Model.SemanticModel   # check for same name on other tables
te deps "Date/OldColumnName" --downstream -m ./Model.SemanticModel
te mv "Date/OldColumnName" "Date/NewColumnName" --save -m ./Model.SemanticModel
te replace "OldColumnName" "NewColumnName" --in expressions --save -m ./Model.SemanticModel
te validate -m ./Model.SemanticModel --errors-only

pbir fields find "Report.Report" -f "Date.OldColumnName"
pbir fields replace "Report.Report" --from "Date.OldColumnName" --to "Date.NewColumnName" --dry-run
pbir fields replace "Report.Report" --from "Date.OldColumnName" --to "Date.NewColumnName"
pbir validate "Report.Report" --fields
```

After the rename, verify two column relationships that store the old name as a property, not as a reference `te replace` would catch:

```bash
te get Date/SomeOtherColumn -q sortByColumn -m ./Model.SemanticModel   # update with te set if it broke
te ls "Date/Geography/Levels" -m ./Model.SemanticModel                  # hierarchy levels take a column property
```

## 3. Rename a table (model) and repair all report bindings

`pbir fields replace` works per `Table.Field`, not per table. There is no bulk table-prefix rewrite. Enumerate the affected fields first, then loop. Run the model-internal DAX rewrite before the rename so expressions are consistent at save time.

```bash
te find "FACT_Sales" --in names -m ./Model.SemanticModel
te find "FACT_Sales" --in expressions -m ./Model.SemanticModel
te replace "FACT_Sales" "Sales" --in expressions --save -m ./Model.SemanticModel
te mv FACT_Sales Sales --save -m ./Model.SemanticModel
te validate -m ./Model.SemanticModel --errors-only

# pbir: list fields, then replace each FACT_Sales.* binding individually
pbir fields list "Report.Report" --json
pbir fields replace "Report.Report" --from "FACT_Sales.Amount" --to "Sales.Amount" --dry-run
pbir fields replace "Report.Report" --from "FACT_Sales.Amount" --to "Sales.Amount"
# repeat the replace for every distinct FACT_Sales.<field> in the report
pbir validate "Report.Report" --fields
```

```yaml
te replace --in expressions: rewrites DAX text only; apostrophe-quoted refs need the quotes in the find term, e.g. te replace "'FACT_Sales'" "'Sales'" --in expressions --save
te replace substring risk: if the old name is a substring of another identifier, add --case-sensitive or --regex with anchors and review the preview
relationship endpoints: te mv renames the table object; confirm relationship integrity with te validate
```

## 4. Move a measure to a different table and update bindings

`te mv` across tables is the only way to change an object's table ownership. Only fully table-qualified DAX (`SourceTable[Measure]`) breaks; unqualified `[Measure]` keeps resolving model-wide.

```bash
te deps "SourceTable/MeasureName" --downstream -m ./Model.SemanticModel
te mv "SourceTable/MeasureName" "TargetTable/MeasureName" --save -m ./Model.SemanticModel
te find "SourceTable" --in expressions --paths-only -m ./Model.SemanticModel   # decide if te replace is needed
te validate -m ./Model.SemanticModel --errors-only

pbir fields find "Report.Report" -f "SourceTable.MeasureName"
pbir fields replace "Report.Report" --from "SourceTable.MeasureName" --to "TargetTable.MeasureName"
pbir validate "Report.Report" --fields
```

Display folder does not move with `te mv`; reset it on the moved measure if it should match the new table's folder structure (`te set "TargetTable/MeasureName" -q displayFolder -i "<folder>" --save`).

## 5. Scaffold a model, then create a thin report against it

`te` builds the TMDL model and deploys it; `pbir` creates a thin report bound to the published model `byConnection`. Deploy is a hard prerequisite for the `-c` workspace binding to resolve.

```bash
# te: scaffold and author
te init ./Model.SemanticModel --serialization tmdl   # PowerBI mode, compat 1702 default
te add Sales -t Table --columns "OrderID:Int64,Amount:Decimal,OrderDate:DateTime" --save -m ./Model.SemanticModel
te add "_Measures/Revenue" -t Measure -i "SUM(Sales[Amount])" --save -m ./Model.SemanticModel
te set "_Measures/Revenue" -q formatString -i "#,0.00" --save -m ./Model.SemanticModel
te set "_Measures/Revenue" -q displayFolder -i "Revenue" --save -m ./Model.SemanticModel

# te: gate and deploy
te validate -m ./Model.SemanticModel --errors-only
te bpa run --fail-on error -m ./Model.SemanticModel
te deploy ./Model.SemanticModel -s "MyWorkspace" -d "Sales Model" --force --non-interactive

# pbir: create thin report bound to the published model, build, validate
pbir new report "Sales.Report" -c "MyWorkspace/Sales Model.SemanticModel"
pbir pages rename "Sales.Report/Page 1.Page" "Overview"
pbir model "Sales.Report" -d                          # introspect tables/measures before binding
pbir add visual card "Sales.Report/Overview.Page" --title "Revenue" -d "Values:_Measures.Revenue" -t Measure --y 120
pbir validate "Sales.Report" --fields
```

```yaml
te deploy --force --non-interactive: deploy prompts with n as the default and hangs scripts without --force; set both in CI
pbir new report -c: a workspace target produces a byConnection (thin) report; the model must be reachable in the workspace first
pbir add visual -t Measure: pass the type or -d defaults to a Column binding, which fails at runtime even though validate passes the JSON
pbir model -d: schema comes via TMDL, not DMV; -q runs EVALUATE DAX only
te validate scope: does not exercise M partitions; broken M surfaces only on refresh
```

To bind to a local model on disk instead of a workspace, create the report and then rebind with the documented local form:

```bash
pbir report rebind "Sales.Report" --local "../Sales.SemanticModel"
```

## 6. Add a measure to a live model, then surface it in a bound report

```bash
te ls Measures -m ./Model.SemanticModel               # check naming conventions, avoid duplicates
te add "_Measures/Revenue YoY" -t Measure -i "DIVIDE([Revenue], CALCULATE([Revenue], SAMEPERIODLASTYEAR('Date'[Date]))) - 1" --save -m ./Model.SemanticModel
te set "_Measures/Revenue YoY" -q formatString -i "0.0%" --save -m ./Model.SemanticModel
te set "_Measures/Revenue YoY" -q displayFolder -i "Revenue" --save -m ./Model.SemanticModel
te set "_Measures/Revenue YoY" -q description -i "Year-over-year revenue growth" --save -m ./Model.SemanticModel
te validate -m ./Model.SemanticModel --errors-only
te deploy ./Model.SemanticModel -s "MyWorkspace" -d "Sales Model" --force --non-interactive

pbir model "Sales.Report" --cache                     # refresh the report's cached model definition
pbir model "Sales.Report" -d -t _Measures | grep -i "YoY"
pbir add visual card "Sales.Report/Overview.Page" --title "Revenue YoY" -d "Values:_Measures.Revenue YoY" -t Measure --y 120
pbir validate "Sales.Report" --fields
```

The Date table must be marked (`te set Date -q dataCategory -i Time --save`) for `SAMEPERIODLASTYEAR` to evaluate; `te validate` catches a missing mark.

## 7. Remove a column: clear report references first, then delete

Report-first, model-second. Clear the report bindings while the column still exists so validation can still resolve the type, then delete in the model. Reversing the order breaks the report on deploy.

```bash
te deps Sales/OldRegionCode --downstream -m ./Model.SemanticModel   # model-side dependents

# pbir: find and remove the report references first
pbir fields find "Report.Report" -f "Sales.OldRegionCode"
pbir validate "Report.Report"
# surgical removal per visual is safer than a broad clear:
pbir visuals bind "Report.Report/Page.Page/Visual.Visual" -r "Category:Sales.OldRegionCode"

# te: delete only after the report is clean
te rm Sales/OldRegionCode --dry-run -m ./Model.SemanticModel
te rm Sales/OldRegionCode --if-exists --save -m ./Model.SemanticModel
te validate -m ./Model.SemanticModel --errors-only
te deploy ./Model.SemanticModel -s "MyWorkspace" -d "Sales Model" --force --non-interactive
```

```yaml
removal granularity: pbir visuals bind -r removes one role binding on one visual; prefer it over a report- or page-wide pbir fields clear, which strips bindings broadly and can leave visuals with empty roles
sort-by dependency: te rm fails if the column is another column's sortByColumn target; clear that first with te set OtherColumn -q sortByColumn -i "" --save
```

## 8. Split a thick PBIP, edit the model, keep the report in sync

`pbir` owns the structural split and the `definition.pbir` connection record; once the model is in the workspace, `te` edits it directly over the workspace endpoint.

```bash
pbir model "ThickReport.Report"                       # confirm byPath (thick)
pbir report split-from-thick ThickProject --target "MyWorkspace.Workspace/Sales Model.SemanticModel" -F pbir
pbir model "ThickReport.Report"                       # confirm byConnection (thin)

te load -s "MyWorkspace" -d "Sales Model"             # confirm te reaches the published model
te set "_Measures/Revenue" -q description -i "Total net revenue" -s "MyWorkspace" -d "Sales Model" --save
te bpa run --fail-on error -s "MyWorkspace" -d "Sales Model"

pbir validate "ThickReport.Report" --fields
```

After `split-from-thick` there is no local TMDL to pass to `-m`; use `-s`/`-d` for all later `te` commands. The split's publish step needs the Fabric CLI (`fab`) authenticated, separate from `te auth`.

## 9. Deploy and publish together

```bash
te validate -m ./Model.SemanticModel --errors-only && te bpa run --fail-on error -m ./Model.SemanticModel
te deploy ./Model.SemanticModel -s "MyWorkspace" -d "Sales" --force --non-interactive
pbir report rebind "Sales.Report" "MyWorkspace/Sales.SemanticModel"   # byPath -> byConnection
pbir validate "Sales.Report" --fields                                 # validate against the remote model
pbir publish "Sales.Report" "MyWorkspace/Sales" -f                    # positional args, not --workspace
```

`pbir report rebind` must come after `te deploy` completes, or validation at publish time fails. `pbir publish` takes positional source and destination, never `--workspace`.

## Boundaries and gotchas

```yaml
te owns:
  - object identity (te mv / te set -q name) and DAX expression repair (te replace --in expressions)
  - dependency analysis (te deps), validation (te validate), BPA (te bpa run), deploy (te deploy)
  - te mv renames the object only; it does NOT rewrite DAX that calls the old name
  - te replace previews by default; pass --save to persist; it is literal text find-replace (use --regex / --case-sensitive for substring or quoted-name cases)
  - te find --in expressions covers measure DAX, calc columns, KPI expressions, partition M, role filters, and calc-group selection; it does NOT see report JSON

pbir owns:
  - report-layer references: visual queryState projections, filters, CF, slicer bindings
  - pbir fields replace works per Table.Field; there is no table-level bulk rewrite, so a table rename is one replace per affected field (enumerate with pbir fields list first)
  - pbir validate --fields resolves against the connected model; if the report is byPath it validates against the local TMDL, if byConnection against the workspace model (confirm with pbir model first)
  - pbir add visual / visuals bind: pass -t Measure or the binding defaults to Column and fails at runtime

Not covered by pbir fields replace (handle separately):
  - extension measures in reportExtensions.json: inspect with pbir dax measures list / json; rename the object with pbir dax measures rename, but the DAX body must be re-authored manually
  - visual calculations: locate with pbir dax viscalcs json and update the DAX separately
  - bookmark data states: pbir validate --fields surfaces broken refs but does not repair captured slicer/filter state; re-test bookmarks after a rename

Argument-order caveat:
  - the pbir skill documents two forms for pbir fields find (report-first with -f, and search-term-first); run pbir fields find --help to confirm the build in use before scripting it
```
