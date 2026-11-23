---
title: DAX user-defined functions with te and TMDL
summary: Learn is the owner. This page keeps te commands, dotted names, documentation tags and the shipped limits.
kind: gotcha
status: current
sources:
  - url: https://learn.microsoft.com/en-us/dax/best-practices/dax-user-defined-functions
tools:
  te: 0.8.1.1
last_updated: 2026-11-23
last_verified: 2026-11-23
review_cadence_days: 90
verified_by:
  - te validate -m plugins/semantic-models/wiki/examples/udf-optional-default --errors-only
skills: [semantic-models/dax, semantic-models/organize-semantic-model]
---

# DAX user-defined functions

Read the Learn page first. It covers the type system (`AnyVal`, `Scalar`, `Table`, the `*Ref` types), `val` versus `expr`, type-check functions and worked examples. Learn dates UDFs as generally available in Desktop and the service from the June 2026 release, compatibility level 1702 or higher.

## What Learn states that older notes got wrong

- A parameter is optional when it has `= <DefaultExpression>`. Callers omit it or pass an empty argument (`F(1,,3)`). The minimum argument count is set by the rightmost required parameter
- A default expression sees names visible where the function is defined, and cannot refer to another optional parameter
- Both type-check families are valid: `ISNUMERIC`/`ISINT64`/`ISSTRING`/`ISBOOLEAN` and `ISNUMBER`/`ISINTEGER`/`ISTEXT`/`ISLOGICAL`, plus `ISDOUBLE`, `ISDECIMAL`, `ISCURRENCY`, `ISDATETIME`
- Document with `///` lines and JSDoc tags (`@param {NUMERIC} amount - text`, `@returns`). Plain `//` and `/* */` comments do not show in IntelliSense
- Function names may contain dots for namespacing (`Finance.AddTax`), not at the start or end, not consecutive. Parameter names may not contain dots
- The TOM class is `Function` and the collection is `Model.Functions`; there is no `UserDefinedFunction` class

## Limits that bite during a tidy-up

```yaml
cannot hide a function, or put it in a display folder
cannot combine functions with translations
not supported in a model without tables
no recursion, no overloading, no explicit return type, no parameter descriptions
a function cannot return an enum value
object-level security does not carry over: a function that reads a secured measure runs as if the measure did not exist
unqualified column names in the body cannot be fixed up on rename: always write 'Table'[Column]
```

## te commands

```bash
te add Finance.AddTax -t Function -p Expression='( amount : NUMERIC, taxRate : NUMERIC = 0.1 ) => amount * ( 1 + taxRate )' --save
```

`te add` rejects a dot in the name (`Object name contains invalid character '.'`). Create it with a plain name, then rename, or use a script:

```bash
te add AddTax -t Function -p Expression='( amount : NUMERIC ) => amount' --save
te mv Functions/AddTax Functions/Finance.AddTax --save
te script --inline 'var f = Model.AddFunction("Finance.AddTax"); f.Expression = "( amount : NUMERIC ) => amount";' --save
te validate --errors-only
```

Raise the compatibility level before adding the first function if the model is below 1702; it is one-way, so ask first.

Verified example: [examples/udf-optional-default](examples/udf-optional-default/functions.tmdl) is a te-made model with one function with a default parameter; `te validate` accepts it.

## Testing

Define the function in a query and evaluate it against fixed inputs before saving it to the model. Test one edge case per parameter (BLANK, zero, wrong type). For `expr` parameters, evaluate inside `SUMMARIZECOLUMNS` over the dimension the function changes.

```dax
DEFINE
    FUNCTION Finance.AddTax = ( amount : NUMERIC, taxRate : NUMERIC = 0.1 ) => amount * ( 1 + taxRate )
EVALUATE
{ Finance.AddTax ( 100 ), Finance.AddTax ( 100, 0.2 ) }
```

`te query` needs a server or active connection; it does not run against a bare folder.

## Packaged functions

Functions installed from daxlib.org carry `DAXLIB_PackageId` and `DAXLIB_PackageVersion` annotations. Keep them, and wrap a packaged function in a model function instead of editing it. Package layout: https://github.com/daxlib/daxlib (`packages/<letter>/<id>/<version>/lib/functions.tmdl`).
