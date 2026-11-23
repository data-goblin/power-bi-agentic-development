---
title: Literal formats and enum values inside PBIR expressions
summary: Literal suffixes, string quoting, ComparisonKind, aggregation and time-unit codes, taken from the semanticQuery 1.4.0 schema
kind: schema
status: current
sources:
  - url: https://github.com/microsoft/json-schemas/blob/main/fabric/item/report/definition/semanticQuery/1.4.0/schema.json
  - url: https://learn.microsoft.com/en-us/power-bi/developer/projects/projects-report
tools:
  pbir: 0.9.33
last_updated: 2026-11-23
last_verified: 2026-11-23
review_cadence_days: 60
verified_by:
  - pbir schema describe --help
skills: [pbip/pbir-format]
---

# Literal formats and enum values inside PBIR expressions

Every property value in `visual.json` is `{"expr": {...}}` or a filter built from the same expression types. The enum codes below come straight from `semanticQuery/1.4.0`; do not trust a copy of them in a skill. Read the schema, or `pbir schema describe`.

## ComparisonKind

```yaml
0: Equal
1: GreaterThan
2: GreaterThanOrEqual
3: LessThan
4: LessThanOrEqual
```

A condition `{"Comparison": {"ComparisonKind": 3, ...}}` means less than, not less than or equal. Earlier copies of this skill had 3 and 4 swapped.

## Other codes

```yaml
aggregation Function: 0 Sum, 1 Average, 2 Distinct count, 3 Min, 4 Max, 5 Count of non-null, 6 Median, 7 StandardDeviation, 8 Variance
TimeUnit: 0 Day, 1 Week, 2 Month, 3 Year, 4 Decade, 5 Second, 6 Minute, 7 Hour
dataViewWildcard matchingOption: 0 Default (identities and totals), 1 Instances, 2 Totals
```

## Literal formats

A `Literal.Value` is always a string that carries its own type:

```yaml
text: "'smooth'" (single quotes inside the JSON string); a quote inside is doubled: "'here''s'"
whole or decimal number: "50D" (double), "8L" (long), "12M" (decimal); the suffix is required, no quotes
boolean: "true" or "false", lowercase, no quotes
null: "null"
colour: "'#1971c2'" or 8-digit "'#801971c2'" (first two digits alpha)
date: "datetime'2024-01-15T00:00:00.0000000'"
font list: "'''Segoe UI Semibold'', helvetica, sans-serif'"
```

Which suffix a property takes is not interchangeable everywhere: copy the property's real value from a Desktop-written file (`examples/visuals/`) instead of guessing D or L. Examples seen in Desktop output: `fontSize` takes D, `labelPrecision` takes L, `transparency` takes D except inside `dropShadow`, where it takes L.

## Where to look next

- Conditional formatting, selectors and visual calculations: real files in `plugins/pbip/skills/pbir-format/examples/visuals/formatted/`, and `pbir visuals cf --help` to write one
- Filter types: [pbir-filters.md](pbir-filters.md)
