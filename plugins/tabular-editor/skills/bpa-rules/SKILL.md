---
name: bpa-rules
description: Write, debug and run Best Practice Analyzer rules for Tabular Editor and the te CLI. Use when asked to create or fix a BPA rule, when a rule expression errors (No property or field exists) or catches nothing, for Dynamic LINQ expressions and FixExpression, rule files and model-embedded rules, te bpa run results, or BPA in CI.
---

# BPA rules

A rule is JSON: an `Expression` (Dynamic LINQ, not C#) that is true for each violating object of the `Scope` type. The proof that a rule loads and evaluates is `te bpa run`, not reading it. Reference: [Tabular Editor BPA docs](https://docs.tabulareditor.com/getting-started/bpa.html).

## Rules

- Build and test against a model, never from memory: `te bpa run --model <model> -r rules.json --no-defaults --no-model-rules --rule <ID> --non-interactive --output-format json`. Read `ruleErrors` (rules that failed to compile or evaluate; the message carries the Dynamic LINQ error, `findings` with `objectType: BpaRule`) and `violations`. A rule with `ruleErrors` 0 and `violations` 0 on a model that should violate it is a logic bug
- Dynamic LINQ has no verbatim strings and no `RegexOptions`: `RegEx.IsMatch(Name, @"^M$")` fails with "No property or field '@' exists in type 'Measure'"; write `"^M$"`, and use `(?i)` inline for case-insensitive. Escape backslashes for JSON and again for the pattern
- A wrong `Scope` name rejects the whole rule file, not just that rule ("Requested value 'Role' was not found"). The TOM names are listed by `te bpa rules add --help`; `Column` is an alias for the three column scopes
- Severity: 1 information, 2 warning, 3 or higher error. It is ignored in the TE3 UI and drives the exit code only in the CLI (`te bpa run --fail-on error`, the default, exits 1)
- `FixExpression` runs through `te bpa run --fix --save`; keep it to a safe property assignment and check the diff before saving
- LF line endings, `_comment` keys and `"FixExpression": null` all load and evaluate in `te` (tested). Older advice that TE needs CRLF or rejects them applies, if at all, to the TE3 desktop app; Unverified there
- Do not run a questionnaire. Read the model (`te list`, `te get <path> --properties`), read the existing rules (`te bpa rules list --model <model>`), propose rules, write them, run them. Ask only for a choice the model cannot answer, such as which severity fails the build

## Commands

```bash
te bpa rules list --model <model>                 rules from all sources with status
te bpa rules add MY_RULE --name "..." --scope Measure --expression "IsHidden" --category Naming --severity 2
te bpa run --model <model> --fail-on error --ci github     CI gate
te bpa run --model <model> --fix --save           apply FixExpressions
te bpa rules ignore | disable | set | remove      manage rules (see --help)
```

## Where rules come from

Built-in rules (32 in te 0.8.1.1), rules embedded in the model (`annotation BestPracticeAnalyzer`), rule files or URLs, the local user file `%LocalAppData%\TabularEditor3\BPARules.json` and the machine file `%ProgramData%\TabularEditor\BPARules.json` (note: no `3` in the machine path). For the same `ID`, the model beats the user file, which beats the machine file; a rule file added to the model beats the model's own rules. Details and the embedded-rule annotations: [bpa-model-annotations](../../wiki/bpa-model-annotations.md).

## Wiki and examples

- [Rule format, scopes, locations](../../wiki/bpa-rule-format.md)
- [Dynamic LINQ gotchas, verified with te](../../wiki/bpa-dynamic-linq.md)
- [Rules embedded in a model](../../wiki/bpa-model-annotations.md)
- [A CI rule set and the script that proves each rule fires](../../wiki/bpa-ci-rule-set.md)
- `examples/`: four rule files that load with 0 rule errors; the bpa-expression-helper agent and the `/suggest-rule` command build on them
