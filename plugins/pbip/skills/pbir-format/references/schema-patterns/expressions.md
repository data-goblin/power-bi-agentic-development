# Expression Patterns

**Source:** `schemas/semanticQuery/1.4.0/schema.json`

ALL visual properties use the `expr` field with one of these types.

## Literal Expressions

Static values with type-specific formatting.

### String Literals

```json
"expr": {"Literal": {"Value": "'smooth'"}}
```

**Format Rules:**
- Single quotes INSIDE double quotes
- Pattern: `"'value'"`

**Examples from actual visuals:**
- `"'smooth'"` (lineChart.lineChartType)
- `"'straight'"` (lineChart.lineChartType)
- `"'stepped'"` (lineChart.lineChartType)

### Numeric Literals

```json
"expr": {"Literal": {"Value": "50D"}}
```

**Format Rules:**
- Must include type suffix
- No quotes around the value
- Common suffixes:
  - `D` - Decimal/double (most common)
  - `L` - Long integer
  - `M` - Money/decimal

**Examples from actual visuals:**
- `"8D"` (lineChart.lineStyles.markerSize)
- `"31D"` (lineChart.categoryAxis.end)
- `"85D"` (lineChart.dataPoint.transparency)
- `"10D"` (barChart.error.barWidth)
- `"0L"` (barChart.error.barBorderSize)

### Boolean Literals

```json
"expr": {"Literal": {"Value": "true"}}
```

**Format Rules:**
- Lowercase only: `true` or `false`
- No quotes

**Examples from actual visuals:**
- `"true"` (lineChart.lineStyles.showMarker)
- `"true"` (lineChart.lineStyles.segmentGradient)
- `"false"` (barChart.error.barMatchSeriesColor)

### Color Literals (Hex)

```json
"expr": {"Literal": {"Value": "'#FF0000'"}}
```

**Format Rules:**
- Inner single quotes around hex code: `"'#RRGGBB'"`
- 6-digit RGB: `"'#1971c2'"`
- 8-digit ARGB: `"'#80FF0000'"` (first two digits = alpha)
- Case-insensitive

### DateTime Literals

```json
"expr": {"Literal": {"Value": "datetime'2024-01-15T00:00:00.000000'"}}
```

### Null Literals

```json
"expr": {"Literal": {"Value": "null"}}
```

Lowercase, no quotes, no suffix. Used in Conditional expressions to test for null values.

### String Escaping

Single quotes within string literals are escaped by doubling:
```json
"expr": {"Literal": {"Value": "'here''s some text'"}}
```

Font families with fallback chains use triple-quote escaping:
```json
"expr": {"Literal": {"Value": "'''Segoe UI Semibold'', helvetica, sans-serif'"}}
```

### D vs L Gotchas

Both `D` and `L` work for whole numbers but are NOT interchangeable everywhere:
- `transparency` uses `D` normally BUT `L` inside `dropShadow`
- `labelPrecision` always uses `L`; `labelDisplayUnits` always uses `D`
- `fontSize` always uses `D`; `shadowBlur`/`shadowSpread`/`shadowDistance` always use `L`

## Measure Expressions

Reference DAX measures (model or extension).

### Model Measure

From semantic model:

```json
"expr": {
  "Measure": {
    "Expression": {
      "SourceRef": {
        "Entity": "Budget"
      }
    },
    "Property": "Budget vs. Turnover (%)"
  }
}
```

### Extension Measure

From reportExtensions.json:

```json
"expr": {
  "Measure": {
    "Expression": {
      "SourceRef": {
        "Schema": "extension",
        "Entity": "_Demo of SVG Measures"
      }
    },
    "Property": "Formatting"
  }
}
```

**Key difference:** `Schema: "extension"` field present

**Examples from actual visuals:**
- Used in lineChart.dataPoint.fill.solid.color (conditional formatting)
- Used in lineChart.lineStyles.strokeColor.solid.color (per-segment colors)

## ThemeDataColor Expressions

Reference colors from report theme.

```json
"expr": {
  "ThemeDataColor": {
    "ColorId": 1,
    "Percent": 0
  }
}
```

**Parameters:**
- `ColorId`: Index into theme's dataColors array (0-based)
- `Percent`: Tint/shade adjustment (-1.0 to 1.0; negative = darker, positive = lighter, 0 = exact)

**Examples from actual visuals:**
- `{"ColorId": 1, "Percent": 0}` (barChart.error.barColor)

## Column Expressions

Reference table columns.

```json
"expr": {
  "Column": {
    "Expression": {
      "SourceRef": {
        "Entity": "Date"
      }
    },
    "Property": "Calendar Month (ie Jan)"
  }
}
```

**Examples from actual visuals:**
- Used in query.queryState.Category projections

## FillRule Expressions

**Gradient-based conditional formatting** using numeric measure values.

**CRITICAL**: Different from Measure expressions that return discrete colors.

### linearGradient2 Pattern

Maps numeric measure values (0-1) to color gradients:

```json
"expr": {
  "FillRule": {
    "Input": {
      "Measure": {
        "Expression": {
          "SourceRef": {
            "Schema": "extension",
            "Entity": "On-Time Delivery"
          }
        },
        "Property": "Cond. Color"
      }
    },
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
}
```

**Two forms of linearGradient2:**

**Explicit bounds** (fixed thresholds — min/max at known values like 0–1):
- Include `"value"` on `min` and `max` to pin the gradient range

**Data-driven min/max** (relative to data — omit `value` bounds):
- Omit `"value"` on `min` and `max`; Power BI derives bounds from the data automatically

The example above uses explicit bounds (`0D` to `1D`). For data-driven, remove the `value` entries from `min` and `max`. See [conditional-formatting.md](../schema-patterns/conditional-formatting.md) for the data-driven pattern.

**Structure:**
- `Input.Measure` - Returns numeric value (e.g., 0.75 for 75%)
- `min.color` - Theme color reference for minimum value (e.g., 'minColor', 'badColor')
- `max.color` - Theme color reference for maximum value (e.g., 'maxColor', 'goodColor')
- `min.value` / `max.value` - Optional numeric range bounds (explicit bounds form only; typically 0D and 1D)
- `nullColoringStrategy.strategy` - How to handle BLANK():
  - `'asZero'` - Treat null as 0
  - `'specificColor'` - Use specified color
- `nullColoringStrategy.color` - Color to use if strategy is 'specificColor'

**DAX Measure Pattern:**
```dax
Cond. Color =
DIVIDE([OTD % (Value)], 1, 0)  // Returns 0-1 value
```

**Color Mapping:**
- 0D → minColor
- 0.5D → interpolated mid-color
- 1D → maxColor
- BLANK() → Handled per nullColoringStrategy

**Comparison with Measure Colors:**

| Pattern | Measure Returns | Use Case |
|---------|----------------|----------|
| Measure (discrete) | Color string (e.g., "#1971c2") | Fixed colors per data point |
| FillRule (gradient) | Numeric value (e.g., 0.75) | Smooth color gradients |

**Examples from actual visuals:**
- listSlicer.fillCustom.fillColor (background gradient)
- listSlicer.value.fontColor (text gradient)
- listSlicer.accentBar.color (accent bar gradient)

### linearGradient3 Pattern

Maps numeric measure values to three-point color gradients (min, mid, max):

```json
"expr": {
  "FillRule": {
    "Input": {
      "Measure": {
        "Expression": {
          "SourceRef": {
            "Entity": "Sales"
          }
        },
        "Property": "Sales Amount vs. PY (Δ)"
      }
    },
    "FillRule": {
      "linearGradient3": {
        "min": {
          "color": {"Literal": {"Value": "'#f0a787'"}},
          "value": {"Literal": {"Value": "0D"}}
        },
        "mid": {
          "color": {"Literal": {"Value": "'#FFFFFF'"}},
          "value": {"Literal": {"Value": "0D"}}
        },
        "max": {
          "color": {"Literal": {"Value": "'#999999'"}},
          "value": {"Literal": {"Value": "0D"}}
        },
        "nullColoringStrategy": {
          "strategy": {"Literal": {"Value": "'asZero'"}}
        }
      }
    }
  }
}
```

**Structure:**
- `min`, `mid`, `max` - Three-point gradient with colors and values
- `nullColoringStrategy` - How to handle BLANK() values

**Examples from actual visuals:**
- Custom bullet chart visual dataPoint.fill (per-point gradient)
- Table visual values.fontColor (text color gradient)

## Conditional Expressions

**Complex conditional logic** with multiple cases, comparisons, and boolean operators.

**CRITICAL**: Different from FillRule gradients. Conditional expressions evaluate multiple explicit conditions in order.

### Basic Structure

```json
"expr": {
  "Conditional": {
    "Cases": [
      {
        "Condition": {
          "Comparison": {
            "ComparisonKind": 0,
            "Left": {
              "Measure": {
                "Expression": {"SourceRef": {"Entity": "Sales"}},
                "Property": "Sales Amount vs. PY (%)"
              }
            },
            "Right": {
              "Literal": {"Value": "null"}
            }
          }
        },
        "Value": {
          "Literal": {"Value": "'#b3b3b3'"}
        }
      },
      {
        "Condition": {
          "Comparison": {
            "ComparisonKind": 4,
            "Left": {
              "Measure": {
                "Expression": {"SourceRef": {"Entity": "Sales"}},
                "Property": "Sales Amount vs. PY (%)"
              }
            },
            "Right": {
              "Literal": {"Value": "-0.5D"}
            }
          }
        },
        "Value": {
          "Literal": {"Value": "'#ad5129'"}
        }
      }
    ]
  }
}
```

### Comparison Kinds

ComparisonKind values:

| Value | Operator | Example |
|-------|----------|---------|
| 0 | `==` (equals) | `x == null` |
| 1 | `>` (greater than) | `x > 0.5` |
| 2 | `>=` (greater than or equal) | `x >= -0.25` |
| 3 | `<=` (less than or equal) | `x <= 0.25` |
| 4 | `<` (less than) | `x < -0.5` |

### Compound Conditions (AND)

Combine multiple conditions using `And`:

```json
"Condition": {
  "And": {
    "Left": {
      "Comparison": {
        "ComparisonKind": 2,
        "Left": {
          "Measure": {
            "Expression": {"SourceRef": {"Entity": "Sales"}},
            "Property": "Sales Amount vs. PY (%)"
          }
        },
        "Right": {
          "Literal": {"Value": "-0.25D"}
        }
      }
    },
    "Right": {
      "Comparison": {
        "ComparisonKind": 3,
        "Left": {
          "Measure": {
            "Expression": {"SourceRef": {"Entity": "Sales"}},
            "Property": "Sales Amount vs. PY (%)"
          }
        },
        "Right": {
          "Literal": {"Value": "0.25D"}
        }
      }
    }
  }
}
```

**Evaluates:** `(x >= -0.25) AND (x <= 0.25)`

### Complete Example

Table cell text color with multiple conditions:

```json
{
  "properties": {
    "fontColor": {
      "solid": {
        "color": {
          "expr": {
            "Conditional": {
              "Cases": [
                {
                  "Condition": {
                    "Comparison": {
                      "ComparisonKind": 0,
                      "Left": {
                        "Measure": {
                          "Expression": {"SourceRef": {"Entity": "Sales"}},
                          "Property": "Sales Amount vs. PY (%)"
                        }
                      },
                      "Right": {
                        "Literal": {"Value": "null"}
                      }
                    }
                  },
                  "Value": {
                    "Literal": {"Value": "'#b3b3b3'"}
                  }
                },
                {
                  "Condition": {
                    "And": {
                      "Left": {
                        "Comparison": {
                          "ComparisonKind": 2,
                          "Left": {
                            "Measure": {
                              "Expression": {"SourceRef": {"Entity": "Sales"}},
                              "Property": "Sales Amount vs. PY (%)"
                            }
                          },
                          "Right": {
                            "Literal": {"Value": "-0.25D"}
                          }
                        }
                      },
                      "Right": {
                        "Comparison": {
                          "ComparisonKind": 3,
                          "Left": {
                            "Measure": {
                              "Expression": {"SourceRef": {"Entity": "Sales"}},
                              "Property": "Sales Amount vs. PY (%)"
                            }
                          },
                          "Right": {
                            "Literal": {"Value": "0.25D"}
                          }
                        }
                      }
                    }
                  },
                  "Value": {
                    "Literal": {"Value": "'#b3b3b3'"}
                  }
                },
                {
                  "Condition": {
                    "Comparison": {
                      "ComparisonKind": 1,
                      "Left": {
                        "Measure": {
                          "Expression": {"SourceRef": {"Entity": "Sales"}},
                          "Property": "Sales Amount vs. PY (%)"
                        }
                      },
                      "Right": {
                        "Literal": {"Value": "0.5D"}
                      }
                    }
                  },
                  "Value": {
                    "Literal": {"Value": "'#12239E'"}
                  }
                },
                {
                  "Condition": {
                    "Comparison": {
                      "ComparisonKind": 4,
                      "Left": {
                        "Measure": {
                          "Expression": {"SourceRef": {"Entity": "Sales"}},
                          "Property": "Sales Amount vs. PY (%)"
                        }
                      },
                      "Right": {
                        "Literal": {"Value": "-0.5D"}
                      }
                    }
                  },
                  "Value": {
                    "Literal": {"Value": "'#ad5129'"}
                  }
                }
              ]
            }
          }
        }
      }
    }
  },
  "selector": {
    "data": [
      {
        "dataViewWildcard": {
          "matchingOption": 0
        }
      }
    ],
    "metadata": "Product.Category"
  }
}
```

**Logic:**
1. If value is null → Gray (#b3b3b3)
2. If -0.25 <= value <= 0.25 → Gray (#b3b3b3)
3. If value > 0.5 → Dark blue (#12239E)
4. If value < -0.5 → Red (#ad5129)

### Evaluation Order

Cases are evaluated **in order** from first to last. The first matching condition wins.

### Use Cases

**Conditional vs. FillRule:**

| Pattern | Best For | Example |
|---------|----------|---------|
| Conditional | Discrete color bands with explicit thresholds | Red if < -50%, Orange if < -25%, Green if > 50% |
| FillRule | Smooth gradients across numeric range | Gradient from red (0) to green (1) |

**Examples from actual visuals:**
- tableEx.values.fontColor (text color with discrete bands)
- Custom visuals with complex business logic
- Multi-condition formatting with AND/OR logic

## Nested Structures

Some properties require nested expr structures:

### Color Properties

```json
"strokeColor": {
  "solid": {
    "color": {
      "expr": {
        "Measure": {...}  // or Literal, ThemeDataColor, FillRule
      }
    }
  }
}
```

## Common Mistakes

| Error | Cause | Fix |
|-------|-------|-----|
| `"smooth"` in JSON | Missing inner quotes | Use `"'smooth'"` |
| `"Value": 50` | Missing D suffix | Use `"50D"` |
| `"Value": "true"` | Quotes around boolean | Use `true` (no quotes) |
| `"Value": "True"` | Wrong case | Use `true` (lowercase) |
| Measure not found | Missing Schema field | Add `"Schema": "extension"` for report measures |

## Schema Definition Path

Full specification: `schemas/semanticQuery/1.4.0/schema.json` → `definitions.QueryExpressionContainer`

Available expression types (from schema):
- Literal
- Column
- Measure
- Aggregation
- PropertyVariationSource
- HierarchyLevel
- HierarchyLevelAggr
- And
- Or
- Not
- In
- Compare
- Contains
- StartsWith
- Exists
- Arithmetic
- FillRule
- ResourcePackageItem
- ScopedEval
- WithRef
- TransformTableRef
- TransformOutputRoleRef
- SelectRef
- Percentile
- Conditional
