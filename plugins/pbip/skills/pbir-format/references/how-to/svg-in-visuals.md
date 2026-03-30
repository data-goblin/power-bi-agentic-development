# SVG Graphics in Power BI Visuals

You can embed custom SVG graphics in Power BI visuals using DAX measures that generate SVG code. This enables inline visualizations like sparklines, bullet charts, progress bars, custom indicators, and complex KPI displays.

## Supported Visuals

SVG images (with `dataCategory: ImageUrl`) work in:

- **Table** (tableEx) - Column values with `grid.imageHeight` and `grid.imageWidth` properties
- **Matrix** (pivotTable) - Same as table with adjustable image sizing
- **Card (New)** (cardVisual) - Image callouts with dynamic SVG content
- **Slicer (New)** (advancedSlicerVisual) - Header images and custom slicer items
- **Scatter Chart** - Background images with SVG overlays
- **Image visual** - Direct SVG display

**Note:** Classic card visual (card) does NOT support SVG images directly. Use the new card visual (cardVisual) instead.

---

## Overview

**How it works:**

1. Create a DAX measure that returns SVG markup as a string
2. Set the measure's `dataCategory` to `ImageUrl` in the semantic model
3. Add the measure to a supported visual type
4. Configure visual-specific image properties (size, positioning, etc.)

---

## Creating an SVG Measure

### Basic Structure

```dax
SVG Measure =
VAR _SvgPrefix = "data:image/svg+xml;utf8,<svg xmlns=""http://www.w3.org/2000/svg"">"
VAR _SvgContent = "<rect x=""0"" y=""0"" width=""50"" height=""10"" fill=""blue""/>"
VAR _SvgSuffix = "</svg>"
RETURN
    _SvgPrefix & _SvgContent & _SvgSuffix
```

**Key components:**

- `data:image/svg+xml;utf8,` - Data URI scheme prefix (required)
- `<svg xmlns="http://www.w3.org/2000/svg">` - SVG container with namespace (required)
- SVG content (rectangles, circles, paths, text, etc.)
- `</svg>` - Closing tag (required)

**Critical:** Use double quotes (`""`) to escape quotes in DAX strings.

### Setting Data Category

**In TMDL (semantic model definition):**

```tmdl
measure 'Bullet Chart SVG' = ```
    -- DAX code here
    ```
    dataCategory: ImageUrl
    formatString: "General"
```

**In Power BI Desktop:**

1. Select the measure
2. Click **Measure tools** ribbon
3. Choose **Image URL** from **Data category** dropdown

**Without `dataCategory: ImageUrl`**, visuals will display the raw SVG string instead of rendering it.

---

## Usage by Visual Type

### Tables and Matrix

**Configuration in visual.json:**

```json
{
  "query": {
    "queryState": {
      "Values": {
        "projections": [
          {
            "field": {
              "Measure": {
                "Expression": {"SourceRef": {"Entity": "SVG Measures"}},
                "Property": "Bullet Chart SVG"
              }
            },
            "queryRef": "Sales.Bullet Chart SVG"
          }
        ]
      }
    }
  },
  "objects": {
    "grid": [
      {
        "properties": {
          "imageHeight": {"expr": {"Literal": {"Value": "20D"}}},
          "imageWidth": {"expr": {"Literal": {"Value": "100D"}}}
        }
      }
    ]
  }
}
```

**Key properties:**
- `grid.imageHeight` - Image height in pixels (e.g., `20D`)
- `grid.imageWidth` - Image width in pixels (e.g., `100D`)

### Card (New) Visual

The new card visual (cardVisual) supports SVG images in callout values.

**Configuration in visual.json:**

```json
{
  "visual": {
    "visualType": "cardVisual",
    "query": {
      "queryState": {
        "Values": {
          "projections": [
            {
              "field": {
                "Measure": {
                  "Expression": {"SourceRef": {"Entity": "SVG Measures"}},
                  "Property": "KPI Sparkline SVG"
                }
              }
            }
          ]
        }
      }
    },
    "objects": {
      "callout": [
        {
          "properties": {
            "imageType": {"expr": {"Literal": {"Value": "'ImageURL'"}}},
            "imageFX": {
              "expr": {
                "Measure": {
                  "Expression": {"SourceRef": {"Entity": "SVG Measures"}},
                  "Property": "KPI Sparkline SVG"
                }
              }
            }
          }
        }
      ]
    }
  }
}
```

**Common use cases:**
- Sparklines showing trend
- Progress/gauge indicators
- Bullet charts
- Status icons
- Mini donut/bar charts

**Known Issues (as of March 2025):**
- SVG images may not render immediately after adding
- **Workaround 1:** Save file, close, and reopen
- **Workaround 2:** Add a Categories field (even with single category), disable small multiples
- **Status:** Resolved by Microsoft in recent updates

**See:** [visual.json](../visual-json.md) for visual structure reference

### Slicer (New) Visual

The new slicer visual (advancedSlicerVisual) supports SVG in headers and items.

**Configuration in visual.json:**

```json
{
  "visual": {
    "visualType": "advancedSlicerVisual",
    "objects": {
      "general": [
        {
          "properties": {
            "showHeader": {"expr": {"Literal": {"Value": "true"}}},
            "headerImageUrl": {
              "expr": {
                "Measure": {
                  "Expression": {"SourceRef": {"Entity": "SVG Measures"}},
                  "Property": "Slicer Icon SVG"
                }
              }
            }
          }
        }
      ]
    }
  }
}
```

> **Note:** The property names `showHeader` and `headerImageUrl` shown above have not been verified against a live Power BI Desktop export of an SVG-configured slicer. If these properties produce no effect, export the slicer from Power BI Desktop as PBIP and check the actual `objects.general.properties` keys in the resulting `visual.json`.

**Common use cases:**
- Custom filter icons
- Category indicators
- Interactive buttons with SVG styling

**See:** [visual.json](../visual-json.md) for visual structure reference

### Scatter Chart Background

Scatter charts support SVG images as background overlays.

**Configuration:**
- Add measure to scatter chart's background image property
- Use `plotArea.image` property in visual configuration
- SVG scales to plot area dimensions

**See:** [visual.json](../visual-json.md) for visual structure reference

---

## Complete Examples

### Example 1: Bullet Chart (Table/Matrix)

From the SQLBIBulletChart sample report:

```dax
Bullet Chart SVG =

-- SVG configuration
VAR _Actual = [Sales Amount]
VAR _Target = [Sales Amount (PY)]
VAR _Performance = [Sales Amount vs. PY (%)]

VAR _BarMax = 75
VAR _Scope = ALL ( 'Product'[Category] )
VAR _MaxActualsInScope =
    CALCULATE(
        MAXX(_Scope, [Sales Amount]),
        REMOVEFILTERS( 'Product'[Category], 'Product'[Category Code] )
    )

VAR _MaxTargetInScope =
    CALCULATE(
        MAXX(_Scope, [Sales Amount (PY)]),
        REMOVEFILTERS( 'Product'[Category], 'Product'[Category Code] )
    )

VAR _Max =
    IF (
        HASONEVALUE ( 'Product'[Category] ),
        MAX( _MaxActualsInScope, _MaxTargetInScope ),
        CALCULATE( MAX( [Sales Amount], [Sales Amount (PY)] ), REMOVEFILTERS( 'Product' ) )
    ) * 1.1

VAR _ActualNormalized = ( DIVIDE ( [Sales Amount], _Max ) * _BarMax )
VAR _TargetNormalized = ( DIVIDE ( [Sales Amount (PY)], _Max ) * _BarMax ) + 19

-- Conditional formatting configuration
VAR _BarFillColor  = "#CFCFCF"
VAR _BaselineColor = "#737373"
VAR _ActionDotFill =
    SWITCH (
        TRUE(),
        _Performance < -0.5, "#f4ae4c",
        _Performance < -0.25, "#ffe075",
        _Performance > 0.25, "#74B2FF",
        _Performance > 0.5, "#2D6390",
        "#FFFFFF00"  // Transparent if within range
    )

-- Vectors and SVG code
VAR _SvgPrefix = "data:image/svg+xml;utf8,<svg xmlns=""http://www.w3.org/2000/svg"">"
VAR _ActionDot  = "<circle cx=""10"" cy=""10"" r=""5"" fill=""" & _ActionDotFill &"""/>"
VAR _ActualBar  = "<rect x=""20"" y=""5"" width=""" & _ActualNormalized & """ height=""50%"" fill=""" & _BarFillColor & """/>"
VAR _BarBaseline = "<rect x=""20"" y=""4"" width=""1"" height=""60%"" fill=""#5E5E5E""/>"
VAR _BarBackground = "<rect x=""20"" y=""2"" width=""" & _BarMax & """ height=""80%"" fill=""#F5F5F5""/>"
VAR _TargetLine = "<rect x=""" & _TargetNormalized & """ y=""2"" width=""1.5"" height=""80%"" fill=""black""/>"
VAR _SvgSuffix = "</svg>"

-- Final result
VAR _SVG = _SvgPrefix & _ActionDot & _BarBackground & _ActualBar & _BarBaseline & _TargetLine & _SvgSuffix
RETURN
    _SVG
```

**Pattern breakdown:**
1. **Calculate data values** - Get actual, target, and performance metrics
2. **Normalize to pixel coordinates** - Scale values to fit SVG canvas
3. **Apply conditional logic** - Determine colors based on performance
4. **Build SVG elements** - Create shapes (circles, rectangles) with calculated positions
5. **Concatenate and return** - Combine prefix, elements, and suffix

### Example 2: Sparkline (Card Visual)

```dax
KPI Sparkline SVG =
VAR _Values =
    ADDCOLUMNS(
        CALCULATETABLE(
            VALUES('Date'[Month]),
            DATESINPERIOD('Date'[Date], MAX('Date'[Date]), -12, MONTH)
        ),
        "@Value", [Sales Amount]
    )

VAR _Count = COUNTROWS(_Values)
VAR _MaxValue = MAXX(_Values, [@Value])
VAR _MinValue = MINX(_Values, [@Value])
VAR _Range = _MaxValue - _MinValue

VAR _Width = 100
VAR _Height = 30
VAR _BarWidth = _Width / _Count
VAR _Scale = _Height / _Range

VAR _SvgPrefix = "data:image/svg+xml;utf8,<svg xmlns=""http://www.w3.org/2000/svg"" viewBox=""0 0 " & _Width & " " & _Height & """>"

VAR _Bars =
    CONCATENATEX(
        ADDCOLUMNS(
            _Values,
            "@Index", RANKX(_Values, 'Date'[Month], , ASC)
        ),
        VAR _X = ([@Index] - 1) * _BarWidth
        VAR _BarHeight = ([@Value] - _MinValue) * _Scale
        VAR _Y = _Height - _BarHeight
        RETURN
            "<rect x=""" & _X & """ " &
            "y=""" & _Y & """ " &
            "width=""" & (_BarWidth * 0.8) & """ " &
            "height=""" & _BarHeight & """ " &
            "fill=""#2196F3"" " &
            "opacity=""0.7""/>",
        "",
        [@Index],
        ASC
    )

VAR _SvgSuffix = "</svg>"

RETURN
    _SvgPrefix & _Bars & _SvgSuffix
```

### Example 3: Gauge Indicator (Card Visual)

```dax
KPI Gauge SVG =
VAR _Value = [Sales Amount]
VAR _Target = [Sales Amount Target]
VAR _Percentage = DIVIDE(_Value, _Target, 0)
VAR _Angle = (_Percentage * 180) - 90  // -90 to 90 degrees

VAR _Radius = 40
VAR _CenterX = 50
VAR _CenterY = 50

-- Calculate needle endpoint
VAR _NeedleLength = _Radius * 0.8
VAR _AngleRad = _Angle * PI() / 180
VAR _NeedleX = _CenterX + (_NeedleLength * COS(_AngleRad))
VAR _NeedleY = _CenterY + (_NeedleLength * SIN(_AngleRad))

-- Color based on performance
VAR _ArcColor =
    SWITCH(
        TRUE(),
        _Percentage < 0.5, "#F44336",
        _Percentage < 0.8, "#FF9800",
        "#4CAF50"
    )

VAR _SvgPrefix = "data:image/svg+xml;utf8,<svg xmlns=""http://www.w3.org/2000/svg"" viewBox=""0 0 100 60"">"

-- Background arc (180 degrees)
VAR _BackgroundArc =
    "<path d=""M 10 50 A 40 40 0 0 1 90 50"" " &
    "fill=""none"" stroke=""#E0E0E0"" stroke-width=""8""/>"

-- Value arc
VAR _ValueArc =
    "<path d=""M 10 50 A 40 40 0 0 1 " & _NeedleX & " " & _NeedleY & """ " &
    "fill=""none"" stroke=""" & _ArcColor & """ stroke-width=""8""/>"

-- Needle
VAR _Needle =
    "<line x1=""" & _CenterX & """ y1=""" & _CenterY & """ " &
    "x2=""" & _NeedleX & """ y2=""" & _NeedleY & """ " &
    "stroke=""#333"" stroke-width=""2""/>"

-- Center dot
VAR _CenterDot =
    "<circle cx=""" & _CenterX & """ cy=""" & _CenterY & """ r=""3"" fill=""#333""/>"

VAR _SvgSuffix = "</svg>"

RETURN
    _SvgPrefix & _BackgroundArc & _ValueArc & _Needle & _CenterDot & _SvgSuffix
```

### Example 4: Progress Bar with Label (Card Visual)

```dax
Progress Bar SVG =
VAR _Value = [Completion Percentage]  // 0-1 value
VAR _BarWidth = 100
VAR _BarHeight = 20
VAR _FillWidth = _Value * _BarWidth
VAR _LabelText = FORMAT(_Value, "0%")

VAR _FillColor =
    SWITCH(
        TRUE(),
        _Value < 0.5, "#F44336",
        _Value < 0.8, "#FF9800",
        "#4CAF50"
    )

VAR _SvgPrefix = "data:image/svg+xml;utf8,<svg xmlns=""http://www.w3.org/2000/svg"" viewBox=""0 0 " & _BarWidth & " " & (_BarHeight + 10) & """>"

VAR _Background =
    "<rect x=""0"" y=""0"" " &
    "width=""" & _BarWidth & """ " &
    "height=""" & _BarHeight & """ " &
    "fill=""#E0E0E0"" rx=""" & (_BarHeight / 2) & """/>"

VAR _Fill =
    "<rect x=""0"" y=""0"" " &
    "width=""" & _FillWidth & """ " &
    "height=""" & _BarHeight & """ " &
    "fill=""" & _FillColor & """ rx=""" & (_BarHeight / 2) & """/>"

VAR _Label =
    "<text x=""" & (_BarWidth / 2) & """ " &
    "y=""" & (_BarHeight / 2 + 5) & """ " &
    "font-size=""12"" " &
    "text-anchor=""middle"" " &
    "fill=""white"" " &
    "font-weight=""bold"">" & _LabelText & "</text>"

VAR _SvgSuffix = "</svg>"

RETURN
    _SvgPrefix & _Background & _Fill & _Label & _SvgSuffix
```

---

## SVG Elements Reference

### Rectangle

```dax
VAR _Rect = "<rect x=""10"" y=""5"" width=""50"" height=""10"" fill=""blue"" rx=""2""/>"
```

**Attributes:**
- `x`, `y` - Top-left corner position
- `width`, `height` - Dimensions (can use pixels or percentages)
- `fill` - Fill color (hex, named color, or transparent with `#FFFFFF00`)
- `stroke` - Border color
- `stroke-width` - Border width
- `opacity` - Transparency (0-1)
- `rx`, `ry` - Corner radius for rounded rectangles

### Circle

```dax
VAR _Circle = "<circle cx=""50"" cy=""10"" r=""5"" fill=""red""/>"
```

**Attributes:**
- `cx`, `cy` - Center coordinates
- `r` - Radius
- `fill` - Fill color
- `stroke` - Border color
- `opacity` - Transparency

### Line

```dax
VAR _Line = "<line x1=""0"" y1=""10"" x2=""100"" y2=""10"" stroke=""black"" stroke-width=""2""/>"
```

**Attributes:**
- `x1`, `y1` - Start point
- `x2`, `y2` - End point
- `stroke` - Line color (required for lines)
- `stroke-width` - Line thickness
- `stroke-dasharray` - Dashed line pattern (e.g., `"5,5"`)

### Text

```dax
VAR _Text = "<text x=""50"" y=""10"" font-size=""12"" fill=""black"" font-weight=""bold"">Label</text>"
```

**Attributes:**
- `x`, `y` - Position (baseline for y)
- `font-size` - Text size
- `fill` - Text color
- `text-anchor` - Alignment (start, middle, end)
- `font-weight` - bold, normal
- `font-family` - Font name

### Path

For complex shapes (arcs, curves):

```dax
VAR _Path = "<path d=""M 10,10 L 50,10 L 30,30 Z"" fill=""green""/>"
```

**Path commands:**
- `M x,y` - Move to
- `L x,y` - Line to
- `A rx,ry rotation large-arc-flag sweep-flag x,y` - Arc
- `Z` - Close path

### Group (g)

Group elements for applying transforms:

```dax
VAR _Group = "<g transform=""translate(10,10)"">" & _Shape1 & _Shape2 & "</g>"
```

---

## Common Patterns

### Status Indicator

```dax
Status Indicator SVG =
VAR _Status = [Status]  // "Good", "Warning", "Bad"
VAR _Color =
    SWITCH(
        _Status,
        "Good", "#4CAF50",
        "Warning", "#FF9800",
        "Bad", "#F44336",
        "#CCCCCC"
    )

VAR _SvgPrefix = "data:image/svg+xml;utf8,<svg xmlns=""http://www.w3.org/2000/svg"">"
VAR _Circle = "<circle cx=""10"" cy=""10"" r=""8"" fill=""" & _Color & """/>"
VAR _SvgSuffix = "</svg>"

RETURN
    _SvgPrefix & _Circle & _SvgSuffix
```

### Donut Chart (Mini)

```dax
Mini Donut SVG =
VAR _Percentage = [Percentage]
VAR _Angle = _Percentage * 360
VAR _LargeArc = IF(_Angle > 180, 1, 0)

VAR _Radius = 40
VAR _Thickness = 8
VAR _CenterX = 50
VAR _CenterY = 50

-- Calculate arc endpoint
VAR _AngleRad = (_Angle - 90) * PI() / 180
VAR _EndX = _CenterX + (_Radius * COS(_AngleRad))
VAR _EndY = _CenterY + (_Radius * SIN(_AngleRad))

VAR _SvgPrefix = "data:image/svg+xml;utf8,<svg xmlns=""http://www.w3.org/2000/svg"" viewBox=""0 0 100 100"">"

VAR _BackgroundCircle =
    "<circle cx=""" & _CenterX & """ cy=""" & _CenterY & """ " &
    "r=""" & _Radius & """ " &
    "fill=""none"" stroke=""#E0E0E0"" stroke-width=""" & _Thickness & """/>"

VAR _ValueArc =
    "<path d=""M " & _CenterX & " " & (_CenterY - _Radius) & " " &
    "A " & _Radius & " " & _Radius & " 0 " & _LargeArc & " 1 " & _EndX & " " & _EndY & """ " &
    "fill=""none"" stroke=""#2196F3"" stroke-width=""" & _Thickness & """/>"

VAR _SvgSuffix = "</svg>"

RETURN
    _SvgPrefix & _BackgroundCircle & _ValueArc & _SvgSuffix
```

### Arrow Indicator (Up/Down)

```dax
Arrow Indicator SVG =
VAR _Growth = [Growth %]
VAR _IsPositive = _Growth >= 0

VAR _ArrowPath =
    IF(
        _IsPositive,
        "M 10,15 L 5,10 L 15,10 Z",  // Up arrow
        "M 10,5 L 5,10 L 15,10 Z"    // Down arrow
    )

VAR _Color = IF(_IsPositive, "#4CAF50", "#F44336")

VAR _SvgPrefix = "data:image/svg+xml;utf8,<svg xmlns=""http://www.w3.org/2000/svg"" viewBox=""0 0 20 20"">"
VAR _Arrow = "<path d=""" & _ArrowPath & """ fill=""" & _Color & """/>"
VAR _SvgSuffix = "</svg>"

RETURN
    _SvgPrefix & _Arrow & _SvgSuffix
```

---

## Design Workflow

### Using Design Tools

**Recommended approach:**

1. **Design in Figma/Inkscape/Illustrator**
   - Create visual mockup
   - Export as SVG
   - Copy SVG code

2. **Convert to DAX**
   - Replace static values with variables
   - Add conditional logic for colors/sizes
   - Add data URI prefix
   - Escape quotes (`"` → `""`)

3. **Test and refine**
   - Validate in Power BI
   - Adjust coordinates/sizing
   - Optimize for performance

**Using ChatGPT/Claude:**
- Describe desired visual
- Request SVG code
- Copy into DAX measure
- Add dynamic logic

### Templates and Resources

**Community SVG templates:**
- Kerry Kolosko - Extensive KPI card templates
- Andrzej Leszkiewicz - Creative visualizations
- Štěpán Rešl - Business-focused designs
- David Bacci - Advanced techniques

**SQLBI techniques:**
- Building custom data bars
- SVG-based conditional formatting
- Performance optimization patterns

---

## Best Practices

1. **Normalize Values**: Scale data values to fit pixel coordinates (0-100 range is common)
2. **Use viewBox**: Set viewBox attribute for responsive scaling (e.g., `viewBox="0 0 100 100"`)
3. **Layer Thoughtfully**: SVG renders elements in order (first = back, last = front)
4. **Test Colors**: Ensure sufficient contrast for readability
5. **Escape Quotes**: Always use `""` for quotes inside DAX strings
6. **Consider Performance**: Complex SVG can impact rendering speed; test with large datasets
7. **Use Percentages for Dimensions**: For height/width in shapes, percentages adapt to container (e.g., `height="50%"`)
8. **Cache Complex Calculations**: Store expensive calculations in variables
9. **Validate SVG Syntax**: Test generated SVG in external viewer before deploying
10. **Document Annotations**: Use measure annotations to store SVG code (see examples/)

---

## Annotations for SVG Measures

Store SVG DAX code in measure annotations for documentation:

**In TMDL:**

```tmdl
measure 'KPI Sparkline SVG' = ```
    -- DAX code here
    ```
    dataCategory: ImageUrl

    annotation svg_dax_code = ```
        VAR _SvgPrefix = "data:image/svg+xml;utf8,<svg..."
        -- Full DAX code for reference
        ```
```

**Benefits:**
- Code backup in report metadata
- Easy extraction for reuse
- Documentation for other developers

**See:** `examples/visuals/cardVisual/` for examples with annotations

---

## Debugging

### SVG Not Rendering

**Check:**
1. Measure has `dataCategory: ImageUrl` in semantic model
2. SVG string starts with `data:image/svg+xml;utf8,` (with comma)
3. SVG namespace is included: `xmlns="http://www.w3.org/2000/svg"`
4. All quotes are properly escaped (`""`)
5. Visual-specific properties are configured (imageHeight, imageWidth, etc.)
6. For card visual: Ensure `callout.imageType` is set to `'ImageURL'`

### Display Raw String

**Cause:** Missing `dataCategory: ImageUrl` in measure definition

**Fix:**
```tmdl
measure 'SVG Measure' = ```
    -- DAX here
    ```
    dataCategory: ImageUrl
```

### SVG Appears Blank

**Check:**
1. Coordinates are within bounds (x/y not negative or exceeding canvas size)
2. Colors are valid (hex codes with `#`, named colors)
3. Width/height values are positive
4. fill/stroke colors aren't fully transparent when not intended (`#FFFFFF00` is transparent white)
5. Text elements have visible fill color
6. viewBox matches content coordinates

### Card Visual SVG Issues (March 2025)

**Symptoms:**
- SVG doesn't render after adding
- Blank image placeholder

**Workarounds:**
1. Save file, close Power BI Desktop, reopen
2. Add a Categories field to the card, disable small multiples
3. Update to latest Power BI Desktop version

**Status:** Resolved in recent updates

### Validation

Test SVG output directly:

1. Copy the generated string from Power BI (use a table temporarily)
2. Remove `data:image/svg+xml;utf8,` prefix
3. Save as `.svg` file or paste into online SVG viewer (e.g., SVG Viewer Chrome extension)
4. Inspect for errors in browser console

**Online tools:**
- https://www.svgviewer.dev/
- https://jakearchibald.github.io/svgomg/ (optimizer)

---

## Performance Considerations

**Impact factors:**
- Number of SVG elements per measure
- Complexity of DAX logic
- Number of rows rendering SVG
- Browser rendering performance

**Optimization tips:**
1. Minimize SVG elements (combine paths where possible)
2. Cache calculations in variables
3. Use simple shapes over complex paths
4. Limit precision (round coordinates to 1-2 decimal places)
5. Test performance with production data volumes
6. Consider using HTML Content visual for very complex graphics

---

## Helper Libraries and Resources

### DaxLib.SVG (Thin Report Measure Helper)

**Purpose:** While DaxLib.SVG is a DAX UDF library, its patterns and helper functions can be adapted for thin report measures in `reportExtensions.json`.

**What it provides:**
- **SVG Wrapper functions** - Structured approach to building SVG strings with proper metadata
- **Element functions** - Reusable patterns for circles, rectangles, lines, paths
- **Compound patterns** - Complex visuals (violin plots, boxplots, heatmaps)
- **Scale functions** - Value mapping for coordinate systems
- **Color themes** - 10 color palettes including Power BI defaults

**Documentation:** [evaluationcontext.github.io/daxlib.svg](https://evaluationcontext.github.io/daxlib.svg/)
**Download:** [daxlib.org/package/DaxLib.SVG/](https://daxlib.org/package/DaxLib.SVG/)
**GitHub:** [github.com/EvaluationContext/daxlib.svg](https://github.com/EvaluationContext/daxlib.svg)

**Blog post:** [DaxLib.SVG 0.2.0 Release](https://evaluationcontext.github.io/posts/DAXLibSVG-0-2-0/)

**Usage note:** Functions can be copied into `reportExtensions.json` as thin report measures rather than installed as UDFs in the semantic model.

### Data Goblin's PowerBI MacGuyver Toolbox

**60+ Visual Templates** with SVG patterns by Kurt Buhler (klonk)

**Repository:** [github.com/data-goblin/powerbi-macguyver-toolbox](https://github.com/data-goblin/powerbi-macguyver-toolbox)

**What's included:**
- 20+ bar chart variations (bullet charts, progress bars, rounded bars, lollipops)
- 14+ line chart templates (splines, stepped lines, error bands, thresholds)
- 24+ KPI/card templates with embedded SVG graphics
- Tabular Editor C# scripts for generating SVG measures
- SVG templates by Štěpán Rešl

**Format:** .pbip/.pbix files with sample data and complete working examples

**License:** MIT (requires attribution to data-goblins.com)

**Blog:** [data-goblins.com](https://data-goblins.com/)

### Performance Optimization Patterns

**Sparkline backbone pattern** - Jake Duddy's optimization research:

Key techniques for performant SVG measures:
- Use `SUBSTITUTEWITHINDEX()` for efficient indexing
- Normalize values to 0-100 coordinate system
- Leverage `KEEPFILTERS()` and `FILTER()` appropriately
- Use `CONCATENATEX()` for string building

**Resources:**
- [Stealing Performance from Sparklines](https://evaluationcontext.github.io/posts/SVG-Sparkline/)
- [Optimizing the SVG Heatmap](https://evaluationcontext.github.io/posts/SVG-Heatmap-Optimized/) (90% performance improvement)

---

## SVG References

**Web SVG Standards:**
- [SVG Reference (MDN)](https://developer.mozilla.org/en-US/docs/Web/SVG)
- [Data URIs](https://developer.mozilla.org/en-US/docs/Web/HTTP/Basics_of_HTTP/Data_URIs)
- [SVG Path Commands](https://developer.mozilla.org/en-US/docs/Web/SVG/Tutorial/Paths)

**Power BI Tutorials:**
- [SQLBI - Creating Custom Visuals with DAX](https://www.sqlbi.com/articles/creating-custom-visuals-in-power-bi-with-dax/)
- [Kerry Kolosko - Sparklines in New Card Visual](https://kerrykolosko.com/adding-sparklines-to-new-card-visual/)
- [Hat Full of Data - SVG Series](https://hatfullofdata.blog/svg-in-power-bi-part-1/)
- [Chandoo.org - SVG DAX Measures Tutorial](https://chandoo.org/wp/how-to-svg-dax-measures-power-bi/)

**Community Creators:**
- [Kerry Kolosko Resources](https://kerrykolosko.com/) - Extensive KPI templates
- [Andrzej Leszkiewicz Portfolio](https://www.linkedin.com/in/andrzej-leszkiewicz/) - Creative visualizations
- [Štěpán Rešl](https://www.linkedin.com/in/stepanresl/) - SVG measure templates
- [David Bacci](https://www.linkedin.com/in/davbacci/) - Advanced techniques

---

## See Also

- **[expressions.md](../schema-patterns/expressions.md)** - Expression patterns
- **[conditional-formatting.md](../schema-patterns/conditional-formatting.md)** - Conditional formatting
- **[measures.md](../measures.md)** - Extension measure patterns
