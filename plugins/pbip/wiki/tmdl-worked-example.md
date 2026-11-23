---
title: A tiny TMDL model that te validate accepts
summary: Bikes, a synthetic semantic model with three tables, relationships, a role, a perspective and a function, to copy from
kind: reference
status: current
sources:
  - url: https://learn.microsoft.com/en-us/analysis-services/tmdl/tmdl-overview
tools:
  te: 0.8.1.1
last_updated: 2026-11-23
last_verified: 2026-11-23
review_cadence_days: 90
verified_by:
  - te validate -m plugins/pbip/wiki/examples/bikes/Bikes.SemanticModel --errors-only --non-interactive
  - te validate -m plugins/pbip/wiki/examples/bikes/Bikes.SemanticModel/definition --errors-only --non-interactive
skills: [pbip/tmdl]
---

# A tiny TMDL model that te validate accepts

Synthetic data, no source dependency. Copy a file and rename the objects; `te validate -m <folder>` says whether the result still loads. Both the `.SemanticModel` folder (it has `definition.pbism`) and its `definition` folder are valid `--model` targets; a `.SemanticModel` folder without `definition.pbism` is not.

```dirtree
examples/bikes/Bikes.SemanticModel/
  definition.pbism            version 4.2: TMDL allowed
  definition/
    database.tmdl             compatibilityLevel 1702 (minimum for functions)
    model.tmdl                culture, ref table/expression/role/perspective for ordering
    expressions.tmdl          one parameter, queried by both M partitions
    relationships.tmdl        two many-to-one relationships, named by GUID
    functions.tmdl            Format.Percent, Sales.Unfiltered (ColumnRef and MeasureRef)
    tables/Sales.tmdl         measures with /// descriptions, a backtick expression, a hidden measure
    tables/Product.tmdl       key column, hierarchy, M partition
    tables/Order Date.tmdl    calculated table, sortByColumn, dataCategory
    roles/Regional Manager.tmdl
    perspectives/Finance.tmdl
```

What each file demonstrates:

- [Sales.tmdl](examples/bikes/Bikes.SemanticModel/definition/tables/Sales.tmdl): `///` on a measure (two lines make one description), `=` with the expression on the next line, a triple-backtick expression, `formatString`, `displayFolder`, bare `isHidden`
- `tables/Order Date.tmdl`: a calculated partition (`= calculated`), `sortByColumn` by name
- [Product.tmdl](examples/bikes/Bikes.SemanticModel/definition/tables/Product.tmdl): `hierarchy` and `level` nesting, an M partition that reads the `Source Folder` parameter
- [relationships.tmdl](examples/bikes/Bikes.SemanticModel/definition/relationships.tmdl): `fromColumn` and `toColumn` as `Table.'Column'` references; a quoted table name stays quoted
- [model.tmdl](examples/bikes/Bikes.SemanticModel/definition/model.tmdl): the `ref` lines

Round trip: `te save-as --model <folder> -o <other> --serialization tmdl` rewrites a folder in the serializer's own formatting, which is how you see what Desktop will normalize.
