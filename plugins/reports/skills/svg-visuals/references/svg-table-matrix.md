# SVG Patterns for Table and Matrix Visuals

Table (`tableEx`) and Matrix (`pivotTable`) visuals are the primary target for DAX SVG measures. Configure `grid.imageHeight` and `grid.imageWidth` in visual objects to control rendering size (default: 25px height, 100px width).

## Setup

### Image Size Configuration

Set in the visual's `objects.grid`:

```json
"grid": [{
  "properties": {
    "imageHeight": {"expr": {"Literal": {"Value": "25D"}}},
    "imageWidth": {"expr": {"Literal": {"Value": "100D"}}}
  }
}]
```

### Sort Trick

Embed a `<desc>` tag to enable sorting the SVG column by bar length:

```dax
VAR _Sort = "<desc>" & FORMAT(_Actual, "000000000000") & "</desc>"
```

Power BI uses the `<desc>` content as the sort key for the image column.

### Axis Normalization (Required for All Bar-Based Charts)

All bar, bullet, and dumbbell charts need a shared axis maximum so bars are comparable across rows:

```dax
VAR _BarMax = 100          -- max pixel width of the bar area
VAR _BarMin = 20           -- left offset (space for labels/dots)
VAR _Scope = ALLSELECTED('Table'[GroupColumn])

VAR _MaxActual = CALCULATE(
    MAXX(_Scope, [Actual]),
    REMOVEFILTERS('Table'[GroupColumn])
)
VAR _MaxTarget = CALCULATE(
    MAXX(_Scope, [Target]),
    REMOVEFILTERS('Table'[GroupColumn])
)

VAR _AxisMax =
    IF(
        HASONEVALUE('Table'[GroupColumn]),
        MAX(_MaxActual, _MaxTarget),
        CALCULATE(MAX([Actual], [Target]), REMOVEFILTERS('Table'[GroupColumn]))
    ) * 1.1   -- 10% headroom

VAR _AxisRange = _BarMax - _BarMin
VAR _ActualNormalized = DIVIDE(_Actual, _AxisMax) * _AxisRange
VAR _TargetNormalized = (DIVIDE(_Target, _AxisMax) * _AxisRange) + _BarMin - 1
```

Key points:
- `REMOVEFILTERS` on the group column ensures `_AxisMax` is consistent across all rows
- Multiply by 1.1 for headroom so bars never hit the edge
- Target position = normalized value + left offset

### Number Formatting (Adaptive Scale)

```dax
VAR _Label = SWITCH(TRUE(),
    _Actual <= 1E3,  FORMAT(_Actual, "#,0"),
    _Actual <= 1E6,  FORMAT(_Actual, "#,0, K"),
    _Actual <= 1E9,  FORMAT(_Actual, "#,0,, M"),
    FORMAT(_Actual, "#,0,,, B")
)
```

---

## Pattern: Data Bar

Simple proportional bar for table columns. The most basic SVG pattern.

```dax
Data Bar =
VAR _Value = [Sales Amount]
VAR _Max = CALCULATE(MAX([Sales Amount]), REMOVEFILTERS('Product'[Category]))
VAR _Pct = DIVIDE(_Value, _Max)
VAR _W = _Pct * 100
VAR _Color = "#5B8DBE"

RETURN
"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 16'>" &
"<rect width='" & _W & "' height='16' fill='" & _Color & "' opacity='0.7' rx='2'/>" &
"<text x='" & (_W + 3) & "' y='12' font-size='10' fill='#333'>" &
FORMAT(_Value, "#,0") & "</text></svg>"
```

**Variants:**
- Rounded corners: add `rx='4'` to the rect
- Rounded tops only: use `rx` equal to half the height
- Conditional color: `VAR _Color = IF(_Value > _Threshold, "#4CAF50", "#F44336")`

---

## Pattern: Bullet Chart with Action Dots

Combines actual bar, target line, baseline, and a sentiment-colored dot. From the SpaceParts production model.

```dax
SVG Bullet Chart =
-- Config
VAR _Actual = [MTD Turnover]
VAR _Target = [MTD Turnover 1YP]
VAR _Performance = DIVIDE(_Actual - _Target, _Target)

-- Sentiment thresholds
VAR _VeryBad  = -0.05
VAR _Bad      = -0.025
VAR _Good     =  0.025
VAR _VeryGood =  0.05

-- Chart dimensions
VAR _BarMax = 100
VAR _BarMin = 20
VAR _Scope = ALL('Customers'[Key Account Name])

-- Colors
VAR _BackgroundColor = "#F5F5F5"
VAR _BarFillColor    = "#CFCFCF"
VAR _BaselineColor   = "#737373"
VAR _TargetColor     = "#000000"

VAR _ActionDotFill =
    SWITCH(TRUE(),
        _Performance < _VeryBad, "#f4ae4c",
        _Performance < _Bad,     "#ffe075",
        _Performance > _VeryGood, "#2D6390",
        _Performance > _Good,    "#74B2FF",
        "#FFFFFF00"
    )

-- Axis normalization
VAR _MaxActual = CALCULATE(MAXX(_Scope, [MTD Turnover]), REMOVEFILTERS('Customers'[Key Account Name]))
VAR _MaxTarget = CALCULATE(MAXX(_Scope, [MTD Turnover 1YP]), REMOVEFILTERS('Customers'[Key Account Name]))
VAR _AxisMax =
    IF(HASONEVALUE('Customers'[Key Account Name]),
        MAX(_MaxActual, _MaxTarget),
        CALCULATE(MAX([MTD Turnover], [MTD Turnover 1YP]), REMOVEFILTERS('Customers'[Key Account Name]))
    ) * 1.1

VAR _AxisRange = _BarMax - _BarMin
VAR _ActualNormalized = DIVIDE(_Actual, _AxisMax) * _AxisRange
VAR _TargetNormalized = (DIVIDE(_Target, _AxisMax) * _AxisRange) + _BarMin - 1

-- SVG construction
VAR _SvgPrefix = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg'>"
VAR _Sort = "<desc>" & FORMAT(_Actual, "000000000000") & "</desc>"

VAR _ActionDot    = "<circle cx='10' cy='11' r='5' fill='" & _ActionDotFill & "'/>"
VAR _BarBg        = "<rect x='" & _BarMin & "' y='2' width='" & _BarMax & "' height='80%' fill='" & _BackgroundColor & "'/>"
VAR _ActualBar    = "<rect x='" & _BarMin & "' y='5' width='" & _ActualNormalized & "' height='50%' fill='" & _BarFillColor & "'/>"
VAR _Baseline     = "<rect x='" & _BarMin & "' y='4' width='1' height='60%' fill='" & _BaselineColor & "'/>"
VAR _TargetLine   = "<rect x='" & _TargetNormalized & "' y='2' width='2' height='80%' fill='" & _TargetColor & "'/>"

VAR _SvgSuffix = "</svg>"

RETURN
    _SvgPrefix & _Sort & _ActionDot & _BarBg & _ActualBar & _Baseline & _TargetLine & _SvgSuffix
```

**Key elements:**
- Action dot at left edge shows sentiment at a glance (colored circle)
- Background rect provides visual context for the bar area
- Target line as a thin rect (width 2px) at the target position
- Baseline at the left edge of the bar area
- `<desc>` for sort ordering

---

## Pattern: Overlapping Bars with Variance

Two bars (actual on top, target behind) with a colored variance indicator and label. From SpaceParts.

```dax
SVG Overlapping Bars =
-- Config
VAR _Actual = [Actuals MTD]
VAR _Target = [Budget MTD]
VAR _Performance = DIVIDE(_Actual - _Target, _Target)

-- Font
VAR _Font = "Segoe UI"
VAR _FontSize = 10
VAR _FontWeight = 600

-- Chart dimensions
VAR _BarMax = 100
VAR _BarMin = 30
VAR _Scope = ALLSELECTED('Customers'[Key Account Name])

-- Colors
VAR _ActualColor   = "#686868"
VAR _TargetColor   = "#e1dfdd"
VAR _VarianceColor = IF(_Performance < 0, "#fab005", "#2094ff")

-- Axis normalization
VAR _MaxActual = CALCULATE(MAXX(_Scope, [Actuals MTD]), REMOVEFILTERS('Customers'[Key Account Name]))
VAR _MaxTarget = CALCULATE(MAXX(_Scope, [Budget MTD]), REMOVEFILTERS('Customers'[Key Account Name]))
VAR _AxisMax =
    IF(HASONEVALUE('Customers'[Key Account Name]),
        MAX(_MaxActual, _MaxTarget),
        CALCULATE(MAX([Actuals MTD], [Budget MTD]), REMOVEFILTERS('Customers'[Key Account Name]))
    ) * 1.1

VAR _AxisRange = _BarMax - _BarMin
VAR _ActualNormalized = DIVIDE(_Actual, _AxisMax) * _AxisRange
VAR _TargetNormalized = DIVIDE(_Target, _AxisMax) * _AxisRange

-- SVG construction
VAR _SvgPrefix = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg'>"
VAR _Sort = "<desc>" & FORMAT(_Actual, "000000000000") & "</desc>"

VAR _Icon  = "<text x='" & _BarMin - 3 & "' y='13.5' font-family='Segoe UI' font-size='6' font-weight='700' text-anchor='end' fill='" & _VarianceColor & "'>" & FORMAT(_Performance, "^^^;vvv;") & "</text>"
VAR _Label = "<text x='" & _BarMin - 10 & "' y='15' font-family='" & _Font & "' font-size='" & _FontSize & "' font-weight='" & _FontWeight & "' text-anchor='end' fill='" & _VarianceColor & "'>" & FORMAT(_Performance, "#,##0%;#,##0%;#,##0%") & "</text>"

VAR _TargetBar   = "<rect x='" & _BarMin & "' y='10' width='" & _TargetNormalized & "' height='12' stroke='" & _ActualColor & "' fill='" & _TargetColor & "'/>"
VAR _ActualBar   = "<rect x='" & _BarMin & "' y='3' width='" & _ActualNormalized & "' height='12' stroke='" & _ActualColor & "' fill='" & _ActualColor & "'/>"
VAR _VarianceBar = "<rect x='" & _BarMin + MIN(_ActualNormalized, _TargetNormalized) + 1 & "' y='" & IF(_Target > _Actual, 2.9, 9) & "' width='" & ABS(_ActualNormalized - _TargetNormalized) - 1 & "' height='6' stroke='" & _VarianceColor & "' fill='" & _VarianceColor & "'/>"

VAR _SvgSuffix = "</svg>"

RETURN
    _SvgPrefix & _Sort & _Icon & _Label & _TargetBar & _ActualBar & _VarianceBar & _SvgSuffix
```

**Key elements:**
- Variance label + directional icon at the left
- Target bar behind (wider height offset), actual bar on top
- Variance highlight bar spans the gap between actual and target
- Variance bar position (y) shifts based on whether actual > target

---

## Pattern: Dumbbell Chart

Compares two values as circles connected by a line. From SpaceParts.

```dax
SVG Dumbbell Chart =
-- Config
VAR _Actual = [Actuals MTD]
VAR _Target = [Sales Target MTD]

-- Chart dimensions
VAR _SvgWidth = 100
VAR _SvgHeight = 25
VAR _Scope = ALLSELECTED('Customers'[Key Account Name])

-- Axis normalization
VAR _MaxActual = CALCULATE(MAXX(_Scope, [Actuals MTD]), REMOVEFILTERS('Customers'[Key Account Name]))
VAR _MaxTarget = CALCULATE(MAXX(_Scope, [Sales Target MTD]), REMOVEFILTERS('Customers'[Key Account Name]))
VAR _AxisMax =
    IF(HASONEVALUE('Customers'[Key Account Name]),
        MAX(_MaxActual, _MaxTarget),
        CALCULATE(MAX([Actuals MTD], [Sales Target MTD]), REMOVEFILTERS('Customers'[Key Account Name]))
    ) * 1.1

VAR _AxisRange = _SvgWidth
VAR _ActualNormalized = DIVIDE(_Actual, _AxisMax) * _AxisRange
VAR _TargetNormalized = DIVIDE(_Target, _AxisMax) * _AxisRange

-- Colors (conditional: blue if on target, red if off)
VAR _AxisColor = "#C7C7C7"
VAR _Fill   = IF(_Actual > _Target, "#448FD6", "#D64444")
VAR _Stroke = IF(_Actual > _Target, "#2F6698", "#982F2F")

-- SVG construction
VAR _SvgPrefix = "data:image/svg+xml;utf8,<svg width='" & _SvgWidth & "' height='" & _SvgHeight & "' xmlns='http://www.w3.org/2000/svg'>"
VAR _Sort = "<desc>" & FORMAT(_Actual, "000000000000") & "</desc>"

VAR _Axis         = "<line x1='0' y1='" & _SvgHeight / 2 & "' x2='" & _SvgWidth & "' y2='" & _SvgHeight / 2 & "' stroke='" & _AxisColor & "'/>"
VAR _Origin       = "<circle cx='2' cy='" & _SvgHeight / 2 & "' r='2' fill='" & _AxisColor & "'/>"
VAR _DumbbellLine = "<line x1='" & _ActualNormalized & "' y1='" & _SvgHeight / 2 & "' x2='" & _TargetNormalized & "' y2='" & _SvgHeight / 2 & "' stroke='" & _Fill & "' stroke-width='3'/>"
VAR _TargetCircle = "<circle cx='" & _TargetNormalized & "' cy='" & _SvgHeight / 2 & "' r='4' fill='#F5F5F5' stroke='#C7C7C7' stroke-width='1.5'/>"
VAR _ActualCircle = "<circle cx='" & _ActualNormalized & "' cy='" & _SvgHeight / 2 & "' r='4' fill='" & _Fill & "' stroke='" & _Stroke & "' stroke-width='1.5'/>"

VAR _SvgSuffix = "</svg>"

RETURN
    _SvgPrefix & _Sort & _Axis & _Origin & _DumbbellLine & _TargetCircle & _ActualCircle & _SvgSuffix
```

**Key elements:**
- Horizontal axis line spanning the full width
- Origin dot at left edge
- Connecting line between actual and target (colored by performance)
- Target circle: neutral grey fill, grey stroke
- Actual circle: blue (on target) or red (off target)
- Render order matters: line first, then target circle, then actual circle on top

---

## Pattern: Status Pill

Colored pill with text label for categorical status. From MacGuyver Toolbox.

```dax
Status Pill =
VAR _Status = [Status Category]
VAR _BgColor = SWITCH(_Status,
    "On Track",  "#CEE5D0",
    "At Risk",   "#FFF3CD",
    "Late",      "#EBD2CE",
    "#F0F0F0"
)
VAR _TextColor = SWITCH(_Status,
    "On Track",  "#2D6A2E",
    "At Risk",   "#856404",
    "Late",      "#982F2F",
    "#333333"
)

RETURN
"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg'>" &
"<rect x='0.5' y='0.5' width='98%' height='95%' rx='15%' fill='" & _BgColor & "' stroke='" & _TextColor & "'/>" &
"<text x='50%' y='58%' font-family='Segoe UI' font-size='12' font-weight='700' fill='" & _TextColor & "' text-anchor='middle' dominant-baseline='middle'>" & UPPER(_Status) & "</text></svg>"
```

---

## Pattern: Lollipop Chart

Thin line with proportionally sized dot at the end. From MacGuyver Toolbox.

```dax
Lollipop Chart =
VAR _Actual = [Sales Amount]
VAR _Target = [Sales Target]
VAR _BarMax = 75
VAR _BarMin = 20
VAR _Scope = ALL('Product'[Category])

VAR _MaxVal = CALCULATE(MAX([Sales Amount], [Sales Target]), REMOVEFILTERS('Product'[Category])) * 1.1
VAR _AxisRange = _BarMax - _BarMin

VAR _ActualNormalized = DIVIDE(_Actual, _MaxVal) * _AxisRange
VAR _DotRadius = MAX(DIVIDE(_Actual, _MaxVal) * 7.5, 3.5)

VAR _Performance = DIVIDE(_Actual - _Target, _Target)
VAR _Color = IF(_Performance >= 0, "#448FD6", "#D64444")

VAR _Label = SWITCH(TRUE(),
    _Actual <= 1E3,  FORMAT(_Actual, "#,0"),
    _Actual <= 1E6,  FORMAT(_Actual, "#,0, K"),
    FORMAT(_Actual, "#,0,, M")
)

RETURN
"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg'>" &
"<desc>" & FORMAT(_Actual, "000000000000") & "</desc>" &
"<rect x='" & _BarMin & "' y='12' width='" & _ActualNormalized & "' height='1.5' fill='" & _Color & "'/>" &
"<circle cx='" & (_BarMin + _ActualNormalized) & "' cy='12.5' r='" & _DotRadius & "' fill='" & _Color & "'/>" &
"<text x='" & _BarMin - 3 & "' y='15' font-family='Segoe UI' font-size='9' font-weight='600' text-anchor='end' fill='" & _Color & "'>" & _Label & "</text></svg>"
```

**Key elements:**
- Dot radius scales proportionally with value: `MAX(DIVIDE(_Actual, _MaxVal) * 7.5, 3.5)`
- Thin line (height 1.5px) connects the left edge to the dot
- Label positioned to the left of the bar area

---

## Pattern: Sparkline (Polyline)

Line sparkline showing trend over time using CONCATENATEX.

```dax
Sparkline SVG =
VAR _Values = ADDCOLUMNS(
    CALCULATETABLE(
        VALUES('Date'[Month]),
        DATESINPERIOD('Date'[Date], MAX('Date'[Date]), -12, MONTH)
    ),
    "@Value", [Sales Amount]
)
VAR _XMin = MIN('Date'[Month])
VAR _XMax = MAX('Date'[Month])
VAR _YMin = MINX(_Values, [@Value])
VAR _YMax = MAXX(_Values, [@Value])

VAR _Points = CONCATENATEX(
    ADDCOLUMNS(_Values,
        "@X", INT(100 * DIVIDE('Date'[Month] - _XMin, _XMax - _XMin)),
        "@Y", INT(30 * DIVIDE([@Value] - _YMin, _YMax - _YMin))
    ),
    [@X] & "," & (30 - [@Y]),
    " ",
    'Date'[Month]
)

RETURN
IF(HASONEVALUE('Product'[Category]),
    "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 30'>" &
    "<polyline fill='none' stroke='#5B8DBE' stroke-width='2' points='" & _Points & "'/></svg>",
    BLANK()
)
```

**Key technique:** Y is inverted (`30 - [@Y]`) because SVG Y=0 is at the top.

---

## Pattern: Area Sparkline with Gradient

```dax
Area Sparkline =
VAR Defs = "<defs><linearGradient id='grad' x1='0' y1='0' x2='0' y2='50' gradientUnits='userSpaceOnUse'><stop stop-color='navy' offset='0'/><stop stop-color='transparent' offset='1'/></linearGradient></defs>"

VAR XMin = MIN('Table'[Date])
VAR XMax = MAX('Table'[Date])
VAR YMin = MINX(VALUES('Table'[Date]), CALCULATE([Measure]))
VAR YMax = MAXX(VALUES('Table'[Date]), CALCULATE([Measure]))

VAR Points = ADDCOLUMNS(
    SUMMARIZE('Table', 'Table'[Date]),
    "X", INT(150 * DIVIDE('Table'[Date] - XMin, XMax - XMin)),
    "Y", INT(50 * DIVIDE([Measure] - YMin, YMax - YMin))
)

VAR Lines = CONCATENATEX(Points, [X] & "," & (50 - [Y]), " ", 'Table'[Date])

RETURN IF(HASONEVALUE('Table'[Category]),
    "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 150 50'>" &
    Defs &
    "<polyline fill='url(#grad)' fill-opacity='0.3' stroke='navy' stroke-width='3' points='0 50 " & Lines & " 150 50 Z'/></svg>",
    BLANK())
```

---

## Pattern: Bar Sparkline

```dax
Bar Sparkline =
VAR _Values = ADDCOLUMNS(
    CALCULATETABLE(VALUES('Date'[Month]),
        DATESINPERIOD('Date'[Date], MAX('Date'[Date]), -12, MONTH)),
    "@Value", [Sales Amount]
)
VAR _Count = COUNTROWS(_Values)
VAR _Max = MAXX(_Values, [@Value])
VAR _Min = MINX(_Values, [@Value])
VAR _Range = _Max - _Min
VAR _W = 100
VAR _H = 30
VAR _BarW = _W / _Count
VAR _Scale = _H / _Range

VAR _Bars = CONCATENATEX(
    ADDCOLUMNS(_Values, "@Idx", RANKX(_Values, 'Date'[Month], , ASC)),
    VAR _X = ([@Idx] - 1) * _BarW
    VAR _BarH = ([@Value] - _Min) * _Scale
    VAR _Y = _H - _BarH
    RETURN "<rect x='" & _X & "' y='" & _Y & "' width='" & (_BarW * 0.8) &
           "' height='" & _BarH & "' fill='#2196F3' opacity='0.7'/>",
    "", [@Idx], ASC
)

RETURN
"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 " & _W & " " & _H & "'>" & _Bars & "</svg>"
```

---

## UDF Pattern

For reusable SVG charts, use DAX UDFs (User-Defined Functions) that accept parameters. These are defined as extension measures in a dedicated `__SVGs` or similar table.

```dax
-- Calling a UDF
SVG.Chart.BulletChart.ActionDot(
    [MTD Turnover],                        -- Actual measure
    [MTD Turnover 1YP],                    -- Target measure
    'Customers'[Key Account Name],         -- Group column
    -0.050,                                -- Very bad threshold
    -0.025,                                -- Bad threshold
     0.025,                                -- Good threshold
     0.050,                                -- Very good threshold
    "#f4ae4c",                             -- Very bad color
    "#ffe075",                             -- Bad color
    "#74B2FF",                             -- Good color
    "#2D6390"                              -- Very good color
)
```

Available UDF libraries:
- `SVG.Chart.BarChart.OverlappingBars` -- overlapping bars with variance label
- `SVG.Chart.BarChart.OverlappingBarsSimple` -- overlapping bars without label
- `SVG.Chart.BulletChart.ActionDot` -- bullet chart with sentiment dots
- `SVG.Chart.DumbbellPlot` -- dumbbell comparison chart
- `SVG.Chart.Waterfall` -- waterfall chart with connectors

See the PowerBI MacGuyver Toolbox and DaxLib.SVG libraries for more UDFs.

---

## Performance in Table and Matrix Cells

An SVG measure is a string-building DAX expression evaluated once per visible cell (per row in a table; per row x column intersection in a matrix), all in the single-threaded formula engine with no storage-engine acceleration for the string concatenation. Cost scales with iteration count, not byte size.

### Pre-aggregate in model measures, not inside the SVG string

A sparkline that runs `CONCATENATEX` over 24 monthly points for every row is ~720 point-iterations of string assembly per page refresh, re-evaluated on every cross-filter. Push the base aggregations into reusable model measures or a precomputed table so the storage-engine cache absorbs that work; the SVG measure should only map computed numbers to coordinates.

### Prefer one `<polyline>` over N individual elements

A single `CONCATENATEX` producing a `points='...'` string for `<polyline>` iterates once and produces one element. Replacing it with N `<circle>` or `<line>` elements runs N iterations and emits N elements for the parser. Use `<polyline>` for line/area sparklines; reserve individual shapes for endpoints or markers only.

### Round coordinates to integers

Shorter strings mean cheaper `FORMAT` calls and less markup:

```dax
-- Preferred: integer coordinates
VAR _X = INT(DIVIDE(_Month - _XMin, _XMax - _XMin) * 100)
-- Avoid: floating-point strings like "47.3829..."
```

### The 32K limit is per rendered cell, not per expression

The ceiling applies to the string returned by the measure for each individual cell. Diagnose by running `LEN([Your SVG Measure])` via `pbir model -q` for a worst-case category member. Near the ceiling, the cell silently drops to blank text. Options when approaching the limit:

- Reduce the time-series window (12 months instead of 24)
- Split into two simpler measures rendered in adjacent columns
- Move the visualization to Deneb, which has no comparable string ceiling

### The `HASONEVALUE`/`ISINSCOPE` total guard matters for both correctness and cost

A matrix evaluates SVG measures at subtotal and grand-total rows too. Without a guard, the measure runs at a coarser grain and may return a meaningless or oversized SVG. Gate explicitly:

```dax
IF(
    HASONEVALUE('Product'[Category]),
    -- SVG assembly
    BLANK()
)
```

For nested matrices, `ISINSCOPE('Product'[SubCategory])` targets a specific hierarchy level and avoids building SVGs at every subtotal band.

### Caching and volatile inputs

Identical SVG strings for identical filter contexts hit the formula engine result cache. Inputs that change every evaluation defeat caching: `NOW()`, `TODAY()`, and unseed random jitter. The jitter-plot example uses a hash-based pseudo-random from a key column; preserve that pattern rather than introducing `RAND()`.

### `grid.imageHeight`/`grid.imageWidth` and column width

Setting large image dimensions in the visual's `objects.grid` does not change the formula-engine cost of generating the SVG, but it adds rasterization and paint cost in the renderer. Keep dimensions proportional to the cell content; avoid inflating them for visual effect. Auto-size-width ON with a wide SVG column triggers horizontal scroll and re-layout churn; set an explicit `columnWidth` in the visual formatting.
