---
name: deneb-visuals
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

**Always use Vega (full) as the default provider for new Deneb visuals.** Vega provides full control over signals, events, transforms, encode blocks, and interactions -- producing higher-quality, more maintainable specs. Only use Vega-Lite when modifying an existing Deneb visual that already uses Vega-Lite.

## Visual Identity

- **visualType:** `deneb7E15AEF80B9E4D4F8E12924291ECE89A`
- **Data role:** Single `dataset` role (all fields go into one "Values" well)
- **Default row limit:** 10,000 rows (override via `dataLimit.override`)
- **Provider:** `vega` (default for new visuals) or `vegaLite` (existing visuals only)
- **Render modes:** `svg` (default, sharp text) or `canvas` (better for large datasets)

## Custom Visual Registration (Required)

Register `deneb7E15AEF80B9E4D4F8E12924291ECE89A` in `report.json` `publicCustomVisuals` array manually. Without this, the visual shows "Can't display this visual."

```json
{
  "publicCustomVisuals": ["deneb7E15AEF80B9E4D4F8E12924291ECE89A"]
}
```

## Workflow: Creating a Deneb Visual

### Step 1: Add the Visual

Create the visual.json file manually (see `pbir-format` skill in the pbip plugin for JSON structure) with `visualType: deneb7E15AEF80B9E4D4F8E12924291ECE89A`, field bindings for `dataset:Date.Date` and `dataset:Orders.Sales`, positioned at x=40, y=260 with width=800 and height=320.

All fields bind to the single `dataset` role. Use `Table.Column` for columns and `Table.Measure` for measures.

### Step 2: Write the Vega Spec

Create a Vega JSON spec file. In Vega, `data` is an **array** of named datasets:

```json
{
  "$schema": "https://vega.github.io/schema/vega/v5.json",
  "data": [{"name": "dataset"}],
  "width": {"signal": "pbiContainerWidth - 25"},
  "height": {"signal": "pbiContainerHeight - 27"},
  "padding": 5,
  "scales": [
    {"name": "x", "type": "band", "domain": {"data": "dataset", "field": "Date"}, "range": "width", "padding": 0.1},
    {"name": "y", "type": "linear", "domain": {"data": "dataset", "field": "Sales"}, "range": "height", "nice": true, "zero": true}
  ],
  "axes": [
    {"orient": "bottom", "scale": "x"},
    {"orient": "left", "scale": "y"}
  ],
  "marks": [
    {
      "type": "rect",
      "from": {"data": "dataset"},
      "encode": {
        "enter": {
          "x": {"scale": "x", "field": "Date"},
          "width": {"scale": "x", "band": 1},
          "y": {"scale": "y", "field": "Sales"},
          "y2": {"scale": "y", "value": 0}
        },
        "update": {"fill": {"signal": "pbiColor(0)"}},
        "hover": {"fill": {"signal": "pbiColor(0, -0.3)"}}
      }
    }
  ]
}
```

Field names in the spec must match the `nativeQueryRef` (display name) from the field bindings.

### Step 3: Inject the Spec

Set the spec and config in the visual's `objects.vega[0].properties` as single-quoted DAX literal strings. The `jsonSpec` property holds the Vega spec (stringified JSON), `jsonConfig` holds the config, and `provider` is set to `'vega'` or `'vegaLite'`. See the PBIR structure reference (`references/pbir-structure.md`) for the full encoding pattern.

### Step 4: Validate

Validate JSON syntax with `jq empty <visual.json>` and inspect the visual.json to confirm spec content and field bindings.

## Spec Authoring Rules

### Data Binding

- Vega: `"data": [{"name": "dataset"}]` (array form)
- Vega-Lite: `"data": {"name": "dataset"}` (object form)
- Fields reference display names. Special characters (`.`, `[`, `]`, `\`, `"`) become `_`
- Spaces are NOT replaced -- field names keep their spaces (e.g., `"Order Lines"`)

### Field Name Escaping in Expressions (Critical)

When referencing fields with spaces in Vega `formula` or Vega-Lite `calculate` expressions, **always use double quotes**, never single quotes:

```json
{"type": "formula", "as": "diff", "expr": "datum[\"Order Lines\"] - datum[\"Order Lines 1YP\"]"}
```

**Why:** Deneb stores the entire spec as a single-quoted JSON literal. Single quotes inside the spec break the expression parser. Double quotes resolve correctly.

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

1. **Use Vega** for all new visuals -- only Vega-Lite for editing existing Vega-Lite specs
2. **Always use `autosize: fit`** in config for responsive Power BI sizing
3. **Use `pbiContainerWidth`/`pbiContainerHeight`** signals for responsive Vega specs
4. **Use theme colors** (`pbiColor`, `pbiColorNominal`) instead of hex values
5. **Use `enter`/`update`/`hover`** encode blocks for clean state management
6. **Enable tooltips** with `"tooltip": {"signal": "datum"}` on marks
7. **Mind row limits** -- 10K default; set `dataLimit.override` and use `renderMode: canvas` for large datasets
8. **Test field names** -- verify `nativeQueryRef` matches spec field references
9. **Avoid external data** -- AppSource certification prevents loading external URLs
10. **Double quotes only** in expressions -- never single quotes (see escaping rules)

## References

- **`references/vega-patterns.md`** -- Vega chart patterns (bar, line, scatter, donut, stacked, heatmap, area, lollipop, bullet, KPI card), standard config, transforms and scales reference
- **`references/vega-lite-patterns.md`** -- Vega-Lite chart patterns (for editing existing Vega-Lite visuals only)
- **`references/pbir-structure.md`** -- PBIR JSON structure (literal encoding, query state, interactivity example)
- **`references/capabilities.md`** -- Full Deneb object properties reference and template format
- **`examples/deneb-bullet-chart-visual.json`** -- Complete PBIR visual.json from a real bullet chart report (Vega-Lite, with JSONC comments, conditional indicators, cross-filtering)
- **`examples/deneb-kpi-card-visual.json`** -- Complete PBIR visual.json for a KPI card (Vega-Lite, layered text with % change)
- **`examples/vega/`** -- Ready-to-inject Vega spec files (bar-chart, line-chart)
- **`examples/vega-lite/`** -- Ready-to-inject Vega-Lite spec files (bullet-chart, kpi-card)
- **`examples/standard-config.json`** -- Standard config for all Deneb specs

## Related Skills

- **`pbir-format`** (pbip plugin) -- PBIR JSON format reference
- **`pbi-report-design`** -- Layout and design best practices
- **`r-visuals`** -- R Script visuals (ggplot2)
- **`python-visuals`** -- Python Script visuals (matplotlib)
- **`svg-visuals`** -- SVG via DAX measures (lightweight inline graphics)
