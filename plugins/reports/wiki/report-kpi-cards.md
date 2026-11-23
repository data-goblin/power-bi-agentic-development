---
title: KPI and card visuals in PBIR
summary: pbir roles and properties for kpi, card and cardVisual, display-unit pitfalls with custom format strings, and SVG icon measures.
kind: reference
status: current
sources:
  - url: https://learn.microsoft.com/en-us/power-bi/visuals/power-bi-visualization-kpi
  - url: https://learn.microsoft.com/en-us/power-bi/visuals/power-bi-visualization-new-card
tools:
  pbir: 0.9.33
last_updated: 2026-11-23
last_verified: 2026-11-23
review_cadence_days: 90
verified_by:
  - pbir schema roles kpi
  - pbir schema roles cardVisual
  - pbir schema describe kpi indicator
skills: [reports/pbi-report-design]
---

# KPI and card visuals in PBIR

Design judgement (a number needs a target, a gap and a trend) is in the `pbi-report-design` skill. This page holds the Power BI specifics. [Learn: KPI visual](https://learn.microsoft.com/en-us/power-bi/visuals/power-bi-visualization-kpi), [Learn: new card](https://learn.microsoft.com/en-us/power-bi/visuals/power-bi-visualization-new-card).

## Pick the type by roles

```yaml
kpi:        Indicator (measure, required), Goal (measure, multiple), TrendLine (column)
cardVisual: Data (column or measure, multiple, required), Rows
card:       legacy single value; role Values
multiRowCard: several related values in one visual
```

Confirm with `pbir schema roles <type>`; role names differ per type. A `kpi` has the built-in goal and trend line; a card needs extension measures for the gap and its colour.

```bash
pbir add visual kpi "R.Report/P.Page" --name RevenueKPI --title "Revenue MTD" \
  -d "Indicator:Measures.Actuals MTD" -d "Goal:Measures.Sales Target MTD" -d "TrendLine:Date.Date"
pbir set "R.Report/P.Page/RevenueKPI.Visual.goals.goalText" --value "Budget"
```

Label what the goal is (`goals.goalText`: "1YP", "Budget", "3M avg"); "Target" alone is ambiguous. Put conditional formatting on the gap, not the value ([conditional formatting](pbir-conditional-formatting.md)).

## Display units

Auto display units fail when a measure carries a custom format string such as `#,##0`: the format string wins and the raw number shows. Query the value under the report's filters (`pbir model -q`), choose the unit per visual and set precision:

```bash
pbir set "R.Report/P.Page/RevenueKPI.Visual.indicator.indicatorDisplayUnits" --value 1000000
pbir set "R.Report/P.Page/RevenueKPI.Visual.indicator.indicatorPrecision" --value 1
```

Enum for `indicatorDisplayUnits`: 0 Auto, 1 None, 1000 Thousands, 1000000 Millions, 1000000000 Billions, 1000000000000 Trillions. Pick the largest unit whose integer part is at least 1; precision 1 for a single digit (3.8M), 0 for two or more (35bn). Percentage measures use unit 1 with precision 1.

## Card titles and subtitles

A card names its metric twice, in the container title and in the label under the value (`categoryLabels` on the legacy `card`, `label` on `cardVisual`): show one. Hide the title with `pbir visuals title "<visual>" --no-show` or the label with `pbir set "<visual>.categoryLabels.show" --value false` (legacy card), and hide the auto subtitle with `pbir visuals subtitle "<visual>" --no-show`. Cards need roughly 130 px height or the value or label clips; raise height before lowering font size (a working size, not a Microsoft rule).

## Icons

Icons are extension measures returning an SVG data URI with data category `ImageUrl` (`pbir dax measures add --data-category ImageUrl`), bound to a role that accepts images or applied with `pbir visuals cf --image`. SVG authoring is in the `svg-visuals` skill of the `custom-visuals` plugin. Pair colour with an arrow or icon for accessibility.
