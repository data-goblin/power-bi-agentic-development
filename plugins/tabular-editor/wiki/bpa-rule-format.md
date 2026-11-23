---
title: BPA rule JSON fields, scopes, severity and file locations
summary: What each field of a Best Practice Analyzer rule means, the valid scope names, and where rule files are read from
kind: reference
status: current
sources:
  - url: https://docs.tabulareditor.com/getting-started/bpa.html
  - url: https://docs.tabulareditor.com/en/cli/
tools:
  te: 0.8.1.1
last_updated: 2026-11-23
last_verified: 2026-11-23
review_cadence_days: 90
verified_by:
  - te bpa run --model plugins/pbip/wiki/examples/bikes/Bikes.SemanticModel/definition -r plugins/tabular-editor/wiki/examples/bpa/rules.json --no-defaults --no-model-rules --non-interactive --output-format json
skills: [tabular-editor/bpa-rules]
---

# BPA rule JSON fields, scopes, severity and file locations

Docs: [Best Practice Analyzer](https://docs.tabulareditor.com/getting-started/bpa.html). A working file is [examples/bpa/rules.json](examples/bpa/rules.json); it evaluates 3 rules against the Bikes model with 0 rule errors.

```yaml
ID: unique within a collection; a duplicate in a collection with higher precedence wins
Name, Category: free text
Description: optional; placeholders %object% (qualified DAX reference), %objectname%, %objecttype%
Severity: 1 information, 2 warning, 3 or above error (used by the command line, not by the TE3 UI)
Scope: comma-separated object types the rule applies to
Expression: Dynamic LINQ, true for a violating object
FixExpression: optional Dynamic LINQ that repairs the violation (te bpa run --fix)
CompatibilityLevel: lowest model compatibility level the rule applies to; some TOM properties do not exist below it
Source, Remarks: optional free text
```

## Scope names

`Model`, `Table`, `Measure`, `Hierarchy`, `Level`, `Relationship`, `Perspective`, `Culture`, `Partition`, `ProviderDataSource`, `StructuredDataSource`, `DataColumn`, `CalculatedColumn`, `CalculatedTable`, `CalculatedTableColumn`, `KPI`, `Variation`, `NamedExpression`, `ModelRole`, `TablePermission`, `ModelRoleMember`, `CalculationGroup`, `CalculationItem`, `Calendar`, `UserDefinedFunction`. `Column` expands to the three column scopes. `te bpa rules add --help` prints the current list.

An unknown scope (`Role`, `Member`, `Expression`) makes `te` refuse the whole file with `Requested value 'Role' was not found`, so one typo hides every rule in it.

## Where rules are read from

```yaml
built-in: 32 rules in te 0.8.1.1 (te bpa rules list --all)
model: annotation BestPracticeAnalyzer on the model (see bpa-model-annotations.md)
rule file or URL: -r, --rules on te bpa run; a file added to the model in TE3 beats the model's own rules
local user: %LocalAppData%\TabularEditor3\BPARules.json
local machine: %ProgramData%\TabularEditor\BPARules.json
precedence for the same ID: model beats user beats machine
```

The machine path has no `3`: an older copy of the bpa-rules skill had `%ProgramData%\TabularEditor3\`, which the docs do not list. `--no-defaults` drops the built-in rules and `--no-model-rules` drops the embedded ones.
