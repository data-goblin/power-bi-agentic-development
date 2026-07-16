# Report Rebinding and Thick/Thin Conversion

Use `pbir report` commands for every connection change. Never patch `definition.pbir` or assemble
a connection string by hand.

## Rebind a report

Published model:

```bash
pbir backup "Report.Report" -m "Before model rebind"
pbir report rebind "Report.Report" \
  "Workspace.Workspace/Model.SemanticModel"
```

Local model:

```bash
pbir report rebind "Report.Report" --local "../Model.SemanticModel"
```

`--model-id` is optional for a published target; the CLI retrieves it when possible.

## Thick to thin

```bash
pbir report split-from-thick "Project.Report" \
  --target "Workspace.Workspace/Model.SemanticModel" \
  --output ./thin-report
```

This publishes/targets the model and creates the thin report in the requested output format.

## Thin to thick

```bash
pbir report merge-to-thick "Report.Report" "Model.SemanticModel" \
  --output ./ThickProject
```

## Check compatibility

Rebinding does not rename report fields. Validate immediately:

```bash
pbir model "Report.Report" -d
pbir validate "Report.Report" --fields
```

Repair table and field changes with `pbir fields replace-table` and
`pbir fields replace`; see `how-to/fix-broken-field-references.md`. Preview replacements first.

For a local model, open the project in Power BI Desktop. For a remote model, publish only after
`pbir validate "Report.Report" --all` passes.

If `pbir report rebind`, `split-from-thick`, or `merge-to-thick` cannot represent the requested
connection, report the limitation instead of editing report JSON.
