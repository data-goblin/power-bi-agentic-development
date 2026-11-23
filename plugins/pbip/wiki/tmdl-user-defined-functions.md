---
title: DAX user-defined functions in functions.tmdl
summary: Parameter types, modes and naming rules for functions, and a function file that te validate accepts
kind: reference
status: current
sources:
  - url: https://learn.microsoft.com/en-us/dax/best-practices/dax-user-defined-functions
tools:
  te: 0.8.1.1
last_updated: 2026-11-23
last_verified: 2026-11-23
review_cadence_days: 90
verified_by:
  - te validate -m plugins/pbip/wiki/examples/bikes/Bikes.SemanticModel/definition --errors-only --non-interactive
skills: [pbip/tmdl]
---

# DAX user-defined functions in functions.tmdl

Generally available since the June 2026 Desktop release; needs `compatibilityLevel` 1702 or higher. Full reference: [Learn](https://learn.microsoft.com/en-us/dax/best-practices/dax-user-defined-functions).

```yaml
parameter hint: "[type] [subtype] [mode]"
type: AnyVal | Scalar | Table | AnyRef | CalendarRef | ColumnRef | MeasureRef | TableRef
subtype (Scalar only): Variant | Int64 | Decimal | Double | String | DateTime | Boolean | Numeric
mode: val (evaluated before the call, default) | expr (evaluated inside the body)
reference types: ColumnRef, MeasureRef, TableRef, CalendarRef and AnyRef must be expr
function name: letters, digits, underscore, and dots for namespaces (Format.Percent); no spaces
not supported: recursion, overloading, an explicit return type, parameter descriptions
```

`EXPR` is a mode and `COLUMN` is not a type, so `(col: COLUMN, m: EXPR)` is wrong. Written that way, `te validate` reports `DAX0002: The SUM function only accepts a column reference as the argument number 1`. The accepted form is in [functions.tmdl](examples/bikes/Bikes.SemanticModel/definition/functions.tmdl):

```tmdl
function Sales.Unfiltered = ```
		(col: ColumnRef expr, m: MeasureRef expr) =>
		    CALCULATE ( SUM ( col ) + m, ALL ( 'Order Date' ) )
		```
```

A `///` block above `function` is the description shown in IntelliSense. A `//` line inside the body is legal, as in any expression.
