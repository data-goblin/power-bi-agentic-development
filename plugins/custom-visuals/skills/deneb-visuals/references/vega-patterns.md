# Vega Chart Patterns for Deneb

Common Vega chart patterns for Power BI Deneb visuals. All specs use `"data": [{"name": "dataset"}]` (array form) and Vega v6 (bundled in Deneb 1.8+). Use `pbiContainerWidth` / `pbiContainerHeight` signals for responsive sizing and `pbiColor()` for theme colors.

## Vega Spec Anatomy

Every Vega spec follows this structure:

```json
{
  "$schema": "https://vega.github.io/schema/vega/v6.json",
  "data": [{"name": "dataset"}],
  "width": {"signal": "pbiContainerWidth - 25"},
  "height": {"signal": "pbiContainerHeight - 27"},
  "padding": 5,
  "signals": [],
  "scales": [],
  "axes": [],
  "legends": [],
  "marks": []
}
```

Key differences from Vega-Lite:
- `data` is an **array** of named datasets, not a single object
- Scales, axes, legends are explicit (not inferred from encoding)
- Marks use `encode` blocks with `enter`/`update`/`hover` sets
- Signals enable reactive variables, events, and interactions
- Transforms are defined inside data entries, not at top level
- Full control over every visual element

## Encode Blocks

Marks use three encoding sets:

| Set | When Applied |
|-----|-------------|
| `enter` | First time a mark is rendered (initial values) |
| `update` | Every re-render (reactive to data/signal changes) |
| `hover` | On pointer hover (optional, reverts to `update` on exit) |

Values reference scales, fields, signals, or constants:

```json
"encode": {
  "enter": {
    "x": {"scale": "xscale", "field": "Category"},
    "fill": {"signal": "pbiColor(0)"}
  },
  "update": {
    "fillOpacity": {"value": 1}
  },
  "hover": {
    "fillOpacity": {"value": 0.5}
  }
}
```

## Bar Chart (Vertical)

```json
{
  "$schema": "https://vega.github.io/schema/vega/v6.json",
  "data": [{"name": "dataset"}],
  "padding": 5,
  "width": {"signal": "pbiContainerWidth - 25"},
  "height": {"signal": "pbiContainerHeight - 27"},
  "scales": [
    {
      "name": "xscale",
      "type": "band",
      "domain": {"data": "dataset", "field": "Category"},
      "range": "width",
      "padding": 0.1,
      "round": true
    },
    {
      "name": "yscale",
      "type": "linear",
      "domain": {"data": "dataset", "field": "Sales"},
      "range": "height",
      "nice": true,
      "zero": true
    }
  ],
  "axes": [
    {"orient": "bottom", "scale": "xscale"},
    {"orient": "left", "scale": "yscale"}
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
          "cornerRadiusTopLeft": {"value": 4},
          "cornerRadiusTopRight": {"value": 4}
        },
        "update": {
          "fill": {"signal": "pbiColor(0)"}
        },
        "hover": {
          "fill": {"signal": "pbiColor(0, -0.3)"}
        }
      }
    }
  ]
}
```

## Bar Chart (Horizontal)

```json
{
  "$schema": "https://vega.github.io/schema/vega/v6.json",
  "data": [{"name": "dataset"}],
  "padding": 5,
  "width": {"signal": "pbiContainerWidth - 25"},
  "height": {"signal": "pbiContainerHeight - 27"},
  "scales": [
    {
      "name": "yscale",
      "type": "band",
      "domain": {"data": "dataset", "field": "Category", "sort": {"op": "max", "field": "Sales", "order": "descending"}},
      "range": "height",
      "padding": 0.1
    },
    {
      "name": "xscale",
      "type": "linear",
      "domain": {"data": "dataset", "field": "Sales"},
      "range": "width",
      "nice": true,
      "zero": true
    }
  ],
  "axes": [
    {"orient": "bottom", "scale": "xscale"},
    {"orient": "left", "scale": "yscale"}
  ],
  "marks": [
    {
      "type": "rect",
      "from": {"data": "dataset"},
      "encode": {
        "enter": {
          "y": {"scale": "yscale", "field": "Category"},
          "height": {"scale": "yscale", "band": 1},
          "x": {"scale": "xscale", "field": "Sales"},
          "x2": {"scale": "xscale", "value": 0},
          "cornerRadiusTopRight": {"value": 4},
          "cornerRadiusBottomRight": {"value": 4}
        },
        "update": {
          "fill": {"signal": "pbiColor(0)"}
        },
        "hover": {
          "fill": {"signal": "pbiColor(0, -0.3)"}
        }
      }
    }
  ]
}
```

## Line Chart (Multi-Series)

```json
{
  "$schema": "https://vega.github.io/schema/vega/v6.json",
  "data": [{"name": "dataset"}],
  "padding": 5,
  "width": {"signal": "pbiContainerWidth - 25"},
  "height": {"signal": "pbiContainerHeight - 27"},
  "scales": [
    {
      "name": "x",
      "type": "point",
      "domain": {"data": "dataset", "field": "Date"},
      "range": "width"
    },
    {
      "name": "y",
      "type": "linear",
      "domain": {"data": "dataset", "field": "Value"},
      "range": "height",
      "nice": true,
      "zero": true
    },
    {
      "name": "color",
      "type": "ordinal",
      "domain": {"data": "dataset", "field": "Series"},
      "range": {"scheme": "pbiColorNominal"}
    }
  ],
  "axes": [
    {"orient": "bottom", "scale": "x"},
    {"orient": "left", "scale": "y"}
  ],
  "legends": [
    {"stroke": "color", "orient": "top", "direction": "horizontal"}
  ],
  "marks": [
    {
      "type": "group",
      "from": {
        "facet": {
          "name": "series",
          "data": "dataset",
          "groupby": "Series"
        }
      },
      "marks": [
        {
          "type": "line",
          "from": {"data": "series"},
          "encode": {
            "enter": {
              "x": {"scale": "x", "field": "Date"},
              "y": {"scale": "y", "field": "Value"},
              "stroke": {"scale": "color", "field": "Series"},
              "strokeWidth": {"value": 2}
            },
            "update": {
              "interpolate": {"value": "monotone"},
              "strokeOpacity": {"value": 1}
            },
            "hover": {
              "strokeOpacity": {"value": 0.5}
            }
          }
        }
      ]
    }
  ]
}
```

## Scatter Plot

```json
{
  "$schema": "https://vega.github.io/schema/vega/v6.json",
  "data": [{"name": "dataset"}],
  "padding": 5,
  "width": {"signal": "pbiContainerWidth - 25"},
  "height": {"signal": "pbiContainerHeight - 27"},
  "scales": [
    {
      "name": "x",
      "type": "linear",
      "domain": {"data": "dataset", "field": "Revenue"},
      "range": "width",
      "nice": true,
      "zero": true
    },
    {
      "name": "y",
      "type": "linear",
      "domain": {"data": "dataset", "field": "Profit"},
      "range": "height",
      "nice": true,
      "zero": true
    },
    {
      "name": "size",
      "type": "linear",
      "domain": {"data": "dataset", "field": "Quantity"},
      "range": [16, 400],
      "zero": true
    },
    {
      "name": "color",
      "type": "ordinal",
      "domain": {"data": "dataset", "field": "Category"},
      "range": {"scheme": "pbiColorNominal"}
    }
  ],
  "axes": [
    {"orient": "bottom", "scale": "x", "grid": true, "domain": false, "title": "Revenue"},
    {"orient": "left", "scale": "y", "grid": true, "domain": false, "title": "Profit"}
  ],
  "marks": [
    {
      "type": "symbol",
      "from": {"data": "dataset"},
      "encode": {
        "enter": {
          "x": {"scale": "x", "field": "Revenue"},
          "y": {"scale": "y", "field": "Profit"},
          "size": {"scale": "size", "field": "Quantity"},
          "shape": {"value": "circle"},
          "fill": {"scale": "color", "field": "Category"},
          "opacity": {"value": 0.7},
          "tooltip": {"signal": "datum"}
        },
        "hover": {
          "opacity": {"value": 1},
          "strokeWidth": {"value": 2},
          "stroke": {"value": "#333"}
        }
      }
    }
  ]
}
```

## Donut Chart

```json
{
  "$schema": "https://vega.github.io/schema/vega/v6.json",
  "data": [
    {
      "name": "dataset",
      "transform": [
        {"type": "pie", "field": "Sales", "sort": true}
      ]
    }
  ],
  "width": {"signal": "pbiContainerWidth"},
  "height": {"signal": "pbiContainerHeight"},
  "autosize": "none",
  "scales": [
    {
      "name": "color",
      "type": "ordinal",
      "domain": {"data": "dataset", "field": "Category"},
      "range": {"scheme": "pbiColorNominal"}
    }
  ],
  "legends": [
    {"fill": "color", "orient": "right"}
  ],
  "marks": [
    {
      "type": "arc",
      "from": {"data": "dataset"},
      "encode": {
        "enter": {
          "x": {"signal": "pbiContainerWidth / 2"},
          "y": {"signal": "pbiContainerHeight / 2"},
          "fill": {"scale": "color", "field": "Category"},
          "startAngle": {"field": "startAngle"},
          "endAngle": {"field": "endAngle"},
          "innerRadius": {"signal": "min(pbiContainerWidth, pbiContainerHeight) * 0.25"},
          "outerRadius": {"signal": "min(pbiContainerWidth, pbiContainerHeight) * 0.45"},
          "cornerRadius": {"value": 2},
          "tooltip": {"signal": "datum"}
        },
        "update": {
          "fillOpacity": {"value": 1}
        },
        "hover": {
          "fillOpacity": {"value": 0.8}
        }
      }
    }
  ]
}
```

## Stacked Bar Chart

```json
{
  "$schema": "https://vega.github.io/schema/vega/v6.json",
  "data": [
    {
      "name": "dataset",
      "transform": [
        {
          "type": "stack",
          "groupby": ["Date"],
          "sort": {"field": "Region"},
          "field": "Sales"
        }
      ]
    }
  ],
  "padding": 5,
  "width": {"signal": "pbiContainerWidth - 25"},
  "height": {"signal": "pbiContainerHeight - 27"},
  "scales": [
    {
      "name": "x",
      "type": "band",
      "domain": {"data": "dataset", "field": "Date"},
      "range": "width"
    },
    {
      "name": "y",
      "type": "linear",
      "domain": {"data": "dataset", "field": "y1"},
      "range": "height",
      "nice": true,
      "zero": true
    },
    {
      "name": "color",
      "type": "ordinal",
      "domain": {"data": "dataset", "field": "Region"},
      "range": {"scheme": "pbiColorNominal"}
    }
  ],
  "axes": [
    {"orient": "bottom", "scale": "x"},
    {"orient": "left", "scale": "y"}
  ],
  "legends": [
    {"fill": "color", "orient": "top", "direction": "horizontal"}
  ],
  "marks": [
    {
      "type": "rect",
      "from": {"data": "dataset"},
      "encode": {
        "enter": {
          "x": {"scale": "x", "field": "Date"},
          "width": {"scale": "x", "band": 1, "offset": -1},
          "y": {"scale": "y", "field": "y0"},
          "y2": {"scale": "y", "field": "y1"},
          "fill": {"scale": "color", "field": "Region"}
        },
        "update": {
          "fillOpacity": {"value": 1}
        },
        "hover": {
          "fillOpacity": {"value": 0.7}
        }
      }
    }
  ]
}
```

## Heatmap

```json
{
  "$schema": "https://vega.github.io/schema/vega/v6.json",
  "data": [{"name": "dataset"}],
  "padding": 5,
  "width": {"signal": "pbiContainerWidth - 25"},
  "height": {"signal": "pbiContainerHeight - 27"},
  "scales": [
    {
      "name": "x",
      "type": "band",
      "domain": {"data": "dataset", "field": "Day"},
      "range": "width"
    },
    {
      "name": "y",
      "type": "band",
      "domain": {"data": "dataset", "field": "Hour"},
      "range": "height"
    },
    {
      "name": "color",
      "type": "linear",
      "domain": {"data": "dataset", "field": "Value"},
      "range": {"scheme": "pbiColorLinear"},
      "zero": false,
      "nice": true
    }
  ],
  "axes": [
    {"orient": "bottom", "scale": "x", "domain": false, "ticks": false},
    {"orient": "left", "scale": "y", "domain": false, "ticks": false}
  ],
  "legends": [
    {"fill": "color", "type": "gradient", "gradientLength": {"signal": "height - 16"}}
  ],
  "marks": [
    {
      "type": "rect",
      "from": {"data": "dataset"},
      "encode": {
        "enter": {
          "x": {"scale": "x", "field": "Day"},
          "width": {"scale": "x", "band": 1},
          "y": {"scale": "y", "field": "Hour"},
          "height": {"scale": "y", "band": 1},
          "fill": {"scale": "color", "field": "Value"},
          "tooltip": {"signal": "datum"}
        }
      }
    }
  ]
}
```

## Area Chart

```json
{
  "$schema": "https://vega.github.io/schema/vega/v6.json",
  "data": [{"name": "dataset"}],
  "padding": 5,
  "width": {"signal": "pbiContainerWidth - 25"},
  "height": {"signal": "pbiContainerHeight - 27"},
  "scales": [
    {
      "name": "x",
      "type": "point",
      "domain": {"data": "dataset", "field": "Date"},
      "range": "width"
    },
    {
      "name": "y",
      "type": "linear",
      "domain": {"data": "dataset", "field": "Value"},
      "range": "height",
      "nice": true,
      "zero": true
    }
  ],
  "axes": [
    {"orient": "bottom", "scale": "x"},
    {"orient": "left", "scale": "y"}
  ],
  "marks": [
    {
      "type": "area",
      "from": {"data": "dataset"},
      "encode": {
        "enter": {
          "x": {"scale": "x", "field": "Date"},
          "y": {"scale": "y", "field": "Value"},
          "y2": {"scale": "y", "value": 0},
          "fill": {"signal": "pbiColor(0)"},
          "interpolate": {"value": "monotone"}
        },
        "update": {
          "fillOpacity": {"value": 0.6}
        },
        "hover": {
          "fillOpacity": {"value": 0.3}
        }
      }
    },
    {
      "type": "line",
      "from": {"data": "dataset"},
      "encode": {
        "enter": {
          "x": {"scale": "x", "field": "Date"},
          "y": {"scale": "y", "field": "Value"},
          "stroke": {"signal": "pbiColor(0)"},
          "strokeWidth": {"value": 2},
          "interpolate": {"value": "monotone"}
        }
      }
    }
  ]
}
```

## Lollipop Chart

```json
{
  "$schema": "https://vega.github.io/schema/vega/v6.json",
  "data": [{"name": "dataset"}],
  "padding": 5,
  "width": {"signal": "pbiContainerWidth - 25"},
  "height": {"signal": "pbiContainerHeight - 27"},
  "scales": [
    {
      "name": "yscale",
      "type": "band",
      "domain": {"data": "dataset", "field": "Category", "sort": {"op": "max", "field": "Value", "order": "descending"}},
      "range": "height",
      "padding": 0.3
    },
    {
      "name": "xscale",
      "type": "linear",
      "domain": {"data": "dataset", "field": "Value"},
      "range": "width",
      "nice": true,
      "zero": true
    }
  ],
  "axes": [
    {"orient": "bottom", "scale": "xscale"},
    {"orient": "left", "scale": "yscale", "ticks": false, "domain": false}
  ],
  "marks": [
    {
      "type": "rule",
      "from": {"data": "dataset"},
      "encode": {
        "enter": {
          "y": {"scale": "yscale", "field": "Category", "band": 0.5},
          "x": {"scale": "xscale", "value": 0},
          "x2": {"scale": "xscale", "field": "Value"},
          "stroke": {"signal": "pbiColor(0)"},
          "strokeWidth": {"value": 2}
        }
      }
    },
    {
      "type": "symbol",
      "from": {"data": "dataset"},
      "encode": {
        "enter": {
          "y": {"scale": "yscale", "field": "Category", "band": 0.5},
          "x": {"scale": "xscale", "field": "Value"},
          "fill": {"signal": "pbiColor(0)"},
          "size": {"value": 100},
          "shape": {"value": "circle"}
        }
      }
    }
  ]
}
```

## Cross-Filtering Pattern (Vega)

When `enableSelection` is true, use `__selected__` to control mark opacity:

```json
"marks": [
  {
    "type": "rect",
    "from": {"data": "dataset"},
    "encode": {
      "update": {
        "fillOpacity": [
          {"test": "datum.__selected__ == 'off'", "value": 0.3},
          {"value": 1}
        ]
      }
    }
  }
]
```

## Available Transforms

Key Vega transforms useful in Deneb:

| Transform | Purpose |
|-----------|---------|
| `aggregate` | Group and summarize data |
| `bin` | Discretize numeric values |
| `collect` | Sort data objects |
| `filter` | Filter with predicate expression |
| `flatten` | Expand array fields |
| `fold` | Pivot columns to key/value pairs |
| `formula` | Compute derived fields |
| `joinaggregate` | Add aggregate values without grouping |
| `lookup` | Join datasets by key |
| `pie` | Compute angular layout |
| `stack` | Compute stacked positions |
| `window` | Running calculations (rank, lag, lead) |
| `wordcloud` | Word cloud layout |
| `force` | Force-directed layout |
| `tree` | Tree layout (node-link) |
| `treemap` | Treemap layout |
| `voronoi` | Voronoi diagram |

## Scale Types Quick Reference

| Type | Domain | Range | Use |
|------|--------|-------|-----|
| `linear` | Continuous | Continuous | Quantitative axes |
| `log` | Continuous (>0) | Continuous | Exponential data |
| `pow` | Continuous | Continuous | Power transforms |
| `time` / `utc` | Temporal | Continuous | Date axes |
| `band` | Discrete | Continuous | Bar chart categories |
| `point` | Discrete | Continuous | Scatter/line categories |
| `ordinal` | Discrete | Discrete | Color by category |
| `quantize` | Continuous | Discrete | Choropleth bins |
| `threshold` | Arbitrary cuts | Discrete | Custom breakpoints |

## Bullet Chart (Faceted with Target)

Faceted bar + tick mark pattern adapted from a real Power BI report. Each row shows a category with a value bar and a prior-year target tick:

```json
{
  "$schema": "https://vega.github.io/schema/vega/v6.json",
  "data": [
    {
      "name": "dataset",
      "transform": [
        {"type": "window", "ops": ["rank"], "as": ["rank"], "sort": {"field": "Value", "order": "descending"}},
        {"type": "filter", "expr": "datum.rank <= 10"}
      ]
    },
    {
      "name": "faceted",
      "source": "dataset",
      "transform": [
        {"type": "collect", "sort": {"field": "Value", "order": "descending"}}
      ]
    }
  ],
  "width": {"signal": "pbiContainerWidth - 25"},
  "height": {"signal": "pbiContainerHeight - 27"},
  "padding": 5,
  "scales": [
    {
      "name": "yscale",
      "type": "band",
      "domain": {"data": "faceted", "field": "Category"},
      "range": "height",
      "padding": 0.3
    },
    {
      "name": "xscale",
      "type": "linear",
      "domain": {"data": "faceted", "fields": ["Value", "Target"]},
      "range": "width",
      "nice": true,
      "zero": true
    }
  ],
  "axes": [
    {"orient": "bottom", "scale": "xscale", "tickCount": 5},
    {"orient": "left", "scale": "yscale", "ticks": false, "domain": false}
  ],
  "marks": [
    {
      "type": "rect",
      "from": {"data": "faceted"},
      "encode": {
        "enter": {
          "y": {"scale": "yscale", "field": "Category", "band": 0.25},
          "height": {"scale": "yscale", "band": 0.5},
          "x": {"scale": "xscale", "value": 0},
          "x2": {"scale": "xscale", "field": "Value"},
          "fill": {"signal": "pbiColor(0, 0.7)"},
          "cornerRadiusTopRight": {"value": 2},
          "cornerRadiusBottomRight": {"value": 2}
        }
      }
    },
    {
      "type": "rule",
      "from": {"data": "faceted"},
      "encode": {
        "enter": {
          "y": {"scale": "yscale", "field": "Category", "band": 0.1},
          "y2": {"scale": "yscale", "field": "Category", "band": 0.9},
          "x": {"scale": "xscale", "field": "Target"},
          "stroke": {"signal": "pbiColor(0, -0.5)"},
          "strokeWidth": {"value": 2}
        }
      }
    },
    {
      "type": "text",
      "from": {"data": "faceted"},
      "encode": {
        "enter": {
          "y": {"scale": "yscale", "field": "Category", "band": 0.5},
          "x": {"scale": "xscale", "field": "Value", "offset": 5},
          "text": {"signal": "format(datum.Value, ',.0f')"},
          "fill": {"signal": "pbiColor(0, -0.3)"},
          "baseline": {"value": "middle"},
          "fontSize": {"value": 10}
        }
      }
    }
  ]
}
```

Fields: `Category` (nominal), `Value` (quantitative -- current), `Target` (quantitative -- comparison).

## KPI Card (Layered Text)

Multi-line KPI display showing a headline value, subtitle, and percentage change:

```json
{
  "$schema": "https://vega.github.io/schema/vega/v6.json",
  "data": [
    {
      "name": "dataset",
      "transform": [
        {"type": "formula", "as": "change", "expr": "(datum.Value - datum.Target) / datum.Target"}
      ]
    }
  ],
  "width": {"signal": "pbiContainerWidth"},
  "height": {"signal": "pbiContainerHeight"},
  "autosize": "none",
  "marks": [
    {
      "type": "text",
      "from": {"data": "dataset"},
      "encode": {
        "enter": {
          "x": {"signal": "width / 2"},
          "y": {"value": 30},
          "text": {"value": "Value vs Target"},
          "fill": {"value": "#666666"},
          "fontSize": {"value": 14},
          "align": {"value": "center"},
          "baseline": {"value": "middle"}
        }
      }
    },
    {
      "type": "text",
      "from": {"data": "dataset"},
      "encode": {
        "enter": {
          "x": {"signal": "width / 2"},
          "y": {"signal": "height / 2"},
          "text": {"signal": "format(datum.Value, ',.0f')"},
          "fill": [
            {"test": "datum.change >= 0", "signal": "pbiColor(0)"},
            {"signal": "pbiColor('negative')"}
          ],
          "fontSize": {"value": 48},
          "fontWeight": {"value": "bold"},
          "align": {"value": "center"},
          "baseline": {"value": "middle"}
        }
      }
    },
    {
      "type": "text",
      "from": {"data": "dataset"},
      "encode": {
        "enter": {
          "x": {"signal": "width / 2"},
          "y": {"signal": "height / 2 + 45"},
          "text": {"signal": "format(datum.change, '+.1%')"},
          "fill": [
            {"test": "datum.change >= 0", "signal": "pbiColor(0)"},
            {"signal": "pbiColor('negative')"}
          ],
          "fontSize": {"value": 16},
          "align": {"value": "center"},
          "baseline": {"value": "middle"}
        }
      }
    }
  ]
}
```

Fields: `Value` (quantitative -- current), `Target` (quantitative -- comparison).

## Standard Config

Recommended config for all Vega and Vega-Lite specs in Power BI:

```json
{
  "autosize": {"type": "fit", "contains": "padding"},
  "view": {"stroke": "transparent"},
  "font": "Segoe UI",
  "axis": {
    "ticks": false,
    "grid": false,
    "domain": false,
    "labelFontSize": 11,
    "titleFontSize": 12
  },
  "axisQuantitative": {
    "tickCount": 5,
    "grid": true,
    "gridColor": "#E8E8E8",
    "gridDash": [2, 4]
  },
  "legend": {
    "orient": "top",
    "labelFontSize": 11
  },
  "title": {
    "fontSize": 14,
    "font": "Segoe UI Semibold",
    "anchor": "start"
  }
}
```
