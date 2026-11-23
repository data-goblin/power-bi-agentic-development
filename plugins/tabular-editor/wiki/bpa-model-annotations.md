---
title: Rules embedded in a model with BPA annotations
summary: The BestPracticeAnalyzer, IgnoreRules and ExternalRuleFiles annotations in model.tmdl, with a model te bpa run evaluates
kind: reference
status: current
sources:
  - url: https://docs.tabulareditor.com/getting-started/bpa.html
tools:
  te: 0.8.1.1
last_updated: 2026-11-23
last_verified: 2026-11-23
review_cadence_days: 90
verified_by:
  - te bpa run --model plugins/tabular-editor/wiki/examples/bpa/embedded/definition --no-defaults --non-interactive --output-format json
skills: [tabular-editor/bpa-rules]
---

# Rules embedded in a model with BPA annotations

[examples/bpa/embedded](examples/bpa/embedded/definition/model.tmdl) carries two model annotations. `te bpa run --no-defaults` on it evaluates 1 rule and reports 1 ignored rule and 1 information-level violation (`Undocumented_Total` has no description); severity 1 keeps the exit code 0, which a verification command needs.

```tmdl
annotation BestPracticeAnalyzer_IgnoreRules = {"RuleIDs":["MEASURE_NAME_NO_UNDERSCORE"]}

annotation BestPracticeAnalyzer = ```
		[
		  { "ID": "MEASURE_HAS_DESCRIPTION", "Name": "Measures need a description",
		    "Severity": 1, "Scope": "Measure",
		    "Expression": "string.IsNullOrWhitespace(Description)", "CompatibilityLevel": 1200 }
		]
		```
```

- `BestPracticeAnalyzer`: a JSON array of rules, the same shape as a rule file
- `BestPracticeAnalyzer_IgnoreRules`: `{"RuleIDs": [...]}`; those rules are skipped for the model
- `BestPracticeAnalyzer_ExternalRuleFiles`: a JSON array of rule file URLs. `te bpa run` fetches them only with `--allow-external-rules`, which is a network call to a URL stored in the model, so read the URL first
- Annotations on one object (`BestPracticeAnalyzer_IgnoreRules` inside a table or column) ignore a rule for that object only. Unverified: not run for this page

Edit annotations through `te` where you can; if you edit `model.tmdl` by hand, the usual TMDL rules apply (see the pbip tmdl skill) and `te validate` checks the result.
