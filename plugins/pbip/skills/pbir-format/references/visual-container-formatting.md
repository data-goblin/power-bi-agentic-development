# Visual Container Formatting

Every visual in a Power BI report is wrapped in a "container" -- think of it as a picture frame around a painting. The painting is your chart or table. The frame is everything else: the title bar above it, the background behind it, the border around it, the shadow beneath it, the rounded corners, the padding between the frame edge and the painting, the little header icons in the top-right corner.

```
+-----------------------------------------------+
|  Title                            [icons]     |  <-- container (visualContainerObjects)
|  Subtitle                                     |
|  ─────────────── divider ───────────────────  |
|  +─────────────────────────────────────────+  |
|  |                                         |  |
|  |          The actual visual              |  |  <-- visual content (objects)
|  |     (chart, table, card, etc.)          |  |
|  |                                         |  |
|  +─────────────────────────────────────────+  |
|                  padding                      |
+-----------------------------------------------+
           border + rounded corners
                  shadow
```

**Container** (visualContainerObjects): title, subtitle, divider, background, border, rounded corners, shadow, padding, spacing, header icons, tooltips, alt text, aspect ratio lock

**Visual content** (objects): axes, legends, data points, data labels, line styles, markers, grid lines, column formatting, plot area -- anything that depends on the visual type and its data

This distinction matters because the two are configured in **separate JSON sections**, and putting properties in the wrong one silently fails.

## The Two Sections

Inside `visual.json`, the `visual` object has two property sections:

### `objects` -- the visual content

Controls how the chart/table/card renders its data. What goes here depends entirely on the visual type -- a line chart has `lineStyles` and `markers`, a table has `grid` and `columnHeaders`, a slicer has `data` and `selection`.

Common properties: `dataPoint`, `legend`, `categoryAxis`, `valueAxis`, `dataLabels`, `lineStyles`, `plotArea`, `grid`, `columnHeaders`, `columnFormatting`, `total`, `data` (slicer mode), `general` (textbox paragraphs), `labels`, `markers`, `error`, `sparklines`, `referenceLabel`

### `visualContainerObjects` -- the frame

Controls the chrome that wraps every visual, regardless of type. A bar chart and a textbox have the same container properties available.

| Property | What it controls |
|----------|-----------------|
| `title` | Title bar (text, font, color, show/hide) |
| `subTitle` | Subtitle below title |
| `background` | Container background color and transparency |
| `border` | Container border (color, width, radius) |
| `dropShadow` | Shadow behind the container |
| `padding` | Space between container edge and visual content |
| `spacing` | Space between title area and visual |
| `divider` | Line between title and visual content |
| `visualHeader` | Header icons (drill, filter, focus, etc.) in reading view |
| `visualHeaderTooltip` | Tooltip for header area |
| `visualTooltip` | Tooltip for entire visual |
| `visualLink` | Click-through action |
| `lockAspect` | Lock aspect ratio |
| `general` | Container-level general (altText lives here) |

## Where They Live in JSON

Both are inside `visual`, not at the root of visual.json:

```json
{
  "$schema": "...visualContainer/2.4.0/schema.json",
  "name": "my_chart",
  "position": {"x": 0, "y": 0, "z": 0, "width": 400, "height": 300},
  "visual": {
    "visualType": "clusteredBarChart",
    "query": {"queryState": {...}},
    "objects": {
      "dataPoint": [...],
      "categoryAxis": [...],
      "legend": [...]
    },
    "visualContainerObjects": {
      "title": [...],
      "background": [...],
      "border": [...]
    }
  }
}
```

## What Goes Wrong

**Putting container properties in `objects`:** Silently ignored. The title won't show, the border won't appear. No error, just nothing happens.

**Putting `visualContainerObjects` at root level** (outside `visual`): Schema validation error.

**Forgetting to override theme defaults:** The theme may set `title.show: true` and `border.show: true` for all visuals via wildcards. If you create a textbox programmatically without explicitly setting `title.show: false` in `visualContainerObjects`, you'll get an unwanted title bar with empty text taking up space.

## Property Value Patterns

All properties in both sections use the same `expr` wrapper pattern:

```json
"title": [{
  "properties": {
    "show": {"expr": {"Literal": {"Value": "true"}}},
    "text": {"expr": {"Literal": {"Value": "'Revenue by Region'"}}},
    "fontSize": {"expr": {"Literal": {"Value": "14D"}}},
    "fontColor": {"solid": {"color": {"expr": {"ThemeDataColor": {"ColorId": 0, "Percent": -0.3}}}}}
  }
}]
```

Each property category is an array of objects, each with a `properties` key and an optional `selector`.

## Schema Version Matters

**Schemas 2.1.0 - 2.2.0:** Use `objects` for everything -- both visual-specific AND container formatting live in `objects`. There is no `visualContainerObjects` section.

**Schema 2.4.0+:** Splits them. Container properties move to `visualContainerObjects`. Visual-specific properties stay in `objects`.

Both are found in real reports. When editing an older report, container properties in `objects` are legitimate and correct for that schema version. Don't "fix" them unless upgrading the schema.

## Common Container Configurations

### Clean visual (no chrome)

```json
"visualContainerObjects": {
  "title": [{"properties": {"show": {"expr": {"Literal": {"Value": "false"}}}}}],
  "background": [{"properties": {"show": {"expr": {"Literal": {"Value": "false"}}}}}],
  "border": [{"properties": {"show": {"expr": {"Literal": {"Value": "false"}}}}}],
  "dropShadow": [{"properties": {"show": {"expr": {"Literal": {"Value": "false"}}}}}]
}
```

### Titled visual with border

```json
"visualContainerObjects": {
  "title": [{
    "properties": {
      "show": {"expr": {"Literal": {"Value": "true"}}},
      "text": {"expr": {"Literal": {"Value": "'Monthly Revenue'"}}},
      "fontSize": {"expr": {"Literal": {"Value": "14D"}}}
    }
  }],
  "border": [{
    "properties": {
      "show": {"expr": {"Literal": {"Value": "true"}}},
      "color": {"solid": {"color": {"expr": {"ThemeDataColor": {"ColorId": 0, "Percent": 0.6}}}}},
      "radius": {"expr": {"Literal": {"Value": "4D"}}}
    }
  }]
}
```

### Accessible visual (with altText)

```json
"visualContainerObjects": {
  "general": [{
    "properties": {
      "altText": {"expr": {"Literal": {"Value": "'Bar chart showing revenue by region, Q4 2024'"}}}
    }
  }]
}
```

## Theme Interaction

Container formatting is heavily influenced by the theme. The theme's `visualStyles["*"]["*"]` section sets defaults for all container properties across all visuals. Visual-type exceptions (like `visualStyles["textbox"]["*"]`) override those defaults for specific types.

When a visual's `visualContainerObjects` explicitly sets a property, it overrides the theme. When it doesn't, the theme value applies silently.

This is why a programmatically created visual can look different from what you expect -- the theme is adding titles, borders, or shadows that you didn't ask for. Always check the theme first. See [theme.md](./theme.md) for the full inheritance model.

## Related

- [theme.md](./theme.md) -- Theme wildcards and visual-type overrides
- [textbox.md](./textbox.md) -- Textbox-specific container patterns
- [schema-patterns/expressions.md](./schema-patterns/expressions.md) -- Expression syntax for property values
