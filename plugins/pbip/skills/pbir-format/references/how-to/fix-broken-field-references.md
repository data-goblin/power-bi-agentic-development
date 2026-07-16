# Fix Broken Field References

Use this workflow after a table, column, measure, or hierarchy changes in the semantic model.
All report mutations go through `pbir`; never text-replace or hand-edit report JSON.

## 1. Find the damage

```bash
pbir backup "Report.Report" -m "Before field repair"
pbir fields list "Report.Report"
pbir fields find "OldTable.OldField" "Report.Report" --threshold 1.0
pbir validate "Report.Report" --fields
```

Use `pbir model "Report.Report" -d` to inspect the connected model. For a local or live
semantic model, use `te ls`, `te find`, and `te get` when you need richer model detail.

Classify each missing reference:

| Change | Report repair |
|---|---|
| Table renamed | `pbir fields replace-table` |
| Field renamed | `pbir fields replace` |
| Measure moved | `pbir fields replace` with the new table |
| Field removed | Bind a valid substitute or remove the binding |

## 2. Preview, then apply

For a table rename:

```bash
pbir fields replace-table "Report.Report" \
  --from "OldTable" --to "NewTable" --dry-run
pbir fields replace-table "Report.Report" \
  --from "OldTable" --to "NewTable"
```

For a field rename or move:

```bash
pbir fields replace "Report.Report" \
  --from "OldTable.OldField" --to "NewTable.NewField" --dry-run
pbir fields replace "Report.Report" \
  --from "OldTable.OldField" --to "NewTable.NewField"
```

The resolver updates the report surfaces that carry field identity, including visual query
projections, `queryRef`/`nativeQueryRef`, sort definitions, selectors, conditional formatting,
and report/page/visual filters. Keep validation enabled when the model is reachable.

If the model rename is happening now, rename it first with `te mv ... --save`, then repair the
report with `pbir fields replace` or `replace-table`. `te mv` cascades references inside the
semantic model; it does not rewrite report bindings.

## 3. Handle a removed field

Prefer a valid substitute:

```bash
pbir visuals bind "Report.Report/Page.Page/Visual.Visual" --show
pbir visuals bind "Report.Report/Page.Page/Visual.Visual" \
  --remove "Y:OldTable.OldField" \
  --add "Y:NewTable.NewField" --type Measure --dry-run
pbir visuals bind "Report.Report/Page.Page/Visual.Visual" \
  --remove "Y:OldTable.OldField" \
  --add "Y:NewTable.NewField" --type Measure
```

If there is no substitute, remove the field with `pbir visuals bind --remove` or clear the role
with `--clear`. Use `pbir filters list`, `pbir filters clear`, or `pbir rm` for broken filters.
If the required mutation is not supported by `pbir`, report the capability gap instead of
editing `queryState`, selectors, filters, or any other JSON directly.

If a model measure should exist, recreate it through `te` and save/deploy the semantic model.
Do not patch TMDL or report JSON as a shortcut.

## 4. Validate the result

```bash
pbir fields find "OldTable.OldField" "Report.Report" --threshold 1.0
pbir validate "Report.Report" --all
pbir desktop refresh "Report.Report"
```

For tandem model/report changes, also run the relevant `te validate` and BPA checks before
deployment. Desktop reload does not apply theme edits; close and reopen the report to verify a
theme change.

## Watch-outs

- Filter field references and filter literal values are different. A field rename does not imply
  that slicer data values changed.
- Combo charts use `Y` for columns and `Y2` for lines.
- A schema-valid visual can still render blank if its model field no longer exists. Always include
  `--fields` or `--all` in the final validation.
