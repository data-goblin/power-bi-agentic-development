# Layout Guidelines

Detailed specifications for Power BI report page layouts.

## Page Dimensions

### Standard Page (16:9)

```
Width:  1280px
Height: 720px
```

### Alternative Sizes

| Type | Width | Height | Use Case |
|------|-------|--------|----------|
| Standard | 1280 | 720 | Desktop (PBI default) |
| Full HD | 1920 | 1080 | High-resolution displays, presentations |
| Letter | 816 | 1056 | Print, portrait |
| 4:3 | 1280 | 960 | Legacy displays |
| Custom | Variable | Variable | Specific requirements |

## Margins and Spacing

On a fixed PBIR canvas, white space is a finite budget spent explicitly through gaps between `position` rectangles. Two failure modes both come from treating gaps as residual: cramming (proximity collapses, groups stop reading) or scattering (page feels empty).

Spend at three tiers, all multiples of the grid unit:

```yaml
intra-group:  ~8-16px   # within a group (a KPI row)
inter-group:  ~24-32px  # between groups; this gap creates visual proximity grouping
margin:       ~24-32px  # canvas edge to first/last visual, all four sides
```

The inter-group gap must be strictly larger than the intra-group gap; that inequality is what turns spacing into hierarchy.

Reserve the margin first (usable area = `canvas - 2*margin`). Avoid double-spending a gap and a box border for the same separation; prefer the gap.

Padding (inside a visual container) and gaps (between visual containers) are different budgets controlled in different places; tightening one does not buy the other.

### Page Margins

```
Top:    24-32px
Bottom: 24-32px
Left:   24-32px
Right:  24-32px
```

### Visual Spacing

```
Intra-group (within a visual group):   8-16px
Inter-group (between logical groups): 24-32px
```

### Grid System

Use 8px or 16px grid for consistent alignment:

```
Positions: 0, 16, 32, 48, 64, 80...
Sizes: 200, 300, 400, 500...
```

## Visual Zones

### Zone Layout (Detail Gradient)

```
+------------------+------------------+
|       ZONE 1     |      ZONE 1      |  y: 24 - 200
|   KPIs / Cards   |   KPIs / Cards   |  (Important, summary)
+------------------+------------------+
|                                     |
|              ZONE 2                 |  y: 216 - 600
|        Charts / Analysis            |  (Context, trends)
|                                     |
+------------------+------------------+
|                                     |
|              ZONE 3                 |  y: 616 - 1056
|        Tables / Details             |  (Drill-down, detail)
|                                     |
+------------------+------------------+
```

### Zone Specifications

| Zone | Purpose | Height | Visual Types |
|------|---------|--------|--------------|
| 1 | Summary | 150-200px | Cards, KPIs, Slicers |
| 2 | Analysis | 350-450px | Charts, Maps, Gauges |
| 3 | Detail | 350-450px | Tables, Matrix, Lists |

## Common Visual Sizes

### Cards/KPIs

```
Width:  200-300px
Height: 100-150px
```

### Charts

```
Small:  Width: 400px,  Height: 300px
Medium: Width: 600px,  Height: 400px
Large:  Width: 900px,  Height: 500px
Full:   Width: 1872px, Height: 500px
```

### Tables

```
Width:  Variable (fill available space)
Height: 300-500px
```

### Slicers

```
Horizontal: Width: 200-400px, Height: 60-80px
Vertical:   Width: 150-200px, Height: 200-400px
```

## Title Area

### Page Title Specifications

```
Position: x: 24, y: 24
Width:    400-600px
Height:   48-64px
Font:     24pt bold
```

### Subtitle (Optional)

```
Position: x: 24, y: 72
Width:    400-600px
Height:   32-48px
Font:     14pt regular
```

## Sample Layouts

### Dashboard Layout

```
+--------------------------------------------------+
|  Title                            [Slicer]       |  y: 24
+--------+--------+--------+--------+--------------+
|  KPI   |  KPI   |  KPI   |  KPI   |              |  y: 96
+--------+--------+--------+--------+              +
|                         |                        |
|     Line Chart          |     Bar Chart          |  y: 232
|                         |                        |
+-------------------------+------------------------+
|                                                  |
|                    Table                         |  y: 616
|                                                  |
+--------------------------------------------------+
```

### Analysis Layout

```
+--------------------------------------------------+
|  Title                                           |  y: 24
+-------------------------+------------------------+
|                         |  Slicer                |  y: 96
|                         +------------------------+
|     Main Chart          |  Supporting Chart 1    |  y: 180
|                         +------------------------+
|                         |  Supporting Chart 2    |  y: 440
+-------------------------+------------------------+
|  Detail Table or Additional Analysis             |  y: 700
+--------------------------------------------------+
```

### KPI Dashboard

```
+--------------------------------------------------+
|  Title                            [Date Slicer]  |  y: 24
+--------+--------+--------+--------+--------------+
| Big    | Big    | Big    | Big    |              |  y: 96
| KPI    | KPI    | KPI    | KPI    |              |
+--------+--------+--------+--------+--------------+
|                                                  |
|           Trend Chart (Sparklines)               |  y: 280
|                                                  |
+--------------------------------------------------+
|                                                  |
|           Comparison Table                       |  y: 540
|                                                  |
+--------------------------------------------------+
```

## Positioning Rules

### Alignment

1. **Vertical alignment:** Left edges of visuals in same column should align
2. **Horizontal alignment:** Top edges of visuals in same row should align
3. **Consistent spacing:** Equal gaps between all visuals -- this is critical

### Symmetrical Spacing (Critical)

**All gaps between visuals must be equal.** Uneven spacing creates visual tension and signals misalignment, even when visuals are technically positioned correctly. This is one of the most common layout mistakes.

When calculating positions for a row of visuals:

1. Decide the page margin (e.g., 24px) and the gap between visuals (e.g., 16px)
2. Calculate available content width: `page_width - (2 * margin)`
3. Calculate total gap space: `gap * (num_visuals - 1)`
4. Distribute remaining width proportionally: `(content_width - total_gaps) / num_visuals`

Example for 4 equal visuals on a 1280px page with 24px margins and 16px gaps:
```
content_width = 1280 - 48 = 1232
total_gaps = 16 * 3 = 48
visual_width = (1232 - 48) / 4 = 296

x positions: 24, 336, 648, 960
```

For visuals of different widths (e.g., a KPI + a chart sharing a row), the gap between them must still match the gap between other visual pairs on the page. Verify by checking: `visual_B.x - (visual_A.x + visual_A.width)` is the same for all adjacent pairs.

**Anti-pattern**: Visuals that are close but not quite aligned, or where the gap between the left pair is 16px but the gap between the right pair is 24px. This is visually jarring even at small differences (4-8px).

### Vertical Column Alignment Across Rows (Critical)

When visuals in different rows share a vertical split (e.g., two charts side-by-side below two KPI pairs), the column boundaries must align vertically across rows. The gap between the left visual and right visual in row 2 must line up with the gap in row 1.

```
WRONG (misaligned vertical split):
+------ 648px ------+--16--+---- 584px ----+   Row 1
+------- 632px ------+--16--+--- 600px ----+   Row 2
                     ^       ^
                     These don't align -- looks sloppy

RIGHT (aligned vertical split):
+------ 648px ------+--16--+---- 584px ----+   Row 1
+------ 648px ------+--16--+---- 584px ----+   Row 2
                     ^
                     Same column edge in both rows
```

When calculating: if row 1 has visual A ending at x=648 and visual B starting at x=664 (16px gap), row 2 must use the same split: visual C ends at x=648, visual D starts at x=664. The widths of C and D will differ from A and B, but the gap position is identical.

This applies to any multi-row layout where visuals share implicit column boundaries. Even if the visuals are different types and sizes, the vertical gutters must form continuous lines from top to bottom of the page.

### Z-Order

- Base visuals: z = 0-999
- Overlays/highlights: z = 1000-1999
- Tooltips/popups: z = 2000+

## Performance Considerations

Opening a page refreshes every visible visual; each emits at least one DAX query. Parallelism is capped (DirectQuery default 10 concurrent connections), so latency grows non-linearly past that cap. Visual COUNT is a proxy; query COST per visual is the actual driver. 12 cheap card visuals are fine; 8 matrices with totals and measure filters may not be.

Visuals that emit more than one query per page load (multipliers):
- Tables/matrices with totals or subtotals (one query per band; DistinctCount and Median are worst)
- Measure filters (two queries)
- Top N filters (two queries; can hit the 1M-row intermediate limit in DirectQuery)
- Field parameters (an extra evaluated-parameters phase)
- Custom/Deneb/Python/R visuals (render phase dominates)

### Exceptions

These do not emit queries and do not count toward visual density:
- Textboxes
- Images
- Shapes
- Buttons
