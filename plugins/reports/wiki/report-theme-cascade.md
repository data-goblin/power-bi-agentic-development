---
title: Report theme cascade, schema 2.159 and pbir theme commands
summary: Formatting cascade, what theme schema 2.159 allows, and the pbir theme commands and limits for standardising a report theme.
kind: schema
status: current
sources:
  - url: https://learn.microsoft.com/en-us/power-bi/create-reports/desktop-report-themes
  - url: https://github.com/microsoft/powerbi-desktop-samples/tree/main/Report%20Theme%20JSON%20Schema
tools:
  pbir: 0.9.33
last_updated: 2026-11-23
last_verified: 2026-11-23
review_cadence_days: 60
verified_by:
  - pbir theme validate plugins/reports/wiki/examples/DataGoblins2021.json
  - pbir theme set-formatting --help
  - pbir visuals clear-formatting --help
skills: [reports/modifying-theme-json, reports/pbir-cli]
---

# Report theme cascade, schema 2.159 and pbir theme commands

[Learn: report themes](https://learn.microsoft.com/en-us/power-bi/create-reports/desktop-report-themes) explains import and export. The JSON Schema is `reportThemeSchema-2.159.json` in [microsoft/powerbi-desktop-samples](https://github.com/microsoft/powerbi-desktop-samples/tree/main/Report%20Theme%20JSON%20Schema) (latest as of 2026-11-23). Check the directory listing before citing a newer number.

## Cascade

```text
Power BI defaults
  -> theme wildcard defaults        visualStyles."*"."*"
  -> theme visual-type defaults     visualStyles.<type>."*"
  -> visual instance overrides
```

The last layer wins. `pbir visuals format <visual>` prints the effective value and its source (default, wildcard, visualType, visual), so diagnose with it rather than reading `visual.json`.

## What the schema allows

- `textClasses` keys: `title label callout header largeTitle dataTitle boldLabel largeLabel largeLightLabel lightLabel semiboldLabel smallLabel smallLightLabel smallDataLabel`. Each class takes only `fontFace`, `fontSize`, `fontWeight` and `color`; `underline`, `bold` and `italic` fail validation (`pbir theme set-fonts --italic` and `--underline` are per-visual only)
- Named colours: `good neutral bad maximum center minimum null accent tableAccent foreground* background* hyperlink visitedHyperlink shapeStroke disabledText mapPushpin foregroundSelected foregroundButton`; `null`, `disabledText`, `foregroundSelected` and `foregroundButton` have no `pbir theme set-colors` flag
- `baseTheme` accepts the CYyySUnn names and the `Fluent2-CYyySUnn` names; the list currently ends at `CY26SU10` and `Fluent2-CY26SU10`
- `icons` carries custom icons (`pbir theme icons`)
- `visualStyles.<type>` also holds named style presets; released pbir 0.9.33 cannot author them reliably (`pbir theme push-visual --preset` writes entries `pbir theme validate` rejects), so report the gap instead of editing the theme

## pbir commands that change a theme

```bash
pbir theme set-colors "R.Report" --data-colors '["#1971C2","#F08C00","#2F9E44"]' --good "#2E7D32" --bad "#C62828"
pbir theme set-fonts "R.Report" title --font-size 14 --font-face "Segoe UI Semibold"
pbir theme set-formatting "R.Report" "*.*.dropShadow.show" --value false
pbir theme set-formatting "R.Report" "card.*.border.radius" --value 8
pbir theme push-visual "R.Report/P.Page/BestCard.Visual" --dry-run
pbir theme colors "R.Report" --normalize --apply
```

- `set-formatting` path is `{visualType}.{state}.{property}`: visualType is `*` or a type; state is `*` (flat entry) or `default`, `hover`, `press`, `selected` for stateful cards such as the slicer date-picker button
- `push-visual` promotes a formatted visual to the visual-type defaults and drops instance-specific properties such as title text; read the dry run first
- `theme colors --normalize` snaps hex literals to theme references within a Delta-E distance (default 15); it is a dry run until `--apply`
- `pbir visuals clear-formatting <glob> --keep-cf -f` removes visual overrides so the theme applies; it is destructive, so confirm and `--dry-run` first. `--only-containers` and `--only-objects` narrow it
- `pbir theme validate <report|theme.json|.Theme>` checks structure; `pbir theme serialize` and `build` split a theme into files and merge it back, for inspection or importing a user-provided `.Theme` folder

## Desktop does not reload themes

`pbir desktop refresh` re-reads pages and visuals but not StaticResources. Close and reopen the report in Desktop before judging a theme change ([bridge limits](pbir-desktop-bridge.md)).

## Examples

`examples/DataGoblins2021.json` is a complete theme that `pbir theme validate` accepts and that validates clean against schema 2.159. Microsoft's own `Fluent2-CY26SU03` sample is not used as an example: it fails 11 schema checks against 2.159 (for example `{"solid":{"color":"secondaryBackground"}}` fills), so validate any theme you copy.
