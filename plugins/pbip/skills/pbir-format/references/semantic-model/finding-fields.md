# Find Semantic Model Fields

Use the report connection and validated CLIs instead of parsing downloaded definition payloads.

## Fields used by the report

```bash
pbir fields list "Report.Report"
pbir fields find "Revenue" "Report.Report"
pbir fields find "Sales.Revenue" "Report.Report" --threshold 1.0
```

`pbir fields find` searches fields already used in reports. It is useful for locating bindings,
not for enumerating every field available in the model.

## Fields available in the connected model

```bash
pbir model "Report.Report"
pbir model "Report.Report" --definition
pbir model "Report.Report" --definition --table Sales
pbir model "Report.Report" --definition --use-cache
```

Use `--verbose` only when the full TMDL response is actually needed. Clear the model cache after a
schema change:

```bash
pbir model --clear-cache
```

For deeper work on a semantic model, use the `te-cli` skill: connect to the model, then use
`te ls`, `te find`, and `te get`. Keep model mutations in `te` and report mutations in `pbir`.

## Validate a binding

```bash
pbir visuals bind "Report.Report/Page.Page/Visual.Visual" --show
pbir validate "Report.Report" --fields
```

If a field moved or was renamed, use `pbir fields replace` or `replace-table`; never patch report
JSON references directly.
