# Power BI Themes

Themes are the report-wide design system. Read theme metadata when you need to understand the
cascade, but make every change through `pbir`.

## The cascade

Formatting resolves from broadest to most specific:

1. Power BI defaults
2. Theme wildcard defaults
3. Theme visual-type defaults or presets
4. Page and visual overrides

Use the theme for repeated choices. Keep visual-level overrides for genuine exceptions.

## Color policy

Color should explain something, not decorate everything. Keep the system small and stable:

- neutral foreground/background colors for structure
- one accent for selection and focus
- `good`, `neutral`, and `bad` for meaning
- categorical palette colors only when categories need to be distinguished
- the same color must mean the same thing throughout the report

Start with an audit:

```bash
pbir theme colors "Report.Report" --used-only
pbir color list "Report.Report"
```

Set the palette and semantic colors through the theme:

```bash
pbir theme set-colors "Report.Report" \
  --data-colors '["#2F6B8A","#6F8FA3","#A8B8C2"]' \
  --accent "#2F6B8A" --good "#2E7D32" --neutral "#8A6D1D" --bad "#B3261E"
```

Bind near-matching literals back to the theme only after previewing:

```bash
pbir theme colors "Report.Report" --normalize
pbir theme colors "Report.Report" --normalize --apply
```

For a deliberate report-wide hex replacement:

```bash
pbir color replace "Report.Report" --from "#FF0000" --to "#B3261E"
pbir color replace "Report.Report" --from "#FF0000" --to "#B3261E" -f
```

## Typography

Audit before changing fonts:

```bash
pbir theme fonts "Report.Report"
pbir fonts list "Report.Report"
```

Author reusable text levels in the theme:

```bash
pbir theme set-fonts "Report.Report" title --font-face "Segoe UI Semibold" --font-size 14
pbir theme set-fonts "Report.Report" label --font-face "Segoe UI" --font-size 10
pbir theme set-fonts "Report.Report" callout --font-face "Segoe UI Semibold" --font-size 32
```

Use `pbir fonts replace` for a report-wide family change and `pbir fonts clear` to remove local
overrides so the theme can apply.

## Formatting defaults

Discover the property before setting it:

```bash
pbir schema describe cardVisual title
pbir theme set-formatting "Report.Report" "*.*.title.fontSize" --value 14
pbir theme set-formatting "Report.Report" "cardVisual.*.title.show" --value true
pbir theme set-formatting "Report.Report" "*.*.background.color" --value "#F5F5F5"
```

If one visual already has the right treatment, preview promoting its reusable formatting:

```bash
pbir theme push-visual "Report.Report/Page.Page/Card.Visual" --dry-run
pbir theme push-visual "Report.Report/Page.Page/Card.Visual" --components title,background
```

Instance-specific values such as title text do not belong in theme defaults.

## Inspection and validation

Use read-only commands when schema detail matters:

```bash
pbir cat "Report.Report/theme"
pbir theme validate "Report.Report"
pbir validate "Report.Report" --all
```

Never edit the theme file, `report.json`, or visual JSON with `jq`, Python, search-and-replace, or
a text editor. If a needed theme operation is missing from `pbir`, report the capability gap.

Power BI Desktop reload does not apply theme changes. Close and reopen the report before judging
the final theme result.
