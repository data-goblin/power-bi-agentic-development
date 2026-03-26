---
name: svg-visuals
description: "This skill should be used when the user asks to 'create an SVG visual', 'add a DAX sparkline', 'create an SVG measure', 'add inline graphics with DAX', 'create a progress bar in DAX', 'use SVG in Power BI', 'add a bullet chart via DAX', 'create a KPI indicator with SVG', 'add a data bar', 'create a dumbbell chart', 'add a status pill', 'create a lollipop chart', 'add overlapping bars', 'create a gauge in DAX', 'add a donut chart in DAX', 'create a boxplot in DAX', 'add an IBCS bar chart', 'create a jitter plot', 'add a box-and-whisker chart', or needs guidance on SVG generation via DAX measures, extension measures with ImageUrl data category, or inline visualization patterns in PBIR reports."
---

# SVG Visuals via DAX Measures (PBIR)

> **Report modification requires tooling.** Two paths exist:
> 1. **`pbir` CLI (preferred)** -- use the `pbir` command and the `pbir-cli` skill. Check availability with `pbir --version`.
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

## DAX SVG Fundamentals

### Basic Structure

```dax
SVG Measure =
VAR _Prefix = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg'>"
VAR _Content = "<rect x='0' y='0' width='50' height='10' fill='#2196F3'/>"
VAR _Suffix = "</svg>"
RETURN _Prefix & _Content & _Suffix
```

### Escaping and Color Rules

- **Prefer single quotes for SVG attributes** -- avoids DAX double-quote escaping entirely
- If double quotes needed in DAX strings: `""` (DAX escape convention)
- Use `viewBox` for responsive scaling: `viewBox='0 0 100 100'`
- `xmlns` attribute is required on `<svg>` element
- **Colors must be hex codes with `#`** -- e.g., `fill='#2196F3'`. Using `%23` URL encoding causes `VisualDataProxyExecutionUnknownError` in image visuals and is unreliable elsewhere. Never use named colors (`blue`, `red`).
- No JavaScript -- SVG must be purely declarative

### SVG Coordinate System

- Y=0 is at the **top** -- invert values for charts: `100 - [Y]`
- Use `viewBox` with 0-100 range for normalized coordinates
- Elements render in document order (first = back, last = front)

### Key Technique: CONCATENATEX for Series Data

```dax
VAR Lines = CONCATENATEX(
    SparklineTable,
    [X] & "," & (100 - [Y]),
    " ",
    [Date]
)
-- Builds: "0,80 10,60 20,40 30,20"
-- Use in: <polyline points='...'/>
```

## Best Practices

1. **Break SVG into VAR variables** -- one per element for maintainability
2. **Use `viewBox`** for responsive scaling instead of fixed dimensions
3. **Use HASONEVALUE guard** -- return BLANK() when not in single-category context
4. **Round coordinates** to 1-2 decimal places for performance
5. **Store as extension measures** -- SVG measures don't belong in a semantic model
6. **Use `display_folder`** to organize SVG measures together
7. **Preview first** -- save static SVG to `/tmp/`, open in browser, iterate before writing DAX
8. **Limit complexity** -- ~32K character limit per measure string
9. **Hex colors only** -- use `#` directly (e.g., `fill='#01B8AA'`), never `%23` URL encoding
10. **Image visuals need no `query` block** -- only `objects.image` with `sourceType='imageData'` and `sourceField`

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

## References

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
- **`dumbbell-chart-measure.dax`** -- Actual vs target dumbbell (from SpaceParts model)
- **`bullet-chart-measure.dax`** -- Bullet chart with sentiment action dots (from SpaceParts model)
- **`overlapping-bars-measure.dax`** -- Overlapping bars with variance label (from SpaceParts model)
- **`boxplot-measure.dax`** -- Box-and-whisker plot with quartiles and 1.5*IQR whiskers (inspired by DaxLib.SVG)
- **`ibcs-bar-measure.dax`** -- IBCS-compliant horizontal bar: AC solid vs PY outlined with delta (inspired by avatorl)
- **`jitter-plot-measure.dax`** -- Dot strip chart with pseudo-random vertical jitter (inspired by DaxLib.SVG)

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
