# Thin Report Extension Measures

Extension measures are DAX expressions stored in a thin report's `reportExtensions.json`. They execute in the report context, not the semantic model, making them useful for report-specific formatting logic and conditional rendering.

## When to Use Extension Measures

Extension measures belong in the report (not the semantic model) when they serve **report-specific formatting or rendering purposes**:

- **Conditional formatting** -- returning theme color tokens (`"good"`, `"bad"`, `"neutral"`) for measure-based CF
- **Labelling latest data point** -- returning a value only for the most recent period and `BLANK()` otherwise, so a line chart shows one label
- **Conditionally rendering values** -- showing/hiding values based on context (e.g., only show percentage when a single category is selected)
- **Report-specific calculations** -- metrics that combine model measures in ways unique to this report's storytelling

**Promote to the semantic model** when the measure represents general business logic reusable across reports (revenue, margin, YoY growth, etc.). Extension measures have governance issues -- they're invisible to other reports and harder to discover.

## Listing and Inspecting

```bash
pbir dax measures list "Report.Report"           # Table of all extension measures
pbir dax measures json "Report.Report"            # Full DAX expressions as JSON
pbir cat "Report.Report/reportExtensions"         # Raw reportExtensions.json
```

## Creating Extension Measures

```bash
# Basic measure
pbir dax measures add "Report.Report" -t _Fmt -n "StatusColor" \
  -e 'IF([Revenue] >= [Target], "good", IF([Revenue] >= [Target] * 0.8, "neutral", "bad"))' \
  --data-type Text

# With format string and description
pbir dax measures add "Report.Report" -t Metrics -n "RevenueFormatted" \
  -e '[Revenue]' --data-type Decimal -F "#,0.00" \
  --description "Revenue with 2dp formatting"
```

### Flags

| Flag | Purpose |
|------|---------|
| `-t` / `--table` | Table name for the measure (creates if needed) |
| `-n` / `--name` | Measure name |
| `-e` / `--expression` | DAX expression |
| `-d` / `--data-type` | Data type: `Text`, `Integer`, `Decimal`, `Boolean`, `DateTime` |
| `-F` / `--format` | Format string (e.g., `"#,0"`, `"0.0%"`) |
| `--description` | Measure description |

## Managing Measures

```bash
# Rename
pbir dax measures rename "Report.Report" --from "_Fmt.OldName" --to "NewName"

# Remove all measures
pbir rm "Report.Report" --measures -f

# Remove specific measure (use pbir rm)
pbir rm "Report.Report" --measure "_Fmt.StatusColor" -f
```

## Common Patterns

### Conditional Formatting with Theme Tokens

The preferred CF pattern: create a measure that returns theme color keys, then bind it to a visual property. When the theme changes, all CF updates automatically.

```bash
# Step 1: Create formatting measure returning theme tokens
pbir dax measures add "Report.Report" -t _Fmt -n "RevenueColor" \
  -e 'IF([Revenue] >= [Target], "good", IF([Revenue] >= [Target] * 0.8, "neutral", "bad"))' \
  --data-type Text

# Step 2: Ensure theme has sentiment colors defined
pbir theme set-colors "Report.Report" --good "#00B050" --bad "#FF0000" --neutral "#FFC000"

# Step 3: Apply to visual component
pbir visuals cf "Report.Report/Page.Page/Visual.Visual" \
  --measure "labels.color _Fmt.RevenueColor"

# Apply to data point fills (bar/column colors)
pbir visuals cf "Visual.Visual" --measure "dataPoint.fill _Fmt.RevenueColor"
```

### Label Latest Data Point Only

Show a data label only on the most recent data point in a line chart:

```bash
pbir dax measures add "Report.Report" -t _Fmt -n "RevenueLatestLabel" \
  -e "IF(SELECTEDVALUE('Date'[Date]) = MAX('Date'[Date]), [Revenue], BLANK())" \
  --data-type Decimal -F "#,0"
```

Then bind this measure as a tooltip or secondary Y-axis value, or use it as the label value for the line.

### Conditionally Render Values

Show a percentage only when a single category is selected:

```bash
pbir dax measures add "Report.Report" -t _Fmt -n "ShareIfSingle" \
  -e "IF(HASONEVALUE('Products'[Category]), DIVIDE([Revenue], CALCULATE([Revenue], ALL('Products'[Category]))), BLANK())" \
  --data-type Decimal -F "0.0%"
```

### Traffic Light Icon Formatting

Return icon references based on KPI status:

```bash
pbir dax measures add "Report.Report" -t _Fmt -n "StatusIcon" \
  -e 'SWITCH(TRUE(), [Variance] > 0.05, "good", [Variance] > -0.05, "neutral", "bad")' \
  --data-type Text
```

## DAX Function Verification

**CRITICAL: Never invent or assume DAX function names.** Always verify function availability before using them in extension measures. Functions like `LAMBDA`, `MAXA` (2-arg form), and others may not exist or may have different signatures than expected.

- **Check dax.guide** (https://dax.guide) to confirm a function exists, its signature, and its compatibility
- **Test expressions** with `pbir model -q` before saving them as extension measures
- Common mistakes: `LAMBDA` (not available in all engines), `MAXA` vs `MAX` (MAXA takes 1 column arg, MAX takes 2 scalars), `MID` with non-integer positions
- When computing month names, use `SWITCH()` not `LAMBDA` or `MID` with arithmetic -- `SWITCH(_month, 1,"Jan", 2,"Feb", ..., 12,"Dec")`

## Validation

After adding or modifying extension measures:

```bash
pbir validate "Report.Report"                    # Check report integrity
pbir dax measures list "Report.Report"           # Verify measures exist
pbir dax measures json "Report.Report"           # Inspect full expressions
```

## Naming Conventions

- Use a dedicated table name like `_Fmt` or `_Report` for formatting measures to distinguish them from model measures
- Prefix with purpose: `RevenueColor`, `StatusIcon`, `LatestLabel`
- Keep measure names descriptive -- they appear in the field list alongside model measures
