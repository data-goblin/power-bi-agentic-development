# Visual-Type Override Patterns

Patterns for `visualStyles["<type>"]["*"]` sections in a Power BI theme. Each entry overrides the wildcard `["*"]["*"]` defaults for that specific visual type. Properties omitted here inherit from the wildcard.

**Always verify property names before using them.** The examples in this file are based on the SQLBI/Data Goblins example theme and the `pbir schema` CLI. Use the following to discover and confirm correct property names:

```bash
# List all containers for a visual type
pbir schema containers lineChart

# Describe exact properties in a container (with types and constraints)
pbir schema describe lineChart.valueAxis

# Check the official schema for complete reference
# https://github.com/microsoft/powerbi-desktop-samples/tree/main/Report%20Theme%20JSON%20Schema
```

**Common naming gotchas:**
- Matrix visuals use `pivotTable` as the theme key — not `matrix`
- Slicers use `textSize` for font size — not `fontSize`
- KPI trend is `trendline` (lowercase L) — not `trendLine`
- Table/matrix column color is `backColor` — not `backgroundColor`
- Card value/label color property is `color` — not `fontColor`

---

## When to Add a Visual-Type Override

Add a visual-type section when:
- The visual type needs different container chrome than the wildcard (e.g., textboxes shouldn't have titles)
- The visual type has a consistent default for chart-specific properties (e.g., all line charts should show legend at the bottom)
- Wildcard defaults are generally correct but one visual type is an exception

Do NOT add a visual-type section just to duplicate the wildcard — redundant sections are noise.

---

## Container / Decorative Visuals

### `textbox`

Text containers should have no visual chrome — title, border, background, and shadow all suppress.

```json
"textbox": {
  "*": {
    "title": [{"show": false}],
    "subTitle": [{"show": false}],
    "background": [{"show": false}],
    "border": [{"show": false}],
    "dropShadow": [{"show": false}],
    "divider": [{"show": false}]
  }
}
```

### `image`

Images are content, not data visuals. Suppress all container chrome.

```json
"image": {
  "*": {
    "title": [{"show": false}],
    "subTitle": [{"show": false}],
    "background": [{"show": false}],
    "border": [{"show": false}],
    "dropShadow": [{"show": false}]
  }
}
```

### `shape`

Geometric shapes (rectangles, lines, circles) are design elements — no titles or shadows.

```json
"shape": {
  "*": {
    "title": [{"show": false}],
    "background": [{"show": false}],
    "border": [{"show": false}],
    "dropShadow": [{"show": false}]
  }
}
```

### `actionButton`

Buttons have their own visual style system. Suppress the generic container chrome.

```json
"actionButton": {
  "*": {
    "title": [{"show": false}],
    "background": [{"show": false}],
    "border": [{"show": false}],
    "dropShadow": [{"show": false}]
  }
}
```

---

## KPI and Card Visuals

### `card`

Cards typically display a single metric. The category label is often redundant if the title is set.

```json
"card": {
  "*": {
    "labels": [{
      "fontSize": 32,
      "fontFamily": "Segoe UI Semibold",
      "color": {"solid": {"color": {"ThemeDataColor": {"ColorId": 0, "Percent": 0}}}}
    }],
    "categoryLabels": [{
      "show": true,
      "fontSize": 12,
      "fontFamily": "Segoe UI",
      "color": {"solid": {"color": {"ThemeDataColor": {"ColorId": 0, "Percent": 0.4}}}}
    }]
  }
}
```

### `kpi`

KPI visuals show a value, trend, and goal. Suppress goal text if redundant; ensure indicator font is large enough.

```json
"kpi": {
  "*": {
    "indicator": [{
      "fontSize": 36,
      "fontFamily": "Segoe UI Semibold"
    }],
    "trendline": [{
      "show": true
    }],
    "goals": [{
      "show": true
    }]
  }
}
```

### `multiRowCard`

```json
"multiRowCard": {
  "*": {
    "cardTitle": [{
      "fontSize": 12,
      "fontFamily": "Segoe UI Semibold"
    }],
    "dataLabels": [{
      "fontSize": 12,
      "fontFamily": "Segoe UI"
    }],
    "bar": [{"show": false}]
  }
}
```

---

## Slicer Visuals

### `slicer`

Slicers need item and header font set to match the report's typography. Note: slicer uses `textSize` (not `fontSize`) for item and header font sizes.

```json
"slicer": {
  "*": {
    "items": [{
      "textSize": 12,
      "fontFamily": "Segoe UI",
      "fontColor": {"solid": {"color": {"ThemeDataColor": {"ColorId": 0, "Percent": 0}}}}
    }],
    "header": [{
      "show": true,
      "textSize": 12,
      "fontFamily": "Segoe UI Semibold",
      "fontColor": {"solid": {"color": {"ThemeDataColor": {"ColorId": 0, "Percent": 0}}}}
    }]
  },
  "hover": {
    "items": [{
      "fontColor": {"solid": {"color": {"ThemeDataColor": {"ColorId": 1, "Percent": 0}}}}
    }]
  }
}
```

### `advancedSlicerVisual`

The newer slicer visual type. Uses the same `textSize` property for font sizes.

```json
"advancedSlicerVisual": {
  "*": {
    "items": [{
      "textSize": 12,
      "fontFamily": "Segoe UI"
    }],
    "header": [{
      "show": true,
      "textSize": 12,
      "fontFamily": "Segoe UI Semibold"
    }]
  }
}
```

---

## Chart Visuals

### `lineChart`

Legend at the bottom is more readable than the right-side default. Minimize axis clutter.

```json
"lineChart": {
  "*": {
    "legend": [{
      "show": true,
      "position": "Bottom",
      "fontSize": 11,
      "fontFamily": "Segoe UI"
    }],
    "categoryAxis": [{
      "show": true,
      "fontSize": 11,
      "fontFamily": "Segoe UI"
    }],
    "valueAxis": [{
      "show": true,
      "fontSize": 11,
      "fontFamily": "Segoe UI",
      "gridlineColor": {"solid": {"color": "#e9ecef"}},
      "gridlineThickness": 1
    }],
    "labels": [{"show": false}]
  }
}
```

### `barChart` / `columnChart` / `clusteredBarChart`

```json
"barChart": {
  "*": {
    "legend": [{
      "show": true,
      "position": "Bottom",
      "fontSize": 11,
      "fontFamily": "Segoe UI"
    }],
    "categoryAxis": [{
      "show": true,
      "fontSize": 11,
      "fontFamily": "Segoe UI"
    }],
    "valueAxis": [{
      "show": false
    }],
    "labels": [{"show": false}]
  }
}
```

> Apply similar patterns to `clusteredBarChart`, `stackedBarChart`, `columnChart`, `clusteredColumnChart`, `stackedColumnChart` — they share the same property schema.

### `scatterChart`

```json
"scatterChart": {
  "*": {
    "legend": [{"show": true, "position": "Bottom"}],
    "categoryAxis": [{"show": true, "fontSize": 11}],
    "valueAxis": [{"show": true, "fontSize": 11}],
    "labels": [{"show": false}]
  }
}
```

### `areaChart`

```json
"areaChart": {
  "*": {
    "legend": [{"show": true, "position": "Bottom"}],
    "categoryAxis": [{"show": true, "fontSize": 11}],
    "valueAxis": [{"show": true, "start": "0", "fontSize": 11}],
    "labels": [{"show": false}]
  }
}
```

---

## Table and Matrix Visuals

### `tableEx`

Tables benefit from clean column headers and readable row text. Alternating row color aids readability.

```json
"tableEx": {
  "*": {
    "columnHeaders": [{
      "fontSize": 12,
      "fontFamily": "Segoe UI Semibold",
      "fontColor": {"solid": {"color": {"ThemeDataColor": {"ColorId": 0, "Percent": 0}}}},
      "backColor": {"solid": {"color": {"ThemeDataColor": {"ColorId": 0, "Percent": 0.9}}}}
    }],
    "values": [{
      "fontSize": 11,
      "fontFamily": "Segoe UI",
      "fontColorPrimary": {"solid": {"color": {"ThemeDataColor": {"ColorId": 0, "Percent": 0}}}},
      "backColorPrimary": {"solid": {"color": {"ThemeDataColor": {"ColorId": 0, "Percent": 1}}}},
      "fontColorSecondary": {"solid": {"color": {"ThemeDataColor": {"ColorId": 0, "Percent": 0}}}},
      "backColorSecondary": {"solid": {"color": {"ThemeDataColor": {"ColorId": 0, "Percent": 0.95}}}}
    }],
    "total": [{
      "fontSize": 12,
      "fontFamily": "Segoe UI Semibold"
    }],
    "grid": [{
      "gridVertical": false,
      "gridHorizontalWeight": 1,
      "gridHorizontalColor": {"solid": {"color": {"ThemeDataColor": {"ColorId": 0, "Percent": 0.85}}}}
    }]
  }
}
```

### `pivotTable`

The theme key for matrix visuals is `pivotTable` — not `matrix`. Using `matrix` will silently have no effect.

```json
"pivotTable": {
  "*": {
    "columnHeaders": [{
      "fontSize": 12,
      "fontFamily": "Segoe UI Semibold",
      "fontColor": {"solid": {"color": {"ThemeDataColor": {"ColorId": 0, "Percent": 0}}}},
      "backColor": {"solid": {"color": {"ThemeDataColor": {"ColorId": 0, "Percent": 0.9}}}}
    }],
    "rowHeaders": [{
      "fontSize": 11,
      "fontFamily": "Segoe UI",
      "fontColor": {"solid": {"color": {"ThemeDataColor": {"ColorId": 0, "Percent": 0}}}},
      "backColor": {"solid": {"color": {"ThemeDataColor": {"ColorId": 0, "Percent": 1}}}},
      "stepped": true,
      "steppedLayoutIndentation": 16
    }],
    "values": [{
      "fontSize": 11,
      "fontFamily": "Segoe UI",
      "backColorPrimary": {"solid": {"color": {"ThemeDataColor": {"ColorId": 0, "Percent": 1}}}},
      "backColorSecondary": {"solid": {"color": {"ThemeDataColor": {"ColorId": 0, "Percent": 0.95}}}}
    }],
    "total": [{
      "fontSize": 12,
      "fontFamily": "Segoe UI Semibold"
    }],
    "grid": [{
      "gridVertical": false,
      "gridHorizontalWeight": 1
    }]
  }
}
```

---

## Gauge and Other Visuals

### `gauge`

```json
"gauge": {
  "*": {
    "calloutValue": [{
      "fontSize": 24,
      "fontFamily": "Segoe UI Semibold"
    }],
    "labels": [{"show": true, "fontSize": 11}]
  }
}
```

### `treemap`

```json
"treemap": {
  "*": {
    "legend": [{"show": true, "position": "Bottom"}],
    "labels": [{"show": true, "fontSize": 11}]
  }
}
```

---

## Tips

- **Order of sections:** Put the wildcard `"*"` section first, then visual-type sections in alphabetical order for maintainability.
- **Avoid over-specifying:** Only set properties that differ from the wildcard or that you explicitly want locked for that type. Every property you add is one more thing to maintain.
- **Test each override** after adding it — deploy and check the visual type in Power BI Desktop or Service to confirm the override applies as expected.
- **ThemeDataColor vs hex in `visualStyles`:** Use `{"solid": {"color": {"ThemeDataColor": {"ColorId": N, "Percent": 0}}}}` for colors that should stay linked to the palette. Use bare hex strings only for colors that are intentionally fixed regardless of the palette.
