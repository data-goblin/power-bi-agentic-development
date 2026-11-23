---
name: deneb-visuals
description: Authors and edits Deneb (Vega and Vega-Lite) visuals in PBIR reports, including Deneb 2.0 changes, field names, theme colors, cross-filtering and importing community templates. Use for "Deneb", "Vega-Lite in Power BI", "Vega spec in a report", jsonSpec, pbiColor, denebContainer, __selected__, or a visual whose visualType starts with deneb. Not for SVG measures, script visuals or pbiviz custom visuals.
---

# Deneb visuals (PBIR)

## Rules

- Identity: `visualType` `deneb7E15AEF80B9E4D4F8E12924291ECE89A`; one data role `dataset` (columns and measures); Deneb 2.0.1 (2026-10-18) bundles Vega 6.4.0 and Vega-Lite 6.4.3
- Prefer Vega-Lite. Use Vega only for signals, event streams, force or voronoi layouts and advanced cross-filtering (Vega-only)
- The spec reads `"data": {"name": "dataset"}` in Vega-Lite and `"data": [{"name": "dataset"}]` in Vega. No `data.url`, no `data.values`, no `usermeta`, no root `$schema` (2.0 warns on it)
- Sizing signals are `denebContainer.width` and `denebContainer.height`; `pbiContainerWidth` and `pbiContainerHeight` are deprecated
- Row limit: 30,000 initial rows; override loads more but is not guaranteed for PDF or PowerPoint export. Aggregate in DAX first
- Field names in the spec are the display names of the bound fields. Spaces stay; `. [ ] \ "` become `_`.
- Removed in 1.9: `__identity__` and `__key__`; use `__row__`
- Theme: `pbiColor(index, shade)`, `pbiColor("negative")` (`min middle max negative neutral positive bad good`), schemes `pbiColorNominal pbiColorOrdinal pbiColorLinear pbiColorDivergent`: [theme colors](https://deneb.guide/docs/schemes)
- Cross-filtering is off by default. With `enableSelection`, Deneb adds `__selected__` (`on`, `off`, `neutral`) to each row and the spec must encode it. Simple mode resolves up to 250 points (default 50); `selectionMode` advanced is Vega-only: [advanced cross-filtering](https://deneb.guide/docs/interactivity-selection-advanced)
- Supporting fields (`<field>__highlight`, `__highlightStatus`, `__highlightComparator`, `__format`, `__formatted`, `__names`) are per-field switches in 2.0; they exist only when enabled
- AppSource Deneb cannot fetch remote data; the spec may only read `dataset`
- Deneb 2.0 changes in full: [Deneb 2.0 changes](../../wiki/deneb-2-migration.md); storage and properties: [visual.json objects](../../wiki/deneb-pbir-objects.md); templates: [template format v2](../../wiki/deneb-templates-v2.md)

## Workflow (pbir 0.9.33)

pbir 0.9.33 has no command to create a Deneb visual, register it in `publicCustomVisuals`, or set `vega.*` properties. Copy a Deneb visual that is already in a report (`pbir cp "A.Report/P.Page/V.Visual" "B.Report/P.Page/New.Visual"` also copies the registration), or copy [examples/visual/kpi-card.json](examples/visual/kpi-card.json) into the page's `visuals/<name>/visual.json` and add the `visualType` to `publicCustomVisuals` in `report.json`. Everything else goes through pbir:

```bash
pbir visuals bind "R.Report/P.Page/Rev.Visual" --add "dataset:Product.Category" --type Column
pbir visuals bind "R.Report/P.Page/Rev.Visual" --add "dataset:Sales.Revenue" --type Measure
pbir visuals deneb "R.Report/P.Page/Rev.Visual" --spec-file chart.vl.json --provider vegaLite --config-file examples/standard-config.json
pbir validate "R.Report" --all
```

- Name spec files `*.vl.json` (Vega-Lite) or `*.vega.json` (Vega): the plugin's PostToolUse hook lints those for the rules above and prints what it cannot check
- `pbir visuals deneb` in 0.9.33 does not double single quotes when it writes the literal: use `datum["Order Lines"]` and no single-quoted strings in specs
- `enableSelection`, `enableHighlight`, `selectionMode` and `renderMode` have no pbir command in 0.9.33: edit the `visual.objects.vega[0].properties` literals by hand (`"enableSelection": {"expr": {"Literal": {"Value": "true"}}}`; integers end in `D`), then run `pbir validate`
- Examples that a tool accepted: [kpi-card visual](examples/visual/kpi-card.json), [Vega bar spec](examples/spec/vega/bar-chart.json), [Vega-Lite KPI spec](examples/spec/vega-lite/kpi-card.json), [standard config](examples/standard-config.json)
- The `deneb-reviewer` agent ships with the reports plugin, not this one; without it, rely on the hook and `pbir validate`

## Importing a community template

Templates are mostly format v1 and predate 2.0; read the [v2 page](../../wiki/deneb-templates-v2.md) for the terminal steps and [repositories](../../wiki/deneb-community-templates.md) for sources.
