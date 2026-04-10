# Vega-Lite Chart Patterns for Deneb

Common chart patterns for Deneb visuals. All specs assume `"data": {"name": "dataset"}` and Vega-Lite v6 (bundled in Deneb 1.8+).

## Bar Chart (Vertical)

```json
{
  "$schema": "https://vega.github.io/schema/vega-lite/v6.json",
  "data": {"name": "dataset"},
  "mark": {"type": "bar", "tooltip": true, "cornerRadiusTopLeft": 4, "cornerRadiusTopRight": 4},
  "encoding": {
    "x": {"field": "Category", "type": "nominal", "sort": "-y"},
    "y": {"field": "Sales", "type": "quantitative"},
    "color": {"value": {"expr": "pbiColor(0)"}}
  }
}
```

## Bar Chart (Horizontal)

```json
{
  "$schema": "https://vega.github.io/schema/vega-lite/v6.json",
  "data": {"name": "dataset"},
  "mark": {"type": "bar", "tooltip": true, "cornerRadiusTopRight": 4, "cornerRadiusBottomRight": 4},
  "encoding": {
    "y": {"field": "Category", "type": "nominal", "sort": "-x"},
    "x": {"field": "Sales", "type": "quantitative"}
  }
}
```

## Bar Chart with Cross-Highlighting

Two-layer pattern: background shows full value at reduced opacity, foreground shows highlighted portion.

```json
{
  "$schema": "https://vega.github.io/schema/vega-lite/v6.json",
  "data": {"name": "dataset"},
  "layer": [
    {
      "mark": {"type": "bar", "opacity": 0.3, "tooltip": true},
      "encoding": {"x": {"field": "Sales"}}
    },
    {
      "mark": {"type": "bar", "tooltip": true},
      "encoding": {
        "x": {"field": "Sales__highlight"},
        "opacity": {
          "condition": {"test": {"field": "__selected__", "equal": "off"}, "value": 0},
          "value": 1
        }
      }
    }
  ],
  "encoding": {
    "y": {"field": "Category", "type": "nominal"},
    "x": {"type": "quantitative"}
  }
}
```

Requires `enableHighlight: true` and `enableSelection: true` in visual objects.

## Line Chart

```json
{
  "$schema": "https://vega.github.io/schema/vega-lite/v6.json",
  "data": {"name": "dataset"},
  "mark": {"type": "line", "point": true, "tooltip": true, "strokeWidth": 2},
  "encoding": {
    "x": {"field": "Date", "type": "temporal"},
    "y": {"field": "Sales", "type": "quantitative"},
    "color": {"field": "Region", "type": "nominal", "scale": {"scheme": "pbiColorNominal"}}
  }
}
```

## Line Chart with Area Fill

```json
{
  "$schema": "https://vega.github.io/schema/vega-lite/v6.json",
  "data": {"name": "dataset"},
  "mark": {"type": "area", "opacity": 0.15, "line": {"strokeWidth": 2}, "tooltip": true},
  "encoding": {
    "x": {"field": "Date", "type": "temporal"},
    "y": {"field": "Value", "type": "quantitative"},
    "color": {"field": "Series", "type": "nominal", "scale": {"scheme": "pbiColorNominal"}}
  }
}
```

## Scatter Plot

```json
{
  "$schema": "https://vega.github.io/schema/vega-lite/v6.json",
  "data": {"name": "dataset"},
  "mark": {"type": "point", "tooltip": true, "filled": true, "opacity": 0.7},
  "encoding": {
    "x": {"field": "Revenue", "type": "quantitative"},
    "y": {"field": "Profit", "type": "quantitative"},
    "size": {"field": "Quantity", "type": "quantitative"},
    "color": {"field": "Category", "type": "nominal", "scale": {"scheme": "pbiColorNominal"}}
  }
}
```

## Heatmap

```json
{
  "$schema": "https://vega.github.io/schema/vega-lite/v6.json",
  "data": {"name": "dataset"},
  "mark": {"type": "rect", "tooltip": true},
  "encoding": {
    "x": {"field": "Day", "type": "ordinal"},
    "y": {"field": "Hour", "type": "ordinal"},
    "color": {"field": "Value", "type": "quantitative", "scale": {"scheme": "pbiColorLinear"}}
  }
}
```

## Donut Chart

```json
{
  "$schema": "https://vega.github.io/schema/vega-lite/v6.json",
  "data": {"name": "dataset"},
  "mark": {"type": "arc", "innerRadius": 50, "tooltip": true},
  "encoding": {
    "theta": {"field": "Sales", "type": "quantitative", "stack": true},
    "color": {"field": "Category", "type": "nominal", "scale": {"scheme": "pbiColorNominal"}},
    "order": {"field": "Sales", "type": "quantitative", "sort": "descending"}
  }
}
```

## Bullet Chart (Faceted with Target)

```json
{
  "$schema": "https://vega.github.io/schema/vega-lite/v6.json",
  "data": {"name": "dataset"},
  "transform": [
    {"window": [{"op": "rank", "as": "rank"}], "sort": [{"field": "Value", "order": "descending"}]},
    {"filter": "datum.rank <= 10"}
  ],
  "facet": {
    "row": {
      "field": "Category", "type": "nominal",
      "sort": {"field": "Value", "order": "descending"},
      "header": {"labelAngle": 0, "title": "", "labelAlign": "left"}
    }
  },
  "spec": {
    "layer": [
      {"mark": {"type": "bar", "color": {"expr": "pbiColor(0, 0.7)"}, "size": 10}, "encoding": {"x": {"field": "Value", "type": "quantitative"}}},
      {"mark": {"type": "tick", "size": 25, "color": {"expr": "pbiColor(0, -0.5)"}}, "encoding": {"x": {"field": "Target", "type": "quantitative"}}},
      {"mark": {"type": "text", "align": "right", "dx": -5}, "encoding": {"x": {"value": -15}, "text": {"field": "Value", "format": ",.0f"}, "color": {"value": {"expr": "pbiColor(0, -0.3)"}}}}
    ]
  }
}
```

## Lollipop Chart

```json
{
  "$schema": "https://vega.github.io/schema/vega-lite/v6.json",
  "data": {"name": "dataset"},
  "encoding": {
    "y": {"field": "Category", "type": "nominal", "sort": "-x"},
    "x": {"field": "Value", "type": "quantitative"}
  },
  "layer": [
    {"mark": {"type": "rule", "strokeWidth": 2, "color": {"expr": "pbiColor(0)"}}},
    {"mark": {"type": "point", "filled": true, "size": 100, "color": {"expr": "pbiColor(0)"}}}
  ]
}
```

## Stacked Bar Chart

```json
{
  "$schema": "https://vega.github.io/schema/vega-lite/v6.json",
  "data": {"name": "dataset"},
  "mark": {"type": "bar", "tooltip": true},
  "encoding": {
    "x": {"field": "Date", "type": "temporal"},
    "y": {"field": "Sales", "type": "quantitative"},
    "color": {"field": "Region", "type": "nominal", "scale": {"scheme": "pbiColorNominal"}}
  }
}
```

## Waterfall Chart

```json
{
  "$schema": "https://vega.github.io/schema/vega-lite/v6.json",
  "data": {"name": "dataset"},
  "transform": [
    {"window": [{"op": "sum", "field": "Amount", "as": "sum"}]},
    {"window": [{"op": "lead", "field": "Category", "as": "lead"}]},
    {"calculate": "datum.lead === null ? datum.Category : datum.lead", "as": "lead"},
    {"calculate": "datum.Category === 'Total' ? 0 : datum.sum - datum.Amount", "as": "previous_sum"},
    {"calculate": "datum.Category === 'Total' ? datum.sum : datum.Amount", "as": "amount"},
    {"calculate": "(datum.Category !== 'Begin' && datum.Category !== 'Total' && datum.amount > 0 ? '+' : '') + datum.amount", "as": "text_amount"},
    {"calculate": "(datum.sum + datum.previous_sum) / 2", "as": "center"},
    {"calculate": "datum.sum < datum.previous_sum ? datum.sum : ''", "as": "sum_dec"},
    {"calculate": "datum.sum > datum.previous_sum ? datum.sum : ''", "as": "sum_inc"}
  ],
  "encoding": {
    "x": {"field": "Category", "type": "ordinal", "sort": null}
  },
  "layer": [
    {
      "mark": {"type": "bar", "size": 45},
      "encoding": {
        "y": {"field": "previous_sum", "type": "quantitative", "title": "Amount"},
        "y2": {"field": "sum"},
        "color": {
          "condition": [
            {"test": "datum.Category === 'Begin' || datum.Category === 'Total'", "value": {"expr": "pbiColor(0)"}},
            {"test": "datum.sum < datum.previous_sum", "value": {"expr": "pbiColor('negative')"}}
          ],
          "value": {"expr": "pbiColor('positive')"}
        }
      }
    },
    {
      "mark": {"type": "text", "dy": -4, "baseline": "bottom"},
      "encoding": {
        "y": {"field": "sum_inc", "type": "quantitative"},
        "text": {"field": "sum_inc", "type": "nominal"}
      }
    }
  ]
}
```

## Sparkline (Small Multiple)

```json
{
  "$schema": "https://vega.github.io/schema/vega-lite/v6.json",
  "data": {"name": "dataset"},
  "facet": {"row": {"field": "Category", "type": "nominal", "header": {"labelAngle": 0, "title": ""}}},
  "spec": {
    "width": 200,
    "height": 30,
    "mark": {"type": "line", "strokeWidth": 1.5, "color": {"expr": "pbiColor(0)"}},
    "encoding": {
      "x": {"field": "Date", "type": "temporal", "axis": null},
      "y": {"field": "Value", "type": "quantitative", "axis": null, "scale": {"zero": false}}
    }
  }
}
```

## Standard Config

Use `examples/standard-config.json` as a ready-to-use config file with any of the above specs. Key settings: `autosize: fit`, `view.stroke: transparent`, `font: Segoe UI`, clean axis styling.

## Vega (Full) -- Basic Bar

For cases requiring signals, events, or fine-grained control:

```json
{
  "$schema": "https://vega.github.io/schema/vega/v5.json",
  "data": [{"name": "dataset"}],
  "padding": 5,
  "width": {"signal": "pbiContainerWidth - 25"},
  "height": {"signal": "pbiContainerHeight - 27"},
  "scales": [
    {"name": "xscale", "type": "band", "domain": {"data": "dataset", "field": "Category"}, "range": "width", "padding": 0.1},
    {"name": "yscale", "type": "linear", "domain": {"data": "dataset", "field": "Sales"}, "range": "height", "nice": true}
  ],
  "marks": [
    {
      "type": "rect",
      "from": {"data": "dataset"},
      "encode": {
        "enter": {
          "x": {"scale": "xscale", "field": "Category"},
          "width": {"scale": "xscale", "band": 1},
          "y": {"scale": "yscale", "field": "Sales"},
          "y2": {"scale": "yscale", "value": 0},
          "fill": {"signal": "pbiColor(0)"}
        }
      }
    }
  ]
}
```

Note: In Vega, `data` is an **array** `[{"name": "dataset"}]`, not an object. Use `pbiContainerWidth`/`pbiContainerHeight` signals for responsive sizing.
