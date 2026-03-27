# Conditional Formatting

Comprehensive guide to applying conditional formatting in Power BI reports using PBIR format.

## Overview

Three main approaches to conditional formatting:

1. **Measure-based** - DAX measure returns color/value (most flexible)
2. **FillRule gradients** - linearGradient2/3 for color scales (no DAX required)
3. **Rules-based (Conditional)** - UI-generated complex logic (most verbose)

**Key concept:** `dataViewWildcard` with `matchingOption: 1` enables per-data-point evaluation.

## Quick Reference

| Use Case | Property | Selector | Pattern |
|----------|----------|----------|---------|
| Bar/column colors | `dataPoint.fill` | `dataViewWildcard` | Measure → theme color |
| Line segment colors | `lineStyles.strokeColor` | `dataViewWildcard` | Measure → hex color |
| Data label colors | `labels.color` | `dataViewWildcard` | Measure → theme color |
| Axis label colors | `categoryAxis.labelColor` | none | Measure → theme color |
| Marker transparency | `markers.transparency` | `dataViewWildcard` | Measure → 0-100 |
| Gradient scales | `dataPoint.fill` | `dataViewWildcard` | FillRule → linearGradient2/3 |

## dataViewWildcard Selector

The key to per-data-point conditional formatting.

### matchingOption Values

| Value | Meaning | Behavior |
|-------|---------|----------|
| 0 | Match Identities and Totals | All data points including totals |
| 1 | Match Instances only | **Per data point** (most common) |
| 2 | Match Totals only | Total/subtotal rows only |

**Usage pattern:**
```json
"selector": {
  "data": [
    {
      "dataViewWildcard": {
        "matchingOption": 1
      }
    }
  ]
}
```

### Why dataViewWildcard?

**WRONG: metadata selector** - Evaluates once per series (all segments same color):
```json
"selector": {"metadata": "Sales.Revenue"}
```

**RIGHT: dataViewWildcard** - Evaluates per data point (each segment can differ):
```json
"selector": {
  "data": [{"dataViewWildcard": {"matchingOption": 1}}]
}
```

## Pattern 1: Bar/Column Fill Colors

Apply measure-based colors to bars or columns.

### Measure-Based Approach

**Extension measure returns theme color name:**
```dax
Bar Color =
VAR _Value = [Order Lines]
RETURN
    SWITCH(
        TRUE(),
        _Value < 10, "bad",
        _Value < 50, "neutral",
        "good"
    )
```

**Visual configuration:**
```json
{
  "dataPoint": [
    {
      "properties": {
        "fill": {
          "solid": {
            "color": {
              "expr": {
                "Measure": {
                  "Expression": {
                    "SourceRef": {
                      "Schema": "extension",
                      "Entity": "_Formatting"
                    }
                  },
                  "Property": "Bar Color"
                }
              }
            }
          }
        }
      },
      "selector": {
        "data": [
          {"dataViewWildcard": {"matchingOption": 1}}
        ]
      }
    }
  ]
}
```

**Theme color names:** `"bad"`, `"good"`, `"neutral"`, `"minColor"`, `"midColor"`, `"maxColor"`

### Two-Color Gradient (linearGradient2)

Two forms depending on whether you need fixed or data-relative bounds.

**Data-driven min/max** (no explicit bounds — Power BI scales to the data range):

```json
{
  "FillRule": {
    "linearGradient2": {
      "min": {
        "color": {"Literal": {"Value": "'minColor'"}}
      },
      "max": {
        "color": {"Literal": {"Value": "'maxColor'"}}
      },
      "nullColoringStrategy": {
        "strategy": {"Literal": {"Value": "'asZero'"}}
      }
    }
  }
}
```

**Explicit bounds** (fixed thresholds — use when the measure returns a known range like 0–1):

```json
{
  "FillRule": {
    "linearGradient2": {
      "min": {
        "color": {"Literal": {"Value": "'minColor'"}},
        "value": {"Literal": {"Value": "0D"}}
      },
      "max": {
        "color": {"Literal": {"Value": "'maxColor'"}},
        "value": {"Literal": {"Value": "1D"}}
      },
      "nullColoringStrategy": {
        "strategy": {"Literal": {"Value": "'asZero'"}},
        "color": {"Literal": {"Value": "'#FFFFFF'"}}
      }
    }
  }
}
```

**When to use which:**
- **Data-driven**: When the measure range varies by context and you want the gradient to always span the full visible range
- **Explicit bounds**: When the measure returns a fixed normalized range (e.g., 0–1 ratio) and you want consistent color mapping

**Properties:**
- `Input` - Measure to evaluate for gradient position
- `min.color` / `max.color` - Colors for lowest/highest values
- `min.value` / `max.value` - Optional: fixed range bounds (explicit bounds form)
- `nullColoringStrategy: 'asZero'` - Treat nulls as minimum

### Three-Color Gradient (linearGradient3)

Diverging color scheme with midpoint:

```json
{
  "FillRule": {
    "linearGradient3": {
      "min": {"color": {"Literal": {"Value": "'minColor'"}}},
      "mid": {"color": {"Literal": {"Value": "'midColor'"}}},
      "max": {"color": {"Literal": {"Value": "'maxColor'"}}},
      "nullColoringStrategy": {
        "strategy": {"Literal": {"Value": "'asZero'"}}
      }
    }
  }
}
```

**Use case:** Red-yellow-green scale for negative-neutral-positive values.

## Pattern 2: Line Chart Segment Colors

**CRITICAL: Only works with single-series line charts** (multiple series override segment colors).

### Requirements

1. Extension measure returns **hex colors** (not theme names):
```dax
Line Color =
IF(
    [Variance] < 0,
    "#D64550",  // Red
    "#118DFF"   // Blue
)
```

2. Enable segment gradient:
```json
{
  "lineStyles": [
    {
      "properties": {
        "segmentGradient": {"expr": {"Literal": {"Value": "true"}}}
      }
    }
  ]
}
```

3. Apply conditional formatting:
```json
{
  "lineStyles": [
    {
      "properties": {
        "segmentGradient": {"expr": {"Literal": {"Value": "true"}}}
      }
    },
    {
      "properties": {
        "strokeColor": {
          "solid": {
            "color": {
              "expr": {
                "Measure": {
                  "Expression": {
                    "SourceRef": {
                      "Schema": "extension",
                      "Entity": "_Formatting"
                    }
                  },
                  "Property": "Line Color"
                }
              }
            }
          }
        }
      },
      "selector": {
        "data": [{"dataViewWildcard": {"matchingOption": 1}}]
      }
    }
  ]
}
```

### Limitations

**Multi-series charts:** Segment coloring does NOT work when multiple measures in Y/Y2 projections.

**Workarounds:**
- Use separate single-series charts
- Use custom visuals (ZoomCharts, xViz)
- Accept single-color lines for multi-series

**Property limitations:** `segmentGradient` only works with `strokeColor`, not:
- NOT `lineStyle` (dash patterns)
- NOT `strokeWidth` (line thickness)
- NOT `markerFill` (marker colors)

## Pattern 3: Data Labels

Configure labels with dynamic content and conditional colors.

### Three-Entry Pattern

```json
{
  "labels": [
    // Entry 1: Base configuration
    {
      "properties": {
        "enableTitleDataLabel": {"expr": {"Literal": {"Value": "true"}}},
        "titleContentType": {"expr": {"Literal": {"Value": "'Custom'"}}},
        "enableDetailDataLabel": {"expr": {"Literal": {"Value": "true"}}},
        "enableBackground": {"expr": {"Literal": {"Value": "true"}}},
        "labelContentLayout": {"expr": {"Literal": {"Value": "'TwoLines'"}}}
      }
    },
    // Entry 2: Dynamic content
    {
      "properties": {
        "dynamicLabelTitle": {
          "expr": {
            "Measure": {
              "Expression": {"SourceRef": {"Schema": "extension", "Entity": "Customers"}},
              "Property": "Account Label"
            }
          }
        },
        "dynamicLabelDetail": {
          "expr": {
            "Measure": {
              "Expression": {"SourceRef": {"Entity": "Orders"}},
              "Property": "Order Lines"
            }
          }
        }
      },
      "selector": {
        "data": [{"dataViewWildcard": {"matchingOption": 1}}],
        "highlightMatching": 1
      }
    },
    // Entry 3: Color formatting
    {
      "properties": {
        "titleColor": {
          "solid": {
            "color": {
              "expr": {
                "Measure": {
                  "Expression": {"SourceRef": {"Schema": "extension", "Entity": "_Formatting"}},
                  "Property": "Label Color"
                }
              }
            }
          }
        },
        "color": {
          "solid": {
            "color": {
              "expr": {
                "Measure": {
                  "Expression": {"SourceRef": {"Schema": "extension", "Entity": "_Formatting"}},
                  "Property": "Background Color"
                }
              }
            }
          }
        }
      },
      "selector": {
        "data": [{"dataViewWildcard": {"matchingOption": 1}}]
      }
    }
  ]
}
```

**Label properties:**
- `titleColor` - Title line text color
- `color` - Background color
- `detailColor` - Detail line text color
- `dynamicLabelTitle` - Custom title content (measure)
- `dynamicLabelDetail` - Custom detail content (measure)

**Layout options:**
- `labelContentLayout: 'SingleLine'` - Title and detail on one line
- `labelContentLayout: 'TwoLines'` - Title and detail stacked

## Pattern 4: Axis Label Colors

Apply conditional colors to category axis labels.

```json
{
  "categoryAxis": [
    {
      "properties": {
        "labelColor": {
          "solid": {
            "color": {
              "expr": {
                "Measure": {
                  "Expression": {
                    "SourceRef": {
                      "Schema": "extension",
                      "Entity": "_Formatting"
                    }
                  },
                  "Property": "Axis Color"
                }
              }
            }
          }
        }
      }
    }
  ]
}
```

**No selector needed** - Applies to all labels, measure evaluated per label.

## Pattern 5: Marker Transparency

**WORKS:** Marker transparency supports conditional formatting.
**DOES NOT WORK:** Marker fill (color), shape, or size.

```json
{
  "markers": [
    {
      "properties": {
        "borderShow": {"expr": {"Literal": {"Value": "false"}}}
      }
    },
    {
      "properties": {
        "transparency": {
          "expr": {
            "Measure": {
              "Expression": {"SourceRef": {"Schema": "extension", "Entity": "_Measures"}},
              "Property": "Marker Opacity"
            }
          }
        }
      },
      "selector": {
        "data": [{"dataViewWildcard": {"matchingOption": 1}}]
      }
    }
  ]
}
```

**Measure returns:** 0-100 (0 = opaque, 100 = fully transparent)

**Example:**
```dax
Marker Opacity =
IF([Order Lines] < 10, 80, 0)  // Hide low values
```

## Pattern 6: Rules-Based Conditional Formatting

Complex UI-generated conditional logic - most verbose but UI-configurable.

### Basic Structure

```json
{
  "expr": {
    "Conditional": {
      "Cases": [
        {
          "Condition": { /* comparison expression */ },
          "Value": {"Literal": {"Value": "'#FF0000'"}}
        },
        {
          "Condition": { /* another condition */ },
          "Value": {"Literal": {"Value": "'#00FF00'"}}
        }
      ]
    }
  }
}
```

### ComparisonKind Values

| Value | Operator |
|-------|----------|
| 0 | Equal (==) |
| 1 | Greater than (>) |
| 2 | Greater than or equal (>=) |
| 3 | Less than or equal (<=) |
| 4 | Less than (<) |

### Aggregation Functions

| Value | Function |
|-------|----------|
| 0 | Sum |
| 1 | Avg |
| 2 | Min |
| 3 | Max |
| 4 | Count |
| 5 | DistinctCount |

### Example: Top 10% Rule

```json
{
  "Conditional": {
    "Cases": [
      {
        "Condition": {
          "Comparison": {
            "ComparisonKind": 2,
            "Left": {
              "Measure": {
                "Expression": {"SourceRef": {"Entity": "Sales"}},
                "Property": "Revenue"
              }
            },
            "Right": {
              "RangePercent": {
                "Min": {
                  "ScopedEval": {
                    "Expression": {
                      "Aggregation": {
                        "Expression": {
                          "ScopedEval": {
                            "Expression": {
                              "Measure": {
                                "Expression": {"SourceRef": {"Entity": "Sales"}},
                                "Property": "Revenue"
                              }
                            },
                            "Scope": [{"AllRolesRef": {}}]
                          }
                        },
                        "Function": 3
                      }
                    },
                    "Scope": []
                  }
                },
                "Max": {
                  "ScopedEval": {
                    "Expression": {
                      "Aggregation": {
                        "Expression": {
                          "ScopedEval": {
                            "Expression": {
                              "Measure": {
                                "Expression": {"SourceRef": {"Entity": "Sales"}},
                                "Property": "Revenue"
                              }
                            },
                            "Scope": [{"AllRolesRef": {}}]
                          }
                        },
                        "Function": 4
                      }
                    },
                    "Scope": []
                  }
                },
                "Percent": 0.9
              }
            }
          }
        },
        "Value": {"Literal": {"Value": "'#2f9e44'"}}
      }
    ]
  }
}
```

**Translation:** If Revenue > (MAX - MIN) * 0.9 + MIN, color green.

### Logical Operators

**And:**
```json
{
  "And": {
    "Left": { /* condition 1 */ },
    "Right": { /* condition 2 */ }
  }
}
```

**Or:**
```json
{
  "Or": {
    "Left": { /* condition 1 */ },
    "Right": { /* condition 2 */ }
  }
}
```

### ScopedEval with AllRolesRef

Removes all filters for MIN/MAX calculation:

```json
{
  "ScopedEval": {
    "Expression": { /* measure */ },
    "Scope": [{"AllRolesRef": {}}]  // ALL context
  }
}
```

**Use case:** Calculate global min/max regardless of filters.

## When to Use Each Approach

| Approach | Best For | Pros | Cons |
|----------|----------|------|------|
| **Measure-based** | Custom logic, theme colors | Full DAX flexibility, readable | Requires DAX knowledge |
| **linearGradient2/3** | Simple color scales | No DAX, UI configurable | Limited to gradients |
| **Rules-based** | UI configuration | Power BI UI support | Verbose JSON, hard to read |

## Common Issues

**Colors not applying:**
- Verify `matchingOption: 1` (not 0 or 2)
- Check measure data type (Text for colors)
- Ensure proper color format (hex for lines, theme names for bars)

**All segments same color:**
- Using `metadata` selector instead of `dataViewWildcard`
- Missing selector entirely

**Multi-series line charts:**
- Segment coloring only works with single series
- Multiple measures override segment colors

**Marker colors not working:**
- Marker fill/shape/size do NOT support conditional formatting
- Use transparency instead (works)

## Performance Considerations

- Measures evaluate once per data point
- Simple IF/SWITCH statements have minimal impact
- Complex DAX with multiple calculations can slow rendering
- Consider pre-calculating in a column for expensive logic

## Complete Example

Bar chart with comprehensive conditional formatting:

```json
{
  "visualType": "clusteredBarChart",
  "objects": {
    "dataPoint": [
      {
        "properties": {
          "fill": {
            "solid": {
              "color": {
                "expr": {
                  "Measure": {
                    "Expression": {"SourceRef": {"Schema": "extension", "Entity": "_Formatting"}},
                    "Property": "Bar Color"
                  }
                }
              }
            }
          }
        },
        "selector": {
          "data": [{"dataViewWildcard": {"matchingOption": 1}}]
        }
      }
    ],
    "labels": [
      {
        "properties": {
          "enableTitleDataLabel": {"expr": {"Literal": {"Value": "true"}}},
          "titleContentType": {"expr": {"Literal": {"Value": "'Custom'"}}}
        }
      },
      {
        "properties": {
          "dynamicLabelTitle": {
            "expr": {
              "Measure": {
                "Expression": {"SourceRef": {"Schema": "extension", "Entity": "Customers"}},
                "Property": "Label Text"
              }
            }
          }
        },
        "selector": {
          "data": [{"dataViewWildcard": {"matchingOption": 1}}]
        }
      },
      {
        "properties": {
          "color": {
            "solid": {
              "color": {
                "expr": {
                  "Measure": {
                    "Expression": {"SourceRef": {"Schema": "extension", "Entity": "_Formatting"}},
                    "Property": "Label Color"
                  }
                }
              }
            }
          }
        },
        "selector": {
          "data": [{"dataViewWildcard": {"matchingOption": 1}}]
        }
      }
    ],
    "categoryAxis": [
      {
        "properties": {
          "labelColor": {
            "solid": {
              "color": {
                "expr": {
                  "Measure": {
                    "Expression": {"SourceRef": {"Schema": "extension", "Entity": "_Formatting"}},
                    "Property": "Axis Color"
                  }
                }
              }
            }
          }
        }
      }
    ]
  }
}
```

## Properties That Support Conditional Formatting

Not every property can accept a measure expression. These properties support measure-based or rule-based conditional formatting (from the pbir object model):

`fill`, `borderColor`, `defaultColor`, `fontColor`, `color`, `backgroundColor`, `lineColor`, `markerColor`, `strokeColor`, `text`, `titleText`, `fontSize`, `strokeWidth`, `weight`, `transparency`, `radius`, `url`, `good`, `bad`, `neutral`, `target`, `icon`

Properties NOT listed here only accept literal values or ThemeDataColor -- they cannot be driven by measures.

### Data Bars (tables/matrices)

Tables and matrices support data bars via the `dataBars` property on column formatting:

```json
"dataBars": {
  "positiveColor": {"solid": {"color": {"expr": {"Literal": {"Value": "'#E1EBF2'"}}}}},
  "negativeColor": {"solid": {"color": {"expr": {"Literal": {"Value": "'#E5B97D'"}}}}},
  "axisColor": {"solid": {"color": {"expr": {"Literal": {"Value": "'#FFFFFF'"}}}}},
  "reverseDirection": {"expr": {"Literal": {"Value": "false"}}},
  "hideText": {"expr": {"Literal": {"Value": "false"}}}
}
```

### Conditional Icons

Icons use the `Conditional` expression returning icon set names:

```json
"icon": {
  "kind": "Icon",
  "layout": {"expr": {"Literal": {"Value": "'IconOnly'"}}},
  "value": {
    "expr": {
      "Conditional": {
        "Cases": [
          {
            "Condition": {"Comparison": {"ComparisonKind": 4, "Left": {"Measure": {...}}, "Right": {"Literal": {"Value": "0D"}}}},
            "Value": {"Literal": {"Value": "'SymbolMedium'"}}
          }
        ]
      }
    }
  }
}
```

## Related Documentation

- [measures.md](../measures.md) - Creating extension measures
- [expressions.md](./expressions.md) - Expression format reference
- [selectors.md](./selectors.md) - Selector patterns
- [apply-advanced-conditional-formatting.md](../how-to/apply-advanced-conditional-formatting.md) - Step-by-step guide
