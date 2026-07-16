# Convert a Legacy Report to PBIR

Use the tested `pbir report convert` path. Do not parse the monolithic `report.json`, build PBIR
folders, or transform projections with a custom script.

The converter is experimental: it is useful and covered by tests, but legacy report metadata has
undocumented edge cases. Work on a backup and verify the rendered result.

## Safe workflow

```bash
pbir --show-legacy ls
pbir backup "Legacy.Report" -m "Before legacy conversion"
pbir report convert "Legacy.Report" \
  --format pbir --name "Upgraded" --validate
pbir validate "Upgraded.Report" --all
```

Use `--force` only when an existing destination is intentionally being replaced. Prefer a new
output name during evaluation.

Legacy bookmarks are reported and skipped because their saved query state cannot be translated
safely. Recreate those bookmarks in Power BI Desktop after conversion.

## Ephemeral end-to-end check

Run the conversion against a temporary copy of a real legacy report, then verify:

1. `pbir validate "Upgraded.Report" --all` passes.
2. Page and visual counts match the source closely enough to explain any known skips.
3. Important field bindings resolve.
4. The report opens and renders in Power BI Desktop.
5. Slicers, interactions, sorts, conditional formatting, and custom visuals still behave.

Do not publish the converted report until that check passes. If conversion exposes an unsupported
legacy feature, preserve the source and report the converter gap rather than repairing JSON by
hand.
