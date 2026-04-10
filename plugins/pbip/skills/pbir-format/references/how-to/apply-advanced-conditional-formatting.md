# Apply Conditional Formatting

Create and maintain conditional formatting with `pbir visuals cf`, `pbir get`, and `pbir set`.
Do not hand-edit `visual.json` or `reportExtensions.json`.

## Choose the simplest useful form

- **Measure-driven:** business meaning already exists in a color/status measure
- **Gradient:** magnitude should be read continuously
- **Rules:** a few explicit thresholds matter
- **Icons:** status or direction needs a compact symbol
- **Data bars:** relative magnitude belongs inside a table or matrix

Use restrained semantic colors. `good`, `neutral`, and `bad` should keep the same meaning across
the report.

## Inspect first

```bash
pbir get "Report.Report/Page.Page/Visual.Visual.**.cf"
pbir visuals bind "Report.Report/Page.Page/Visual.Visual" --show
pbir schema describe barChart dataPoint
```

## Measure-driven color

Use an existing model measure when possible. If the report genuinely needs a thin-report measure,
create it through the CLI:

```bash
pbir dax measures add "Report.Report" \
  -t _Formatting -n StatusColor \
  -e 'SWITCH(TRUE(), [Variance] < 0, "#B3261E", [Variance] > 0, "#2E7D32", "#6B7280")' \
  -d String

pbir visuals cf "Report.Report/Page.Page/Visual.Visual" \
  --measure "labels.color _Formatting.StatusColor"
```

Create or change semantic-model measures with `te`, then use `pbir` to bind the report formatting.

## Gradient

```bash
pbir visuals cf "Report.Report/Page.Page/Visual.Visual" \
  --gradient --field "Sales.Revenue" \
  --min-color bad --mid-color neutral --max-color good
```

Add `--mid-value` only when the midpoint has an explicit business meaning.

## Rules

```bash
pbir visuals cf "Report.Report/Page.Page/Visual.Visual" \
  --rules --field "Sales.Variance" \
  --rule "lt 0 bad" --rule "gte 0 good" \
  --on "dataPoint.fill"
```

## Icons and data bars

```bash
pbir visuals cf "Report.Report/Page.Page/Table.Visual" \
  --icons --field "Sales.Variance" \
  --rule "lt 0 bad" --rule "gte 0 good"

pbir visuals cf "Report.Report/Page.Page/Table.Visual" \
  --data-bars --field "Sales.Revenue" \
  --positive-color "#2F6B8A" --negative-color "#B3261E"
```

## Read, adjust, or remove

```bash
pbir get "Report.Report/Page.Page/Visual.Visual.dataPoint.fill.cf"
pbir set "Report.Report/Page.Page/Visual.Visual.dataPoint.fill.cf.gradient.min.color" \
  --value bad
pbir set "Report.Report/Page.Page/Visual.Visual.dataPoint.fill.cf" --remove
```

Use `pbir visuals cf --copy-from`, `--to-measure`, or `--theme-colors` for supported structural
conversions instead of rebuilding expressions by hand.

## Verify

```bash
pbir validate "Report.Report" --all
pbir desktop refresh "Report.Report"
```

If the target container/property is not supported, inspect it with `pbir schema describe` and
report a CLI capability gap. Never fall back to raw JSON mutation.
