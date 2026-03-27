# Selectors

Selectors define **when** and **to what** formatting properties should apply.

**Source:** formattingObjectDefinitions/1.5.0/schema.json

## Selector Structure

```json
"selector": {
  "data": [...],           // Scope by data
  "metadata": "...",       // Scope by field
  "id": "...",             // User-defined scope
  "highlightMatching": 0,  // Optional: highlight behavior
  "hierarchyMatching": 0,  // Optional: hierarchy matching
  "order": 0               // Optional: ordering
}
```

## Selector Types

### No Selector (Static)

**When to use:** Apply property to all instances globally

**Example:**
```json
"title": [{
  "properties": {
    "fontSize": {"expr": {"Literal": {"Value": "14D"}}}
  }
  // No selector - applies to entire visual title
}]
```

**Applies to:** title, legend, background, border, general

### metadata Selector (Field-Level)

**When to use:** Apply property to a specific series/field

**Structure:**
```json
"selector": {
  "metadata": "TableName.MeasureName"
}
```

**Example:**
```json
"dataPoint": [{
  "properties": {
    "fill": {
      "solid": {
        "color": {
          "expr": {"Literal": {"Value": "'#FF0000'"}}
        }
      }
    }
  },
  "selector": {
    "metadata": "Sales.Revenue"
  }
}]
```

**Behavior:** Colors the "Revenue" series red, other series use defaults

**Applies to:** Series-level formatting in multi-series charts

**Visual calculation targeting:**
- Model measures: `"metadata": "EntityName.MeasureName"`
- Visual calculations: `"metadata": "select"`

Visual calculations (NativeVisualCalculation) always have `queryRef: "select"`, making them targetable via `"metadata": "select"`.

### data Selector (Data-Driven)

**When to use:** Apply conditional formatting based on data values

**Structure:**
```json
"selector": {
  "data": [{
    "dataViewWildcard": {"matchingOption": 1}
  }]
}
```

**DataRepetitionSelector options:**

| Property | Type | Description |
|----------|------|-------------|
| dataViewWildcard | object | Match all instances/totals (MOST COMMON) |
| scopeId | expression | Match specific value (e.g., Color=Red) |
| roles | string[] | Match all fields in role |
| total | expression[] | Match totals/subtotals |
| wildcard | expression[] | (Deprecated - use roles) |

## dataViewWildcard (Critical for Conditional Formatting)

### matchingOption Values

| Value | Constant | Description | Use Case |
|-------|----------|-------------|----------|
| 0 | Identities+Totals | Match identities and totals | Series-level or identity-matched formatting; wrong when per-data-point is the goal |
| 1 | Instances only | Match instances with identities only | Per-point conditional formatting (most common) |
| 2 | Totals only | Match totals only | Total row formatting |

**CRITICAL:** Use `matchingOption: 1` for per-point conditional formatting

### Per-Point Formatting (matchingOption: 1)

**Pattern:** Two-entry array with dataViewWildcard selector

```json
"dataPoint": [
  {
    "properties": {}
  },
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
                "Property": "ColorMeasure"
              }
            }
          }
        }
      }
    },
    "selector": {
      "data": [{
        "dataViewWildcard": {"matchingOption": 1}
      }]
    }
  }
]
```

**What this does:**
- First entry: Base properties (empty or defaults)
- Second entry: Conditional properties evaluated **per data point**
- Measure "ColorMeasure" evaluated for each point individually

**Applies to:** dataPoint, lineStyles, error

### Series-Level (matchingOption: 0 or metadata)

**When entire series should have same color:**

```json
"dataPoint": [{
  "properties": {
    "fill": {
      "solid": {
        "color": {
          "expr": {"Literal": {"Value": "'#118DFF'"}}
        }
      }
    }
  },
  "selector": {
    "metadata": "Sales.Revenue"
  }
}]
```

**OR:**
```json
"selector": {
  "data": [{
    "dataViewWildcard": {"matchingOption": 0}
  }]
}
```

**Behavior:** All points in series get same color

## scopeId Selector (Specific Value)

**When to use:** Format specific category/value differently

**Example:**
```json
"selector": {
  "data": [{
    "scopeId": {
      "Comparison": {
        "ComparisonKind": 0,
        "Left": {
          "Column": {
            "Expression": {"SourceRef": {"Entity": "Products"}},
            "Property": "Category"
          }
        },
        "Right": {
          "Literal": {"Value": "'Electronics'"}
        }
      }
    }
  }]
}
```

**Behavior:** Applies property only when Category = "Electronics"

**Note:** Complex structure, rarely used manually. Usually created by Power BI UI.

## roles Selector (Role-Based)

**When to use:** Apply to all fields in a specific role

**Example:**
```json
"selector": {
  "data": [{
    "roles": ["Category"]
  }]
}
```

**Behavior:** Applies to all fields assigned to "Category" role in query

**Common roles:** Category, Values, Series, X, Y, Legend, Tooltips

## Two-Entry Array Pattern

**Required for:** Conditional formatting with measures

**Structure:**
```json
[
  {
    "properties": {
      // Base properties (static)
    }
    // No selector
  },
  {
    "properties": {
      // Conditional properties (dynamic)
    },
    "selector": {
      "data": [{
        "dataViewWildcard": {"matchingOption": 1}
      }]
    }
  }
]
```

**Why two entries?**
1. First entry: Default/fallback properties
2. Second entry: Overrides with conditional logic per point

**Objects using this pattern:**
- dataPoint
- lineStyles
- error

**Objects NOT using this pattern:**
- title (no selector support)
- legend (no selector support)
- background (no selector support)
- border (no selector support)
- categoryAxis (no selector support)
- valueAxis (no selector support)

## Advanced Properties

### highlightMatching

**Type:** number (0, 1, 2)
**Default:** 0

| Value | Description |
|-------|-------------|
| 0 | Only non-highlighted values selected |
| 1 | Non-highlighted + highlighted values selected |
| 2 | Highlighted if exists, else non-highlighted |

**Use case:** Cross-filtering scenarios in Power BI

### hierarchyMatching

**Type:** number (0, 1)
**Default:** 0

| Value | Description |
|-------|-------------|
| 0 | Only leaf levels matched |
| 1 | All levels matched |

**Use case:** Matrix visuals with hierarchy

### order

**Type:** number
**Purpose:** User-defined ordering when multiple selectors conflict

## Complete Examples

### Example 1: Red/Blue Conditional Colors

```json
"dataPoint": [
  {"properties": {}},
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
                "Property": "PosNegColor"
              }
            }
          }
        }
      }
    },
    "selector": {
      "data": [{
        "dataViewWildcard": {"matchingOption": 1}
      }]
    }
  }
]
```

**reportExtensions.json:**
```json
{
  "name": "extension",
  "entities": [{
    "name": "_Formatting",
    "measures": [{
      "name": "PosNegColor",
      "dataType": "Text",
      "expression": "IF([Value] >= 0, \"#118DFF\", \"#D64550\")"
    }]
  }]
}
```

### Example 2: Line Chart Segment Colors

```json
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
                "Property": "LineColor"
              }
            }
          }
        }
      }
    },
    "selector": {
      "data": [{
        "dataViewWildcard": {"matchingOption": 1}
      }]
    }
  }
]
```

**Note:** segmentGradient MUST be true in first entry

### Example 3: Specific Series Color

```json
"dataPoint": [{
  "properties": {
    "fill": {
      "solid": {
        "color": {
          "expr": {"Literal": {"Value": "'#FF6B35'"}}
        }
      }
    }
  },
  "selector": {
    "metadata": "Sales.Target"
  }
}]
```

**Behavior:** Target series is orange, other series use theme colors

### Example 4: Visual Calculation Targeting

**Pattern:** Format visual calculation series differently from base measure series.

**Query structure:**

```json
"Y": {
  "projections": [
    {
      "field": {"Measure": {"Expression": {"SourceRef": {"Entity": "Orders"}}, "Property": "Order Lines"}},
      "queryRef": "Orders.Order Lines"
    },
    {
      "field": {
        "NativeVisualCalculation": {
          "Expression": "IF([Order Lines] = LAST([Order Lines], ROWS), [Order Lines])",
          "Name": "Latest Period"
        }
      },
      "queryRef": "select"
    }
  ]
}
```

**Formatting:**

```json
"lineStyles": [
  {
    "properties": {
      "showMarker": {"expr": {"Literal": {"Value": "false"}}}
    }
  },
  {
    "properties": {
      "showMarker": {"expr": {"Literal": {"Value": "true"}}}
    },
    "selector": {"metadata": "select"}
  }
],
"labels": [
  {
    "properties": {
      "show": {"expr": {"Literal": {"Value": "true"}}}
    }
  },
  {
    "properties": {
      "showSeries": {"expr": {"Literal": {"Value": "false"}}}
    },
    "selector": {"metadata": "Orders.Order Lines"}
  },
  {
    "properties": {
      "showSeries": {"expr": {"Literal": {"Value": "true"}}}
    },
    "selector": {"metadata": "select"}
  }
]
```

**Result:**
- Base measure (Order Lines): No markers, no labels
- Visual calc (Latest Period): Marker shown, label shown
- Creates "spotlight" effect on latest data point

**Limitation:** All visual calculations share `queryRef: "select"` - can't distinguish between multiple visual calcs.

## Decision Tree

**Need to...**

| Goal | Selector Type | matchingOption |
|------|---------------|----------------|
| Format entire visual | None (no selector) | N/A |
| Color one specific series | metadata | N/A |
| Format visual calculation series | metadata: "select" | N/A |
| Per-point measure colors | data + dataViewWildcard | 1 |
| Series-level or identity-matched colors | data + dataViewWildcard | 0 |
| Format specific category | data + scopeId | N/A |
| Format all fields in role | data + roles | N/A |
| Format totals only | data + total | N/A |

## Common Mistakes

### Mistake 1: Wrong matchingOption for per-point formatting

**Wrong when per-data-point is the goal:**
```json
"selector": {
  "data": [{
    "dataViewWildcard": {"matchingOption": 0}
  }]
}
```

**Result:** All points in series get same color (series-level behavior, not per-point). `matchingOption: 0` is correct for series-level formatting — only wrong when you need per-data-point evaluation.

**Right for per-data-point:**
```json
"selector": {
  "data": [{
    "dataViewWildcard": {"matchingOption": 1}
  }]
}
```

**Result:** Each point evaluates measure individually

### Mistake 2: Forgetting Two-Entry Array

**Wrong:**
```json
"dataPoint": [{
  "properties": {
    "fill": {
      "solid": {
        "color": {
          "expr": {"Measure": {...}}
        }
      }
    }
  },
  "selector": {
    "data": [{
      "dataViewWildcard": {"matchingOption": 1}
    }]
  }
}]
```

**Result:** Unpredictable behavior

**Right:**
```json
"dataPoint": [
  {"properties": {}},
  {
    "properties": {
      "fill": {
        "solid": {
          "color": {
            "expr": {"Measure": {...}}
          }
        }
      }
    },
    "selector": {
      "data": [{
        "dataViewWildcard": {"matchingOption": 1}
      }]
    }
  }
]
```

### Mistake 3: Using Selector Where Not Supported

**Wrong:**
```json
"title": [{
  "properties": {
    "fontSize": {"expr": {"Literal": {"Value": "14D"}}}
  },
  "selector": {
    "data": [{
      "dataViewWildcard": {"matchingOption": 1}
    }]
  }
}]
```

**Result:** Selector ignored, property still applies globally

**Reason:** title, legend, background, border don't support selectors

## Related

- [expressions.md](expressions.md) - Measure expressions
- [visual-calculations.md](visual-calculations.md) - Visual calculation patterns and targeting
- [conditional-formatting.md](conditional-formatting.md) - Full conditional formatting guide

## Notes

- **dataViewWildcard with matchingOption: 1** is the most important selector pattern
- Enables per-point conditional formatting with measures
- Two-entry array pattern required for conditional formatting
- Most universal objects (title, legend, etc.) don't support selectors
- Visual-specific objects (dataPoint, lineStyles, error) do support selectors
- metadata selector is simpler but less flexible than data selectors
- scopeId selectors are complex and usually generated by Power BI UI
