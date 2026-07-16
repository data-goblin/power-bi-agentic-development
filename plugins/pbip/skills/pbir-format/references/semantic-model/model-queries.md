# Query a Report's Semantic Model

Use `pbir model --query` for quick DAX checks against the model connected to a report.

```bash
pbir model "Report.Report" --query 'EVALUATE ROW("Revenue", [Revenue])'
pbir model "Report.Report" --query "EVALUATE TOPN(10, SUMMARIZECOLUMNS('Date'[Month], \"Revenue\", [Revenue]))"
pbir model "Report.Report" --query 'EVALUATE INFO.VIEW.MEASURES()' --format json
```

Use `--format table` for human review and `--format json` when another tool will consume the
result. Query execution requires access to the connected semantic model.

## Useful checks

Measure result:

```dax
EVALUATE ROW("Value", [Measure Name])
```

Grouped result:

```dax
EVALUATE
SUMMARIZECOLUMNS(
    'Date'[Month],
    "Revenue", [Revenue]
)
```

Filter context:

```dax
EVALUATE
CALCULATETABLE(
    ROW("Revenue", [Revenue]),
    TREATAS({"Belgium"}, 'Geography'[Country])
)
```

Use `pbir visuals query` or `pbir visuals test` when the question is about a particular visual's
generated query or performance. Use `te` for semantic-model authoring, validation, and richer
metadata operations.

Do not download and rewrite report JSON or model definition payloads to answer a query.
