---
name: deneb-visuals
version: 0.8.1
description: "This skill should be used whenever the user mentions 'Deneb' in any context, or asks to 'create a Deneb visual', 'add a Vega-Lite chart', 'inject a Deneb spec', 'inject a Vega spec', 'build a custom visualization with Deneb', 'use Vega or Vega-Lite in Power BI', 'add cross-filtering to Deneb', 'theme a Deneb visual', 'write a Deneb spec for Power BI', 'configure Deneb interactivity', 'fix Deneb visual not rendering', 'Deneb field name escaping', 'pbiColor theme colors in Deneb', or needs guidance on Deneb visual creation, Vega/Vega-Lite spec authoring, or Deneb best practices in PBIR reports."
---

# Deneb Visuals in Power BI (PBIR)

> **Report modification requires tooling.** Two paths exist:
> 1. **`pbir` CLI (preferred)** -- use the `pbir` command and the `pbir-cli` skill. Check availability with `pbir --version`.
> 2. **Direct JSON modification** -- if `pbir` is not available, use the `pbir-format` skill (pbip plugin) for PBIR JSON structure and patterns. Validate every change with `jq empty <file.json>`.
>
> If neither the `pbir-cli` skill nor the `pbir-format` skill is loaded, ask the user to install the appropriate plugin before proceeding with report modifications.

Deneb is a certified custom visual for Power BI that enables Vega and Vega-Lite declarative visualization specs directly inside reports. Author specs using this skill.

## Provider Policy

**Prefer Vega-Lite** for new Deneb visuals unless specific Vega-only features are required (signals, event streams, custom projections, force/voronoi layouts). Vega-Lite is more concise, easier to maintain, and covers most chart types. For advanced Vega features, see `references/vega-patterns.md` and the [Vega documentation](https://vega.github.io/vega/docs/).

## Visual Identity

- **visualType:** `deneb7E15AEF80B9E4D4F8E12924291ECE89A`
- **Data role:** Single `dataset` role (all fields go into one "Values" well)
- **Default row limit:** 10,000 rows (override via `dataLimit.override`)
- **Provider:** `vegaLite` (default) or `vega` (when Vega-specific features needed)
- **Render modes:** `svg` (default, sharp text) or `canvas` (better for large datasets)

## Custom Visual Registration (Required)

Register `deneb7E15AEF80B9E4D4F8E12924291ECE89A` in `report.json` `publicCustomVisuals` array manually. Without this, the visual shows "Can't display this visual."

For more information, use the `pbir-format` skill and check the `report.md` reference.

```json
{
  "publicCustomVisuals": ["deneb7E15AEF80B9E4D4F8E12924291ECE89A"]
}
```

## Workflow: Creating a Deneb Visual

### Step 1: Add the Visual

Create the visual.json file manually (see `pbir-format` skill in the pbip plugin for JSON structure) with `visualType: deneb7E15AEF80B9E4D4F8E12924291ECE89A`, field bindings for the columns and measures you need, and position/size as required.

All fields bind to the single `dataset` role. Use `Table.Column` for columns and `Table.Measure` for measures. Field names in bindings must match those used in the Vega/Vega-Lite spec.

### Step 2: Write the Spec

Create a Vega-Lite (or Vega) JSON spec file. Key difference:

- **Vega-Lite:** `"data": {"name": "dataset"}` (object)
- **Vega:** `"data": [{"name": "dataset"}]` (array)

```json
{
  "$schema": "https://vega.github.io/schema/vega-lite/v5.json",
  "data": {"name": "dataset"},
  "mark": {"type": "bar", "tooltip": true},
  "encoding": {
    "y": {"field": "Category", "type": "nominal"},
    "x": {"field": "Value", "type": "quantitative"}
  }
}
```

See `examples/spec/` for complete spec files (Vega and Vega-Lite) and `examples/visual/` for full PBIR visual.json files. Field names in the spec must match the `nativeQueryRef` (display name) from the field bindings.

### Step 3: Inject the Spec

Set the spec and config in the visual's `objects.vega[0].properties` as single-quoted DAX literal strings. The `jsonSpec` property holds the Vega spec (stringified JSON), `jsonConfig` holds the config, and `provider` is set to `'vega'` or `'vegaLite'`. See the PBIR structure reference (`references/pbir-structure.md`) for the full encoding pattern.

**Escaping rules for visual.json injection:**

The spec JSON must be stringified into a single line and wrapped in single quotes inside the `expr.Literal.Value`:

```json
"jsonSpec": {"expr": {"Literal": {"Value": "'{\"$schema\":\"...\",\"data\":{\"name\":\"dataset\"},\"marks\":[...]}'" }}}
```

- The entire JSON spec is flattened to one line
- All inner double quotes (`"`) become `\"` (standard JSON string escaping)
- The stringified JSON is wrapped in single quotes: `'...'`
- Field names with spaces inside Vega expressions use doubled single quotes: `datum[''Sales Amount'']`
- See `examples/visual/` for complete real-world visual.json files showing this encoding

### Step 3b: Review

Before presenting the spec to the user, dispatch the `deneb-reviewer` agent to validate syntax and provide design feedback.

### Step 4: Validate

Validate JSON syntax with `jq empty <visual.json>` and inspect the visual.json to confirm spec content and field bindings.

## Spec Authoring Rules

### Data Binding

- Vega: `"data": [{"name": "dataset"}]` (array form)
- Vega-Lite: `"data": {"name": "dataset"}` (object form)
- Fields reference display names. Special characters (`.`, `[`, `]`, `\`, `"`) become `_`
- Spaces are NOT replaced -- field names keep their spaces (e.g., `"Order Lines"`)

### Field Name Escaping in Expressions (Critical)

Escaping depends on whether the spec is standalone or injected into a PBIR visual.json:

**Standalone spec files** (in `examples/spec/`): use double quotes with JSON escaping:

```json
{"calculate": "datum[\"Order Lines\"] - datum[\"Order Lines (PY)\"]", "as": "diff"}
```

**Inside PBIR visual.json** (in `examples/visual/`): the entire spec is a single-quoted DAX literal string. Field names with spaces use doubled single quotes (`''`):

```
datum[''Order Lines''] - datum[''Order Lines (PY)'']
```

Single quotes that are NOT part of field name escaping (e.g., string literals in filter expressions like `datum.Series == 'Actuals'`) work as-is because they don't conflict with the outer single-quote wrapper.

### Responsive Sizing (Vega)

Use Deneb's built-in signals for responsive container sizing:

```json
"width": {"signal": "pbiContainerWidth - 25"},
"height": {"signal": "pbiContainerHeight - 27"}
```

The offsets account for padding. For absolute positioning of text marks, use `{"signal": "width"}` instead of hardcoded pixel values.

### Config (Separate from Spec)

Always provide a config file for consistent styling. See the Standard Config section in `references/vega-patterns.md`. Key settings: `autosize: fit`, `view.stroke: transparent`, `font: Segoe UI`.

## Theme Integration

Use Power BI theme colors instead of hardcoded hex values:

| Function/Scheme | Purpose | Usage in Vega |
|-----------------|---------|---------------|
| `pbiColor(index)` | Theme color by index (0-based) | `{"signal": "pbiColor(0)"}` |
| `pbiColor(0, -0.3)` | Darken theme color by 30% | Shade: -1 (dark) to 1 (light) |
| `pbiColor("negative")` | Sentiment colors | `"min"`, `"middle"`, `"max"`, `"negative"`, `"positive"` |
| `pbiColorNominal` | Categorical palette | `"range": {"scheme": "pbiColorNominal"}` |
| `pbiColorLinear` | Continuous gradient | `"range": {"scheme": "pbiColorLinear"}` |
| `pbiColorDivergent` | Divergent gradient | `"range": {"scheme": "pbiColorDivergent"}` |

## Interactivity

Enable interactivity via the `vega` objects in visual.json:

| Feature | Property | Default | Notes |
|---------|----------|---------|-------|
| Tooltips | `enableTooltips` | `true` | Use `"tooltip": {"signal": "datum"}` in encode |
| Context menu | `enableContextMenu` | `true` | Right-click drill-through |
| Cross-filtering | `enableSelection` | `false` | Requires `__selected__` handling |
| Cross-highlighting | `enableHighlight` | `false` | Creates `<field>__highlight` fields |

### Cross-Filtering

When `enableSelection` is true, handle `__selected__` (`"on"`, `"off"`, `"neutral"`) in encode blocks. Selection modes: `simple` (auto-resolves) or `advanced` (requires event definitions, Vega only). See `references/vega-patterns.md` for the full pattern.

### Cross-Highlighting

Use layered marks -- background at reduced opacity, foreground shows `<field>__highlight` values. See `references/vega-patterns.md` for details.

### Special Runtime Fields

Deneb injects `__identity__` (row context), `__selected__` (selection state), and `<field>__highlight` (highlight values) at runtime. See `references/capabilities.md`.

## Best Practices

1. **Use Vega-Lite** for new visuals unless Vega-specific features are needed (signals, events, force layouts)
2. **Always use `autosize: fit`** in config for responsive Power BI sizing
3. **Use `pbiContainerWidth`/`pbiContainerHeight`** signals for responsive Vega specs
4. **Use theme colors** (`pbiColor`, `pbiColorNominal`) instead of hex values
5. **Use `enter`/`update`/`hover`** encode blocks for clean state management (Vega only)
6. **Enable tooltips** with `"tooltip": {"signal": "datum"}` on marks
7. **Mind row limits** -- 10K default; set `dataLimit.override` and use `renderMode: canvas` for large datasets
8. **Test field names** -- verify `nativeQueryRef` matches spec field references
9. **Avoid external data** -- AppSource certification prevents loading external URLs
10. **Escaping depends on context** -- double quotes in standalone specs, doubled single quotes in PBIR visual.json (see escaping rules above)

## When to Use Deneb

Deneb is the preferred choice for **advanced custom visuals** that need interactivity (cross-filtering, tooltips, hover effects) and go beyond what native Power BI visuals offer. Use Deneb when you need:

- Custom chart types not available natively (bullet charts, beeswarms, sankeys, etc.)
- Fine-grained control over visual encoding, animation, and interactivity
- Vector-based rendering (crisp at any size)

**Use SVG measures instead** for simple inline graphics in tables/cards (sparklines, data bars, progress bars) where interactivity is not needed. **Use Python/R instead** for statistical visualizations (distribution analysis, regression, correlation) where the focus is analytical rigor over interactivity.

## References

- **`references/community-examples.md`** -- 170+ community templates organized by chart type, with author citations and direct links
- **`references/vega-patterns.md`** -- Vega chart patterns (bar, line, scatter, donut, stacked, heatmap, area, lollipop, bullet, KPI card), standard config, transforms and scales reference
- **`references/vega-lite-patterns.md`** -- Vega-Lite chart patterns (for editing existing Vega-Lite visuals only)
- **`references/pbir-structure.md`** -- PBIR JSON structure (literal encoding, query state, interactivity example)
- **`references/capabilities.md`** -- Full Deneb object properties reference and template format
- **`examples/visual/bullet-chart.json`** -- PBIR visual.json: faceted bullet chart with conditional indicators and cross-filtering (Vega-Lite)
- **`examples/visual/kpi-card.json`** -- PBIR visual.json: KPI card with layered text and conditional % change coloring (Vega-Lite)
- **`examples/visual/trend-line.json`** -- PBIR visual.json: dual-series line chart with fold transform and color/legend mapping (Vega-Lite)
- **`examples/visual/ytd-comparison.json`** -- PBIR visual.json: YTD vs target with dashed lines, endpoint labels, number formatting, and rank-based filtering (Vega-Lite)
- **`examples/spec/vega/`** -- Standalone Vega spec files (bar-chart, line-chart) -- ready to inject into visual.json after escaping
- **`examples/spec/vega-lite/`** -- Standalone Vega-Lite spec files (bullet-chart, kpi-card) -- ready to inject after escaping
- **`examples/standard-config.json`** -- Standard config for all Deneb specs

## Fetching Docs

To retrieve current Power BI custom visual docs, use `microsoft_docs_search` + `microsoft_docs_fetch` (MCP) if available, otherwise `mslearn search` + `mslearn fetch` (CLI). Search based on the user's request and run multiple searches as needed to ensure sufficient context before proceeding. Note: Vega/Vega-Lite docs live at vega.github.io (not MS Learn) -- use `WebFetch` for those.

## Related Skills

- **`pbir-format`** (pbip plugin) -- PBIR JSON format reference
- **`pbi-report-design`** -- Layout and design best practices
- **`r-visuals`** -- R Script visuals (ggplot2)
- **`python-visuals`** -- Python Script visuals (matplotlib)
- **`svg-visuals`** -- SVG via DAX measures (lightweight inline graphics)
