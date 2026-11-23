---
title: Dynamic LINQ in BPA expressions, what compiles and what does not
summary: Six expression forms run against the Bikes model with te bpa run, with the error each failing one produces
kind: gotcha
status: current
sources:
  - url: https://dynamic-linq.net/expression-language
  - url: https://docs.tabulareditor.com/getting-started/bpa.html
tools:
  te: 0.8.1.1
last_updated: 2026-11-23
last_verified: 2026-11-23
review_cadence_days: 90
verified_by:
  - te bpa run --model plugins/pbip/wiki/examples/bikes/Bikes.SemanticModel/definition -r plugins/tabular-editor/wiki/examples/bpa/rules.json --no-defaults --no-model-rules --non-interactive --output-format json
skills: [tabular-editor/bpa-rules]
---

# Dynamic LINQ in BPA expressions

A BPA expression is [Dynamic LINQ](https://dynamic-linq.net/expression-language) over the TOM object, not C#. Each row was run with `te bpa run --no-defaults --no-model-rules` on a copy of the Bikes model (te 0.8.1.1).

```yaml
RegEx.IsMatch(Name, @"^M$"): ruleError "No property or field '@' exists in type 'Measure'"; drop the @
RegEx.IsMatch(Name, "^M$", RegexOptions.IgnoreCase): ruleError "No property or field 'RegexOptions' exists in type 'Measure'"; no options argument
RegEx.IsMatch(Name, "(?i)^total sales$"): works; use the inline flag
Columns.Count(ObjectType = "CalculatedColumn") > 10: ruleError "Operator '=' incompatible with operand types 'ObjectType' and 'String'"
Columns.Count(Type = "Calculated") > 0: works (counted the one calculated column in a test copy; > 1 gave 0 violations)
Name.Contains("_"): works
```

A broken expression does not stop the run: the rule shows up as a `BpaRule` finding with severity error and the other rules still evaluate. Read `ruleErrors` in the JSON result and the `findings` with `objectType: BpaRule`.

## Loading quirks that were tested

- An LF-only file, a `_comment` key on a rule, and `"FixExpression": null` all load and evaluate in `te`
- An unknown `Scope` rejects the file (see [bpa-rule-format](bpa-rule-format.md))
- `Column` as a scope matches data, calculated and calculated-table columns

## Finding properties

`te get <path> --properties` lists every property of an object with its type, which is the list a Dynamic LINQ expression can use. For collection helpers (`DependsOn`, `ReferencedBy`, `Tokenize()`) see the Tabular Editor BPA docs; none of them were exercised for this page.
