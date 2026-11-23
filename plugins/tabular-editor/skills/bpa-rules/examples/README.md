# BPA rule example files

Every file loads and evaluates with `te bpa run` against a model with 0 rule errors (checked on te 0.8.1.1):

```bash
te bpa run --model <model folder> -r <file> --no-defaults --no-model-rules --non-interactive --output-format json
```

- `comprehensive-rules.json`: 31 rules over DAX, metadata, performance, layout, naming, formatting and governance
- `microsoft-analysis-services-rules.json`: 71 rules from [microsoft/Analysis-Services BestPracticeRules](https://github.com/microsoft/Analysis-Services/tree/master/BestPracticeRules), maintained by the Fabric CAT team; fetch the upstream file for the current set
- `power-query-operations-rules.json`: 10 rules that flag Power Query operations known to break folding or cost memory
- `course-3-business-case-bpa-rules.json`: 10 training-material rules

Rule format, scopes and expression gotchas: [bpa-rule-format](../../../wiki/bpa-rule-format.md) and [bpa-dynamic-linq](../../../wiki/bpa-dynamic-linq.md).
