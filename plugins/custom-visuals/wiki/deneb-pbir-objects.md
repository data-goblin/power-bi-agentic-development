---
title: Deneb visual.json objects and encoding
summary: How a Deneb visual is stored in PBIR, its object properties, and what pbir 0.9.33 can and cannot change.
kind: schema
status: current
sources:
  - url: https://deneb.guide/docs/pbir-guide
  - url: https://github.com/deneb-viz/deneb/blob/main/apps/deneb/capabilities.json
last_updated: 2026-11-23
last_verified: 2026-11-23
review_cadence_days: 60
tools:
  pbir: 0.9.33
verified_by:
  - pbir visuals deneb --help
  - pbir visuals bind --help
skills: [custom-visuals/deneb-visuals]
---

# Deneb visual.json objects and encoding

The official [PBIR implementation guide](https://deneb.guide/docs/pbir-guide) is the reference. Minimum for a working visual: `visual.visualType` = `deneb7E15AEF80B9E4D4F8E12924291ECE89A`, `visual.objects.vega[0].properties.jsonSpec` = the spec as a string in single quotes, `jsonConfig` = `'{}'`. A real file: [kpi-card visual](../skills/deneb-visuals/examples/visual/kpi-card.json).

## Literal encoding

```yaml
text: Value is the text wrapped in single quotes, with every single quote inside doubled ('')
integer: ends with D (270D)
boolean: true or false without quotes
```

Desktop writes `datum[''Order Lines'']` inside `jsonSpec`. pbir 0.9.33 `visuals deneb` writes the spec between single quotes WITHOUT doubling inner single quotes (read from its source and confirmed on a scratch report). Keep specs free of single quotes: write `datum["Order Lines"]` (JSON-escaped in the file) and use double-quoted string literals.

## Objects and properties

From `capabilities.json` (Deneb 2.0.1). Enumerations are given with their values.

```yaml
dataRoles: one role "dataset" (kind GroupingOrMeasure); dataReductionAlgorithm window count 30000
vega:
  jsonSpec, jsonConfig: text
  provider: vegaLite | vega
  version: text
  logLevel: 0 to 4
  renderMode: svg | canvas
  enableTooltips, enableContextMenu, enableContextMenuSelector, enableHighlight, enableSelection: bool
  selectionMode: simple | advanced
  selectionMaxDataPoints: numeric (UI range 1 to 250, default 50)
  tooltipDelay: numeric
dataLimit: override (bool), showCustomVisualNotes (bool), enableIncrementalDataUpdates (bool), incrementalUpdateThreshold (numeric)
display: scrollbarColor, scrollbarOpacity, scrollbarRadius, scrollbarWidth, scrollEventThrottle
editor: theme (dark|light), position (left|right), fontSize, wordWrap, showLineNumbers, showViewportMarker, previewScrollbars, debouncePeriod, debugTableRowsPerPage, formattingMaxLineLength, backgroundPassThrough
stateManagement: viewportHeight, viewportWidth (Deneb writes these itself), supportFieldConfiguration, denebMetaVersion, scaleToZoom, consolidateFieldParameters
developer: version, locale (en-US | en-GB | de-DE | fr-FR)
```

## What pbir 0.9.33 covers

```yaml
create_visual: no command (pbir add visual --list has no Deneb entry); copy one with pbir cp "A.Report/P.Page/V.Visual" "B.Report/P.Page/New.Visual", which also carries the report.json publicCustomVisuals entry
register: no command for publicCustomVisuals; pbir cp does it, otherwise add the visualType to the list in report.json by hand
bind_fields: pbir visuals bind <visual> --add "dataset:Sales.Revenue" --type Measure
inject_spec: pbir visuals deneb <visual> --spec-file chart.vl.json --provider vegaLite [--config-file config.json]
vega_properties: pbir set rejects vega.* and dataLimit.* ("Unknown component"), even with --no-validate; edit objects.vega by hand, then run pbir validate
```

Checked against the released 0.9.33 runner on a scratch report. Newer pbir builds may add commands; run `pbir visuals --help` and `pbir add --help` before falling back to hand edits.
