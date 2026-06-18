# SVG Patterns for Image Visuals

Image visuals (`image` visual type) render SVG measures as standalone graphics on the report canvas. Unlike table/matrix SVGs (which are inline micro-charts in rows), image visuals occupy their own visual container and can be any size.

## Critical: sourceType Must Be 'imageData'

For `data:image/svg+xml;utf8,...` data URIs, the image visual **must** use `sourceType = 'imageData'`. Using `'imageUrl'` (which is for HTTP URLs) causes `VisualDataProxyExecutionUnknownError` and renders black.

## Binding an SVG Measure to an Image Visual

### Via JSON

Create the image visual.json file manually (see `pbir-format` skill in the pbip plugin for JSON structure). Set `sourceType` to `'imageData'` and bind the `sourceField` to the SVG measure reference (e.g., `_Fmt.SparklineSVG`).

### Via Python API

Create the visual.json file manually (see the `pbir-format` skill in the pbip plugin for JSON structure).

```python
# Example using pbir_object_model (if available):
report.add_extension_measure(
    table="Orders",
    name="KPI Header SVG",
    expression='''...SVG DAX expression...''',
    data_type="Text",
    data_category="ImageUrl",
    display_folder="SVG Charts",
)

# Create image visual and bind to the measure
page = report.pages[0]
visual = page.add_visual("image", x=100, y=50, width=400, height=200)
visual.set_image_source("measure", measure_ref="Orders.KPI Header SVG")
report.save()
```

### JSON Structure

The image visual uses `objects.image` with these properties:

```json
{
  "objects": {
    "image": [{
      "properties": {
        "sourceType": {"expr": {"Literal": {"Value": "'imageData'"}}},
        "transparency": {"expr": {"Literal": {"Value": "0D"}}},
        "sourceField": {
          "expr": {
            "Measure": {
              "Expression": {
                "SourceRef": {"Schema": "extension", "Entity": "Orders"}
              },
              "Property": "KPI Header SVG"
            }
          }
        },
        "effects": {"expr": {"Literal": {"Value": "false"}}}
      }
    }]
  }
}
```

Note: image visuals need no `query` block -- only `objects.image` with `sourceType`, `sourceField`, and optionally `transparency`/`effects`.

---

## Pattern: KPI Header Card

A standalone SVG that shows a metric value, label, and trend indicator. Designed for image visuals.

```dax
KPI Header SVG =
VAR _Value = [Total Revenue]
VAR _PY = [Total Revenue PY]
VAR _Change = DIVIDE(_Value - _PY, _PY)
VAR _ChangeLabel = FORMAT(_Change, "+#,##0.0%;-#,##0.0%")
VAR _ValueLabel = FORMAT(_Value, "$#,##0,, M")
VAR _ChangeColor = IF(_Change >= 0, "#2D6A2E", "#982F2F")
VAR _Arrow = IF(_Change >= 0,
    "<polygon points='170,28 175,20 180,28' fill='" & _ChangeColor & "'/>",
    "<polygon points='170,20 175,28 180,20' fill='" & _ChangeColor & "'/>"
)

RETURN
"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 300 60'>" &
"<text x='10' y='20' font-family='Segoe UI' font-size='11' fill='#666' font-weight='600'>TOTAL REVENUE</text>" &
"<text x='10' y='48' font-family='Segoe UI' font-size='28' fill='#333' font-weight='700'>" & _ValueLabel & "</text>" &
_Arrow &
"<text x='185' y='28' font-family='Segoe UI' font-size='12' fill='" & _ChangeColor & "' font-weight='600'>" & _ChangeLabel & " vs PY</text>" &
"</svg>"
```

**Design notes:**
- Use a wide `viewBox` (e.g., 300x60) since image visuals are typically wider than table cells
- Include all text labels inside the SVG -- no separate visual title needed
- Font sizes can be larger than table SVGs (28px value vs 10-12px in tables)

---

## Pattern: Sparkline with Endpoint Dot

A clean sparkline with a highlighted endpoint, suitable for image visuals in dashboards.

```dax
Sparkline with Endpoint =
VAR _Values = ADDCOLUMNS(
    CALCULATETABLE(VALUES('Date'[Month]),
        DATESINPERIOD('Date'[Date], MAX('Date'[Date]), -12, MONTH)),
    "@Value", [Sales Amount]
)
VAR _XMin = MIN('Date'[Month])
VAR _XMax = MAX('Date'[Month])
VAR _YMin = MINX(_Values, [@Value])
VAR _YMax = MAXX(_Values, [@Value])

VAR _Points = CONCATENATEX(
    ADDCOLUMNS(_Values,
        "@X", INT(280 * DIVIDE('Date'[Month] - _XMin, _XMax - _XMin)) + 10,
        "@Y", INT(50 * DIVIDE([@Value] - _YMin, _YMax - _YMin))
    ),
    [@X] & "," & (55 - [@Y]),
    " ",
    'Date'[Month]
)

VAR _LastX = INT(280 * 1) + 10
VAR _LastVal = MAXX(FILTER(_Values, 'Date'[Month] = _XMax), [@Value])
VAR _LastY = 55 - INT(50 * DIVIDE(_LastVal - _YMin, _YMax - _YMin))

RETURN
"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 300 60'>" &
"<polyline fill='none' stroke='#448FD6' stroke-width='2' points='" & _Points & "'/>" &
"<circle cx='" & _LastX & "' cy='" & _LastY & "' r='4' fill='#448FD6'/>" &
"</svg>"
```

---

## Pattern: Multi-Metric Dashboard Tile

Combines multiple values and a mini trend line in a single image visual.

```dax
Dashboard Tile SVG =
VAR _Revenue = [Total Revenue]
VAR _Target = [Revenue Target]
VAR _Pct = DIVIDE(_Revenue, _Target)
VAR _RevLabel = FORMAT(_Revenue, "$#,0,, M")
VAR _PctLabel = FORMAT(_Pct, "0%")
VAR _BarW = _Pct * 180

-- Colors
VAR _BarColor = SWITCH(TRUE(), _Pct < 0.5, "#F44336", _Pct < 0.8, "#FF9800", "#4CAF50")

RETURN
"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 80'>" &

-- Label
"<text x='10' y='16' font-family='Segoe UI' font-size='10' fill='#999' font-weight='600'>REVENUE vs TARGET</text>" &

-- Value
"<text x='10' y='42' font-family='Segoe UI' font-size='22' fill='#333' font-weight='700'>" & _RevLabel & "</text>" &

-- Progress bar
"<rect x='10' y='52' width='180' height='8' fill='#E8E8E8' rx='4'/>" &
"<rect x='10' y='52' width='" & _BarW & "' height='8' fill='" & _BarColor & "' rx='4'/>" &

-- Percentage label
"<text x='10' y='72' font-family='Segoe UI' font-size='10' fill='" & _BarColor & "' font-weight='600'>" & _PctLabel & " of target</text>" &

"</svg>"
```

---

## Design Considerations for Image Visuals

### viewBox Sizing

Image visuals are flexible in size. Use a viewBox that matches the visual's aspect ratio:

| Use Case | Recommended viewBox | Visual Size |
|----------|-------------------|-------------|
| KPI card | `0 0 300 60` | 300x60 px |
| Sparkline | `0 0 300 50` | 300x50 px |
| Dashboard tile | `0 0 200 80` | 200x80 px |
| Full-width banner | `0 0 600 40` | 600x40 px |

### Colors

Always use hex codes with `#` (e.g., `fill='#2196F3'`). Never use `%23` URL encoding -- this causes rendering failures in image visuals. Named colors like `blue` or `red` are unreliable; always use hex.

### Transparency and Effects

Disable default image effects to prevent unwanted styling:

```json
"transparency": {"expr": {"Literal": {"Value": "0D"}}},
"effects": {"expr": {"Literal": {"Value": "false"}}}
```

### No Query Block

Image visuals bound to SVG measures do not need a `query` block. The measure is evaluated directly via `sourceField`. Adding a query block can cause duplicate evaluations.

---

## Dynamic and Responsive SVG

### Responsive width (image and card only)

Set the SVG root to `width='100%' height='100%'` and drive geometry off the `viewBox`; the host scales the rendered image to fill its container:

```dax
VAR _Prefix = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100%' height='100%' viewBox='0 0 300 60' preserveAspectRatio='xMidYMid meet'>"
```

This works in image visuals and card callouts. Table and matrix cells ignore percentage width; they use `grid.imageWidth` from the visual's `objects.grid`. Fix the `viewBox` geometry to the configured `imageWidth` when targeting table cells.

SVG can scale to fill the host, but it cannot read the container width as a number, so true reflow (re-binning bars to available width) is not possible in a DAX SVG measure. Reach for Deneb when the layout must adapt to container width.

### Conditional layout based on context

Branch the entire element assembly on filter context so the measure emits a different shape depending on what is selected, keeping each branch under the 32K string ceiling:

```dax
Conditional SVG =
VAR _Mode =
    SWITCH(
        TRUE(),
        ISBLANK([Sales Amount]),       "empty",
        HASONEVALUE('Date'[Month]),    "single",
        "trend"
    )

-- Assemble the data-URI prefix once, outside the branch
VAR _Prefix = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 300 60'>"
VAR _Suffix = "</svg>"

-- Build only the branch that will be returned
VAR _EmptyMarkup  = "<text x='10' y='35' font-family='Segoe UI' font-size='11' fill='#999'>n/a</text>"
VAR _BarMarkup    = -- single-bar assembly (HASONEVALUE context)
    "<rect x='10' y='20' width='" & INT(DIVIDE([Sales Amount], [Sales Target]) * 200) & "' height='20' fill='#448FD6'/>"
VAR _SparkMarkup  = -- sparkline assembly (multi-period context)
    "<polyline fill='none' stroke='#448FD6' stroke-width='2' points='" &
    CONCATENATEX(
        ADDCOLUMNS(VALUES('Date'[Month]), "@V", [Sales Amount]),
        INT(RANKX(VALUES('Date'[Month]), 'Date'[Month], , ASC) * 25) & "," &
        INT(50 - DIVIDE([@V], MAXX(VALUES('Date'[Month]), [Sales Amount])) * 40),
        " ", 'Date'[Month]
    ) & "'/>"

VAR _Body =
    SWITCH(
        _Mode,
        "empty",  _EmptyMarkup,
        "single", _BarMarkup,
        _SparkMarkup
    )

RETURN _Prefix & _Body & _Suffix
```

Key rules for conditional layout measures:

- Always include a blank/empty-state branch so filter contexts with no data emit a readable fallback rather than a degenerate zero-width SVG or BLANK
- Assemble the data-URI prefix and `</svg>` suffix once outside the SWITCH so the empty branch cannot accidentally omit them
- Switch on report/page-level state for the whole measure (e.g., `HASONEVALUE` over a slicer's dimension); switching per row on a different condition confuses readers who see different chart metaphors in adjacent cells
- Subtotal and total rows should usually return the empty markup or `BLANK()` rather than a coarced single-value chart
