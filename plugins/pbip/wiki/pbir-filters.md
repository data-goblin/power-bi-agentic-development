---
title: PBIR filter types and howCreated values
summary: The eleven filter types and the howCreated enum in filterConfiguration 1.3.0, and where filters live
kind: schema
status: current
sources:
  - url: https://github.com/microsoft/json-schemas/blob/main/fabric/item/report/definition/filterConfiguration/1.3.0/schema.json
  - url: https://learn.microsoft.com/en-us/power-bi/developer/projects/projects-report
tools:
  pbir: 0.9.33
last_updated: 2026-11-23
last_verified: 2026-11-23
review_cadence_days: 60
verified_by:
  - pbir add filter --help
skills: [pbip/pbir-format]
---

# PBIR filter types and howCreated values

`filterConfig.filters[]` appears in `report.json` (report filters), `page.json` (page filters) and `visual.json` (visual filters). Each entry has `name`, `field`, `type`, a `filter` body in the `semanticQuery` Filter shape, and optionally `howCreated`.

```yaml
type (11): Categorical, Range, Advanced, Passthrough, TopN, Include, Exclude, RelativeDate, Tuple, RelativeTime, VisualTopN
howCreated: Auto (added when a field is used in a visual), User, Drill, Include, Exclude, Drillthrough
```

An older copy of this skill listed seven types and only `User`. Add filters with `pbir add filter` instead of writing the body: the body shape differs by type (`Categorical` takes `Where` with `In`, `Advanced` takes `Comparison` conditions with the ComparisonKind codes in [pbir-expression-values.md](pbir-expression-values.md)).

Gotchas:

- A slicer's selected value is part of the visual, not a filter; a stale slicer value after a rename is fixed with `pbir` commands, not by editing the filter
- `Passthrough` filters carry a `restatement` string that Desktop shows; other types generate it
- A page or visual `filterConfig` only affects its own scope; a report filter applies to every page
