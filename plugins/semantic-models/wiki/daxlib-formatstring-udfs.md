---
title: Dynamic format strings from a DAX UDF library (DaxLib.FormatString)
summary: How measures call UDFs in formatStringDefinition, with five functions from the public DaxLib.FormatString package that pass te validate
kind: recipe
status: current
sources:
  - url: https://github.com/daxlib/daxlib/tree/main/packages/d/daxlib.formatstring/0.1.2
  - url: https://github.com/daxlib/dev-daxlib-formatstring
  - url: https://learn.microsoft.com/en-us/dax/best-practices/dax-user-defined-functions
tools:
  te: 0.8.1.1
last_updated: 2026-11-23
last_verified: 2026-11-23
review_cadence_days: 90
verified_by:
  - te validate -m plugins/semantic-models/wiki/examples/daxlib-formatstring --errors-only --non-interactive
skills: [semantic-models/dax]
---

# Dynamic format strings from a DAX UDF library

[DaxLib.FormatString](https://github.com/daxlib/dev-daxlib-formatstring) (MIT, version 0.1.2 on [daxlib.org](https://github.com/daxlib/daxlib/tree/main/packages/d/daxlib.formatstring/0.1.2), 29 functions) builds format strings from small UDFs. Install and registry mechanics are in [daxlib-packages.md](../../pbi-desktop/wiki/daxlib-packages.md); UDF syntax is on Learn and in [udf-authoring.md](udf-authoring.md). This page shows the calling pattern.

```dirtree
examples/daxlib-formatstring/
  database.tmdl        compatibilityLevel 1702
  model.tmdl           one table
  functions.tmdl       5 of the 29 functions, copied unchanged except the /// summary lines
  tables/Sales.tmdl    four measures with formatStringDefinition
```

## The pattern

A format string function returns a string such as `#,##0.0`. A measure uses it as the expression of `formatStringDefinition`, so the format follows the model instead of a literal. A function with no parameters is still called with empty parentheses; `Ordinals` reads `SELECTEDMEASURE ()` itself.

```tmdl
measure 'Total Quantity' = SUM ( Sales[Quantity] )
	formatStringDefinition = DaxLib.FormatString.Basic.Numbers ()

measure 'Total Weight' = SUM ( Sales[Weight] )
	formatStringDefinition =
			DaxLib.FormatString.Component.DecimalPlaces ( "#,##0", 1 )
			    & " "
			    & DaxLib.FormatString.Component.MakeStringSafe ( "kg" )
```

[Sales.tmdl](examples/daxlib-formatstring/tables/Sales.tmdl) also uses `Basic.Ordinals ()` (appends st, nd, rd or th) and `Basic.Percents ()`. `Component.*` functions are building blocks: `DecimalPlaces` appends a decimal point and up to nine zeros, `MakeStringSafe` wraps text in quotes so a unit such as `kg` is literal.

## What the check proves

`te validate -m` resolves every UDF call. Changing a call to `Basic.Ordinalz ()` reports `DAX0002 ... is not a valid function name`, and `Basic.Ordinals ( 1 )` reports `Too many arguments ... The maximum argument count for the function is 0`. The rendered strings were not evaluated here: confirm them in Desktop or with a `te query` that calls `FORMAT`.

## Notes

- Keep the `DAXLIB_PackageId` and `DAXLIB_PackageVersion` annotations on each function; they let daxlib tooling update the package
- The library needs compatibility level 1702 or higher; the example model uses 1702
- The package depends on its own `Component.*` functions: copy a function together with everything it calls, or `te validate` reports the missing name
