---
title: A BPA rule set that gates a PBIP model, and the test that proves it
summary: Two error-level rules for Auto date/time, run with te bpa run in CI, plus a script that injects each violation and checks the rule fires
kind: recipe
status: current
sources:
  - url: https://docs.tabulareditor.com/getting-started/bpa.html
tools:
  te: 0.8.1.1
last_updated: 2026-11-23
last_verified: 2026-11-23
review_cadence_days: 90
verified_by:
  - te bpa run --model plugins/pbip/wiki/examples/bikes/Bikes.SemanticModel/definition -r plugins/tabular-editor/wiki/examples/bpa-ci-rules/model-rules.json --no-defaults --no-model-rules --fail-on error --non-interactive --output-format json
  - python3 -I plugins/tabular-editor/wiki/examples/bpa-ci-rules/prove-rules.py
skills: [tabular-editor/bpa-rules]
---

# A BPA rule set that gates a PBIP model, and the test that proves it

Field meanings and scopes are in [bpa-rule-format.md](bpa-rule-format.md). This page is the pattern a team keeps in its repository: a small rule file that fails the build, and a script that proves each rule can fail.

Files:

```dirtree
examples/bpa-ci-rules/
  model-rules.json   two rules, severity 3
  prove-rules.py     copies the Bikes model, injects each violation, checks exit code and rule ID
```

## The rules

[model-rules.json](examples/bpa-ci-rules/model-rules.json) holds `MODEL_AUTO_DATE_TIME_DISABLED` (scope `Model`, fires when the `__PBI_TimeIntelligenceEnabled` annotation is `1`) and `MODEL_NO_AUTO_DATE_TABLES` (scope `Table, CalculatedTable`, fires on names starting `LocalDateTable_` or `DateTableTemplate_`). Both are severity 3, so `--fail-on error` turns them into exit code 1. IDs are plain upper snake case; a CI log line then names the rule without a lookup.

```bash
te bpa run --model <Model>.SemanticModel/definition -r rules/model-rules.json \
  --no-defaults --no-model-rules --fail-on error --non-interactive --output-format json
```

`--no-defaults` drops the 32 built-in rules and `--no-model-rules` drops annotations embedded in the model, so the file in the repository is the only source of truth. On the Bikes example this evaluates 2 rules with 0 violations and exits 0.

## Prove the rule can fail

A rule whose expression never matches passes silently. [prove-rules.py](examples/bpa-ci-rules/prove-rules.py) runs the command three times: on the clean model (exit 0, no findings), on a copy with `annotation __PBI_TimeIntelligenceEnabled = 1` added under the `model` line, and on a copy with a `LocalDateTable_Demo` table. It asserts exit 1 and the expected rule ID in `findings[].code` for each, and that `ruleErrors` is 0. Run it whenever a rule changes.

Expected finding for the annotation case (trimmed):

```json
{ "severity": "error", "source": "bpa", "code": "MODEL_AUTO_DATE_TIME_DISABLED",
  "object": "Model", "objectType": "Model", "ruleName": "Auto date/time must be disabled" }
```

The summary on stdout reads `Failed: 1 violation(s) at error level or above` in text format.

## Gotchas

- The annotation must sit inside the `model` block, indented under it; appended after the `ref` lines it is not read as a model annotation and the rule stays silent
- Power BI Desktop writes `__PBI_TimeIntelligenceEnabled = 0` when Auto date/time is off; a model without the annotation also passes
- Report-level rules run with `pbir bpa run` and use a different expression language (`visual_type`, `field_count`); the rule file format is otherwise the same
