# Visual Calculations

Visual calculations are DAX expressions embedded directly in individual visuals. They compute values relative to the visual's axes and context, enabling calculations like running totals, ranks, and moving averages without polluting the semantic model.

## When to Use Visual Calculations

Visual calculations are appropriate when:

- The calculation only makes sense in the context of one specific visual (running sum along an axis, rank within displayed rows)
- Performance benefit from computing at the visual level rather than model level
- Quick prototyping of calculations before promoting to the model

**Promote to the semantic model** when the calculation is reused across visuals or represents core business logic. Visual calculations are hard to discover, maintain, and govern.

## Listing and Inspecting

```bash
pbir dax viscalcs list "Report.Report"           # All visual calculations across report
pbir dax viscalcs json "Report.Report"            # Full DAX expressions as JSON
```

## Creating Visual Calculations

```bash
# Basic visual calculation
pbir dax viscalcs add "Report.Report/Page.Page/Visual.Visual" \
  -n "RunningTotal" -e "RUNNINGSUM([Revenue])"

# With query reference (binds to specific axis field)
pbir dax viscalcs add "Report.Report/Page.Page/Visual.Visual" \
  -n "RevenueRank" -e "RANK()" -q "Sales.Revenue"
```

### Flags

| Flag | Purpose |
|------|---------|
| `-n` / `--name` | Calculation name |
| `-e` / `--expression` | DAX expression |
| `-q` / `--query-ref` | Query reference (field the calculation relates to) |

## Managing Visual Calculations

```bash
# Rename
pbir dax viscalcs rename "Report.Report/Page.Page/Visual.Visual" \
  --from "OldName" --to "NewName"

# Remove a specific visual calculation
pbir rm "Report.Report/Page.Page/Visual.Visual" --viscalc "Name" -f

# Export as JSON
pbir dax viscalcs json "Report.Report"
```

## Common DAX Functions for Visual Calculations

Visual calculations have access to special DAX functions that operate relative to the visual's axes:

### Aggregation Along Axes

```bash
# Running sum along category axis
pbir dax viscalcs add "Visual.Visual" \
  -n "CumulativeRevenue" -e "RUNNINGSUM([Revenue])"

# Moving average (3-period)
pbir dax viscalcs add "Visual.Visual" \
  -n "MovingAvg" -e "MOVINGAVERAGE([Revenue], 3)"
```

### Ranking

```bash
# Rank by measure value
pbir dax viscalcs add "Visual.Visual" \
  -n "RevenueRank" -e "RANK()" -q "Sales.Revenue"

# Dense rank
pbir dax viscalcs add "Visual.Visual" \
  -n "DenseRank" -e "RANK(Dense)" -q "Sales.Revenue"
```

### Row Navigation

```bash
# Previous period value
pbir dax viscalcs add "Visual.Visual" \
  -n "PriorRevenue" -e "PREVIOUS([Revenue])"

# Next period value
pbir dax viscalcs add "Visual.Visual" \
  -n "NextRevenue" -e "NEXT([Revenue])"

# First/last in axis
pbir dax viscalcs add "Visual.Visual" \
  -n "FirstRevenue" -e "FIRST([Revenue])"
```

### Period-over-Period

```bash
# Difference from previous
pbir dax viscalcs add "Visual.Visual" \
  -n "RevenueDelta" -e "[Revenue] - PREVIOUS([Revenue])"

# Percentage change
pbir dax viscalcs add "Visual.Visual" \
  -n "RevenuePctChange" -e "DIVIDE([Revenue] - PREVIOUS([Revenue]), PREVIOUS([Revenue]))"
```

## Visual Calculations vs Extension Measures

| Aspect | Visual Calculations | Extension Measures |
|--------|--------------------|--------------------|
| Scope | Single visual | Entire report |
| Location | Visual JSON | reportExtensions.json |
| DAX functions | Axis-aware (RUNNINGSUM, RANK, PREVIOUS) | Standard DAX only |
| Discovery | `pbir dax viscalcs list` | `pbir dax measures list` |
| Best for | Running totals, ranks, row navigation | Conditional formatting, conditional rendering |
| Governance | Hardest to discover | Moderate (report-level) |

## Validation

After adding or modifying visual calculations:

```bash
pbir validate "Report.Report"                    # Check report integrity
pbir dax viscalcs list "Report.Report"           # Verify calculations exist
```
