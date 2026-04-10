---
name: svg-visuals
version: 0.22.3
description: SVG generation via DAX measures and extension measures with ImageUrl data category for inline visualizations in PBIR reports. Automatically invoke when the user mentions "SVG visual", "DAX sparkline", "SVG measure", "inline graphics with DAX", "ImageUrl data category", "extension measure", or asks to create any DAX-generated chart (progress bars, bullet charts, KPI indicators, data bars, gauges, donut charts, lollipop charts, dumbbell charts, status pills, overlapping bars, boxplots, IBCS bars, jitter plots, box-and-whisker charts).
---

# SVG Visuals via DAX Measures (PBIR)

> **Report modification requires tooling.** Two paths exist:
> 1. **`pbir` CLI (preferred)** -- use the `pbir` command and the `pbir-cli` skill. Install with `uv tool install pbir-cli` or `pip install pbir-cli`. Check availability with `pbir --version`.
> 2. **Direct JSON modification** -- if `pbir` is not available, use the `pbir-format` skill (pbip plugin) for PBIR JSON structure and patterns. Validate every change with `jq empty <file.json>`.
>
> If neither the `pbir-cli` skill nor the `pbir-format` skill is loaded, ask the user to install the appropriate plugin before proceeding with report modifications.

Generate inline SVG graphics using DAX measures that return SVG markup strings. These render as images in table, matrix, card, image, and slicer visuals. Store as extension measures in `reportExtensions.json`.

## How It Works

1. A DAX measure returns an SVG string prefixed with `data:image/svg+xml;utf8,`
2. The measure's `dataCategory` is set to `ImageUrl`
3. Power BI renders the SVG as an image in supported visuals

## Supported Visuals

| Visual | visualType | Binding | Reference |
|--------|------------|---------|-----------|
| Table | `tableEx` | `grid.imageHeight` / `grid.imageWidth` | `references/svg-table-matrix.md` |
| Matrix | `pivotTable` | Same as table | `references/svg-table-matrix.md` |
| Image | `image` | `sourceType='imageData'` + `sourceField` | `references/svg-image-visual.md` |
| Card (New) | `cardVisual` | `callout.imageFX` | `references/svg-card-slicer.md` |
| Slicer (New) | `advancedSlicerVisual` | Header images | `references/svg-card-slicer.md` |

## Workflow: Creating an SVG Measure

### Step 0: Design and Preview

Before writing DAX, design the SVG visually:

1. **Query the model first** -- use DAX Studio or Tabular Editor CLI to get actual values with the intended filter context. Use real numbers, not placeholders.
2. **Write static SVG to a temp file** -- save to `/tmp/mockup.svg` and `open` it in a browser to preview layout, colors, and proportions.
3. **Ask for feedback** before converting to DAX -- iterating on static SVG is far easier than on DAX string concatenation.
4. **Colors must be hex codes with `#`** -- e.g., `fill='#2B7A78'`. Never use `%23` URL encoding or named colors. Always hex.

### Step 1: Create the Extension Measure

Create the extension measure in `reportExtensions.json` manually (see the `pbir-format` skill in the pbip plugin for JSON structure).

```python
# Example using pbir_object_model (if available):
report.add_extension_measure(
    table="Orders",
    name="Sparkline SVG",
    expression='''
        VAR _Prefix = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 30'>"
        VAR _Bar = "<rect x='0' y='0' width='50' height='30' fill='#2196F3'/>"
        VAR _Suffix = "</svg>"
        RETURN _Prefix & _Bar & _Suffix
    ''',
    data_type="Text",
    data_category="ImageUrl",
    display_folder="SVG Charts",
)
report.save()
```

### Step 1b: Review

Before presenting the measure to the user, dispatch the `svg-reviewer` agent to validate syntax and provide design feedback.

### Step 2: Bind to a Visual

Extension measures use `"Schema": "extension"` in the SourceRef:

```json
{
  "field": {
    "Measure": {
      "Expression": {
        "SourceRef": {"Schema": "extension", "Entity": "Orders"}
      },
      "Property": "Sparkline SVG"
    }
  }
}
```

For **image visuals**, set `sourceType='imageData'` with `sourceField` in the visual.json (see `references/svg-image-visual.md`).

### Step 3: Validate

Validate JSON syntax with `jq empty <reportExtensions.json>` and inspect the file to confirm measure definitions and data categories.

## Prefer UDF Libraries Over Custom DAX

Before writing a custom SVG measure from scratch, check whether an existing UDF library already provides the chart type:

- **PowerofBI.IBCS** (Andrzej Leszkiewicz) -- IBCS-compliant bar, column, waterfall, pin, small multiples, and P&L charts. Preferred for business reporting with AC/PY/BU/FC comparisons. Install from https://daxlib.org/package/PowerofBI.IBCS/
- **DaxLib.SVG** (Jake Duddy) -- general-purpose sparklines, bars, boxplots, heatmaps, jitter, violin, progress bars, pills. Install from https://daxlib.org/package/DaxLib.SVG/ -- source at https://github.com/daxlib/dev-daxlib-svg
- **PowerBI MacGuyver Toolbox** (Stepan Resl / Data Goblins) -- C# scripts that generate SVG measures via Tabular Editor

To check if a library is installed, look for functions/measures starting with `PowerofBI.IBCS.`, `Viz.`, `Compound.`, or `Element.`. Only write custom SVG DAX when no library function covers the required visualization. See `references/community-examples.md` for full function listings and additional libraries.

### Installing UDF libraries

UDF libraries are installed into the semantic model, not the report. Use one of these tools:

- **Tabular Editor CLI** (`te` command) -- use the `te-docs` skill for guidance
- **Power BI MCP server** -- if available, use it to modify the model directly
- **`connect-pbid` skill** -- connect to Power BI Desktop's local Analysis Services instance via TOM/PowerShell
- **`tmdl` skill** -- edit TMDL files directly in a PBIP project (last resort)

## DAX SVG Conventions

### Measure Structure (VAR Pattern)

Every SVG measure must follow a strict VAR-based structure. Organize code into clearly separated regions:

```dax
SVG Measure =
-- CONFIG: Input fields and visual parameters
VAR _Actual = [Sales Amount]
VAR _Target = [Sales Target]
VAR _Scope = ALLSELECTED ( 'Product'[Category] )

-- CONFIG: Colors
VAR _BarColor = "#5B8DBE"
VAR _TargetColor = "#333333"

-- NORMALIZATION: Scale values to SVG coordinate space
VAR _AxisMax = CALCULATE( MAXX( _Scope, [Sales Amount] ), REMOVEFILTERS( 'Product'[Category] ) ) * 1.1
VAR _AxisRange = 100
VAR _ActualNormalized = DIVIDE( _Actual, _AxisMax ) * _AxisRange

-- SVG ELEMENTS: One VAR per visual element
VAR _SvgPrefix = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 25'>"
VAR _Sort = "<desc>" & FORMAT( _Actual, "000000000000" ) & "</desc>"
VAR _Bar = "<rect x='0' y='5' width='" & _ActualNormalized & "' height='15' fill='" & _BarColor & "'/>"
VAR _TargetLine = "<rect x='" & DIVIDE( _Target, _AxisMax ) * _AxisRange & "' y='2' width='2' height='21' fill='" & _TargetColor & "'/>"
VAR _SvgSuffix = "</svg>"

-- ASSEMBLY: Combine in rendering order (back to front)
VAR _SVG = _SvgPrefix & _Sort & _Bar & _TargetLine & _SvgSuffix

RETURN _SVG
```

Key conventions:
- **CONFIG section first** -- input measures, scope column, colors, font settings. Users change only this section.
- **NORMALIZATION section** -- scale raw values to SVG coordinate space (see below)
- **SVG ELEMENTS** -- one VAR per `<rect>`, `<circle>`, `<text>`, `<line>`, etc.
- **ASSEMBLY** -- concatenate elements in document order (first = back layer, last = front)
- **`<desc>` sort trick** -- embed `FORMAT(_Actual, "000000000000")` in a `<desc>` tag so the table/matrix can sort by the SVG column

### Axis Normalization (Critical)

SVG coordinates must be normalized to a fixed range. Raw measure values (e.g., 1,234,567) cannot be used directly as pixel coordinates. The standard pattern:

```dax
-- 1. Define the SVG coordinate range
VAR _BarMin = 0       -- leftmost position (or offset for labels)
VAR _BarMax = 100     -- rightmost position

-- 2. Find the maximum value across all rows in the visual's filter context
VAR _Scope = ALLSELECTED( 'Table'[GroupColumn] )
VAR _MaxInScope = CALCULATE( MAXX( _Scope, [Measure] ), REMOVEFILTERS( 'Table'[GroupColumn] ) )
VAR _AxisMax = _MaxInScope * 1.1   -- 10% padding

-- 3. Normalize each value to the SVG range
VAR _AxisRange = _BarMax - _BarMin
VAR _Normalized = DIVIDE( _Actual, _AxisMax ) * _AxisRange
```

Use `ALLSELECTED` for the scope when the chart should respond to slicer context. Use `ALL` for a fixed axis across all filter contexts. The `* 1.1` padding prevents bars from touching the edge.

### HASONEVALUE Guard

Table/matrix SVG measures must guard against subtotal/total rows where multiple categories are in scope:

```dax
IF( HASONEVALUE( 'Table'[GroupColumn] ),
    -- SVG code here
)
```

Without this guard, the measure evaluates on grand total rows with meaningless aggregated values.

### Escaping and Color Rules

- **Single quotes for SVG attributes** -- avoids DAX double-quote escaping: `fill='#2196F3'`
- **Double quotes in DAX**: escape as `""` (DAX convention)
- **`viewBox`** for responsive scaling: `viewBox='0 0 100 25'`
- **`xmlns`** required on `<svg>` element
- **Hex colors with `#` only** -- e.g., `fill='#2196F3'`. `%23` URL encoding causes errors in image visuals. Never use named colors.
- **No JavaScript** -- SVG must be purely declarative

### SVG Coordinate System

- Y=0 is at the **top** -- invert values for charts: `_Height - _Value`
- Use `viewBox` with a 0-100 range for normalized coordinates
- Elements render in document order (first = back, last = front)

### CONCATENATEX for Series Data

For sparklines and multi-point charts, build coordinate strings with CONCATENATEX:

```dax
VAR _Points = CONCATENATEX(
    _SparklineTable,
    [X] & "," & (100 - [Y]),
    " ",
    [Date], ASC
)
-- Produces: "0,80 10,60 20,40 30,20"
-- Use in: <polyline points='...'/>
```

## Best Practices

1. **Check UDF libraries first** -- use DaxLib.SVG or MacGuyver Toolbox functions before writing custom DAX
2. **VAR pattern mandatory** -- one VAR per config value, one VAR per SVG element, assembly at the end
3. **Normalize all values** -- raw measure values must be scaled to SVG coordinate range
4. **HASONEVALUE guard** -- always guard against total/subtotal rows in table/matrix context
5. **`<desc>` sort trick** -- embed formatted value in `<desc>` for sortable SVG columns
6. **Use `viewBox`** for responsive scaling instead of fixed width/height
7. **Round coordinates** to 1-2 decimal places for performance
8. **Store as extension measures** -- SVG measures don't belong in the semantic model
9. **Use `display_folder`** to organize SVG measures together (e.g., `"SVG Charts"`)
10. **Preview first** -- save static SVG to `/tmp/`, open in browser, iterate before writing DAX
11. **Limit complexity** -- ~32K character limit on rendered SVG string (not DAX expression)
12. **Hex colors only** -- `#` directly, never `%23` URL encoding
13. **Image visuals need no `query` block** -- only `objects.image` with `sourceType='imageData'` and `sourceField`

## reportExtensions.json Format

```json
{
  "$schema": "https://developer.microsoft.com/json-schemas/fabric/item/report/definition/reportExtension/1.0.0/schema.json",
  "name": "extension",
  "entities": [{
    "name": "ExistingTable",
    "measures": [{
      "name": "Sparkline SVG",
      "dataType": "Text",
      "dataCategory": "ImageUrl",
      "expression": "...",
      "displayFolder": "SVG Charts"
    }]
  }]
}
```

## Limitations

- **No interactivity** -- SVG images are static (no hover, click, tooltip)
- **No JavaScript** -- inline scripts are stripped
- **32K character limit** -- on the rendered SVG string, not the DAX expression. CONCATENATEX over 30+ rows easily exceeds this. Prefer polylines over individual dots, integer coordinates over decimals. Split complex designs into multiple simpler measures or use Deneb instead.
- **Performance** -- complex SVG with many elements impacts rendering
- **Classic card** does NOT support SVG -- use `cardVisual` instead

## When to Use SVG Measures

SVG measures are the preferred choice for **simple inline graphics** embedded in tables, matrices, cards, and image visuals. Use SVG when you need:

- Sparklines, data bars, progress bars, or status indicators inside table/matrix cells
- KPI micro-charts in card visuals
- Lightweight visuals that don't require interactivity or complex data transforms
- No additional custom visual registration (works with native visuals)

**Use Deneb instead** for complex, interactive visualizations (cross-filtering, tooltips, hover states) or chart types that require extensive data transforms. **Use Python/R instead** for statistical analysis charts (distributions, regressions, correlations).

## References

### Community Examples and Libraries

- **`references/community-examples.md`** -- Community SVG templates organized by target visual type (Table/Matrix, Image, Card), including DaxLib.SVG functions, Kerry Kolosko templates, and PowerBI MacGuyver Toolbox patterns

### By Visual Type

- **`references/svg-table-matrix.md`** -- Patterns for Table/Matrix: data bar, bullet chart, dumbbell, overlapping bars, lollipop, status pill, sparkline, bar sparkline, area sparkline, UDF patterns. Includes axis normalization, sort trick, and image size configuration.
- **`references/svg-image-visual.md`** -- Patterns for Image visuals: KPI header, sparkline with endpoint, dashboard tile. Covers sourceType, Python API, and design considerations.
- **`references/svg-card-slicer.md`** -- Patterns for Card/Slicer: arrow indicator, mini gauge, mini donut, progress bar. Card binding via `callout.imageFX`.

### General

- **`references/svg-elements.md`** -- SVG element reference (rect, circle, line, polyline, text, path, gradient, group)

### Examples

Ready-to-use DAX measure expressions in `examples/`:
- **`sparkline-measure.dax`** -- Line sparkline (polyline + CONCATENATEX)
- **`progress-bar-measure.dax`** -- Conditional progress bar
- **`dumbbell-chart-measure.dax`** -- Actual vs target dumbbell
- **`bullet-chart-measure.dax`** -- Bullet chart with sentiment action dots
- **`overlapping-bars-measure.dax`** -- Overlapping bars with variance label
- **`boxplot-measure.dax`** -- Box-and-whisker plot (inspired by DaxLib.SVG)
- **`ibcs-bar-measure.dax`** -- IBCS-compliant horizontal bar (inspired by avatorl)
- **`jitter-plot-measure.dax`** -- Dot strip chart with jitter (inspired by DaxLib.SVG)
- **`overlapping-bars-with-variance-measure.dax`** -- Overlapping bars with variance bar + arrow icon + % label (Kurt Buhler / Data Goblins)
- **`lollipop-conditional-measure.dax`** -- Lollipop with scaled dot + auto-formatted label (Kurt Buhler / Data Goblins)
- **`waterfall-measure.dax`** -- Waterfall with cumulative OFFSET positioning + connector lines (Kurt Buhler / Data Goblins)
- **`status-pill-measure.dax`** -- Rounded pill badge with category color + text label (Kurt Buhler / Data Goblins)

## Helper Libraries

| Library | Author | Key Features |
|---------|--------|--------------|
| DaxLib.SVG | Jake Duddy | UDF library: area, line, boxplot, heatmap, jitter, violin |
| PBI-Core-Visuals-SVG-HTML | David Bacci | Chips, tornado, gradient matrix, bar UDF |
| PowerBI MacGuyver Toolbox | Stepan Resl / Data Goblins | 20+ bar, 14+ line, 24+ KPI templates |
| Dashboard Design UDF Library | Dashboard-Design | Target line bars, pill visuals |
| Kerry Kolosko Templates | Kerry Kolosko | Sparklines, data bars, KPI cards |

## Related Skills

- **`pbi-report-design`** -- Layout and design best practices
- **`deneb-visuals`** -- Vega/Vega-Lite for complex interactive visualizations
- **`python-visuals`** -- matplotlib/seaborn for statistical charts
- **`r-visuals`** -- ggplot2 for statistical charts
- **`pbir-format`** (pbip plugin) -- PBIR JSON format reference (extension measures, ImageUrl binding)
