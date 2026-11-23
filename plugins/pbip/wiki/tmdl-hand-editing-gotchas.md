---
title: TMDL rules the parser enforces that Learn does not spell out
summary: Which TMDL edits te validate rejects, with the error text, and which look wrong but parse
kind: gotcha
status: current
sources:
  - url: https://learn.microsoft.com/en-us/analysis-services/tmdl/tmdl-overview
  - url: https://learn.microsoft.com/en-us/power-bi/developer/projects/projects-dataset
tools:
  te: 0.8.1.1
last_updated: 2026-11-23
last_verified: 2026-11-23
review_cadence_days: 90
verified_by:
  - te validate -m plugins/pbip/wiki/examples/bikes/Bikes.SemanticModel/definition --errors-only --non-interactive
skills: [pbip/tmdl]
---

# TMDL rules the parser enforces that Learn does not spell out

Grammar: [TMDL overview](https://learn.microsoft.com/en-us/analysis-services/tmdl/tmdl-overview). Every row below was run against the model in [examples/bikes](examples/bikes/Bikes.SemanticModel/definition) with `te validate -m <folder> --errors-only --non-interactive` (te 0.8.1.1, TOM TmdlSerializer 19.118.3).

## Rejected

```yaml
"// hello" on its own line between objects:
  result: TmdlFormatException, "Parsing error type - Indentation", "Invalid indentation was detected"
  fix: use a /// description, or put the // inside the DAX or M expression body
"/// text" then a blank line then the object:
  result: TmdlFormatException, "Unexpected line type: Empty!"
  fix: remove the blank line; the description block must touch the declaration
"/// text" above a relationship:
  result: TmdlSerializationException, "Property 'description' is unknown and is not expected in the situation it appears"
  fix: relationships have no Description; delete the line
a relationship whose toColumn does not exist:
  result: TmdlDeserializationWithReferenceErrorsException, names the property and the object
  fix: references resolve across the whole folder, so write every file before you validate
a measure that uses [Total Sale] instead of [Total Sales]:
  result: DAX0002 "Either [Total Sale] doesn't exist, or there is no current row for a column named [Total Sale]"
  fix: DAX is analysed per model, not per file
```

Parse errors name the document (`Document - './tables/Sales'`) and the line. Reference errors name only the object, so search the folder for it.

## Looks wrong, parses

```yaml
"///" alone on a line above a measure: accepted (empty description)
isHidden: true next to bare isHidden: both accepted
4-space indentation instead of tabs: accepted when the whole file uses it
a column named Sales($) or 4Cat without quotes: accepted
a ref table line for a table that has no file: accepted, ignored (Learn: missing file is ignored)
an expression named like a table (expression Product next to table Product): accepted by TOM and te validate
```

The last case used to be documented as a Desktop load failure. Unverified: Desktop was not run. If you hit it, rename the expression.

## Where // is legal

Inside an expression body, indented as part of it. The model's `Return Rate` measure and the `Format.Percent` function carry a `//` line in the expression and validate.

```tmdl
	measure 'Return Rate' =
			// a // comment is legal here, inside the expression body
			DIVIDE ( [Returned Sales], [Total Sales] )
```
