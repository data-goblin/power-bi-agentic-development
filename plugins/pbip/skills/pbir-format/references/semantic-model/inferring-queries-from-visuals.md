# Inferring DAX queries from visual metadata

Visual queries are `SUMMARIZECOLUMNS` queries. You can infer the query by looking at the visual's metadata.

## Basic structure

```dax
DEFINE
    MEASURE 'ExtTable'[ExtMeasure] = <expr>  -- If visual uses reportExtensions.json measures

EVALUATE
SUMMARIZECOLUMNS(
    'Table'[GroupingColumn],
    'Table'[SortColumn],           -- Auto-added if column has sortByColumn
    __FilterTable,                 -- From filters
    "MeasureAlias", Table[Measure]
)
```

## Mapping: Visual metadata → DAX query

### 1. Projections → Columns and measures

**Location:** `visual.query.queryState.<Role>.projections`

**Column projection:**

```json
{
  "field": {
    "Column": {
      "Expression": {"SourceRef": {"Entity": "Date"}},
      "Property": "Month"
    }
  }
}
```

→ `'Date'[Month]` in SUMMARIZECOLUMNS grouping

**Measure projection:**

```json
{
  "field": {
    "Measure": {
      "Expression": {"SourceRef": {"Entity": "Sales"}},
      "Property": "Revenue"
    }
  }
}
```

→ `"Revenue", 'Sales'[Revenue]` in SUMMARIZECOLUMNS

**Extension measure projection:**

```json
{
  "field": {
    "Measure": {
      "Expression": {
        "SourceRef": {
          "Schema": "extension",
          "Entity": "ExtTable"
        }
      },
      "Property": "ExtMeasure"
    }
  }
}
```

→ Added to DEFINE section AND included in SUMMARIZECOLUMNS

### 2. Data roles by visual type

| Visual | Grouping Roles | Measure Roles |
|--------|----------------|---------------|
| Card | - | Values |
| Line/Column Chart | Category | Y |
| Bar Chart | Category | Y |
| Slicer | Values | - |
| KPI | TrendLine | Indicator, Goal |
| Table | Values (dims) | Values (measures) |
| Scatter | X, Y | Size, Gradient |

### 3. Filters → Variables

**Page/visual filters** → TREATAS variables (you typically won't see these in metadata, only in query traces)

### 4. Extension measures → DEFINE

Any measure from `reportExtensions.json` that appears in the visual → added to DEFINE section with full expression.

Look for `"Schema": "extension"` in measure references.

## Examples

### Card

**Metadata:**

```json
{
  "visualType": "card",
  "query": {
    "queryState": {
      "Values": {
        "projections": [{
          "field": {
            "Measure": {
              "Expression": {"SourceRef": {"Entity": "Sales"}},
              "Property": "Total Revenue"
            }
          }
        }]
      }
    }
  }
}
```

**Query:**

```dax
EVALUATE
SUMMARIZECOLUMNS(
    "Total_Revenue", IGNORE('Sales'[Total Revenue])
)
```

Note: Cards use `IGNORE()` since there are no grouping columns.

### Line chart

**Metadata:**

```json
{
  "visualType": "lineChart",
  "query": {
    "queryState": {
      "Category": {
        "projections": [{
          "field": {
            "Column": {
              "Expression": {"SourceRef": {"Entity": "Date"}},
              "Property": "Month"
            }
          }
        }]
      },
      "Y": {
        "projections": [{
          "field": {
            "Measure": {
              "Expression": {"SourceRef": {"Entity": "Orders"}},
              "Property": "Order Lines"
            }
          }
        }]
      }
    }
  }
}
```

**Query:**

```dax
EVALUATE
SUMMARIZECOLUMNS(
    'Date'[Month],
    'Date'[Month Number],  -- Sort column (auto-added if exists in model)
    "Order_Lines", 'Orders'[Order Lines]
)
```

### KPI with extension measure

**Metadata:**

```json
{
  "visualType": "kpi",
  "query": {
    "queryState": {
      "Indicator": {
        "projections": [{
          "field": {
            "Measure": {
              "Expression": {"SourceRef": {"Entity": "Orders"}},
              "Property": "Order Lines"
            }
          }
        }]
      },
      "Goal": {
        "projections": [{
          "field": {
            "Measure": {
              "Expression": {
                "SourceRef": {
                  "Schema": "extension",
                  "Entity": "Orders"
                }
              },
              "Property": "Order Lines (PY)"
            }
          }
        }]
      },
      "TrendLine": {
        "projections": [{
          "field": {
            "Column": {
              "Expression": {"SourceRef": {"Entity": "Date"}},
              "Property": "Year"
            }
          }
        }]
      }
    }
  }
}
```

**reportExtensions.json:**

```json
{
  "entities": [{
    "name": "Orders",
    "measures": [{
      "name": "Order Lines (PY)",
      "expression": "CALCULATE([Order Lines], SAMEPERIODLASTYEAR('Date'[Date]))"
    }]
  }]
}
```

**Query:**

```dax
DEFINE
    MEASURE 'Orders'[Order Lines (PY)] =
        CALCULATE([Order Lines], SAMEPERIODLASTYEAR('Date'[Date]))

EVALUATE
SUMMARIZECOLUMNS(
    'Date'[Year],
    "Order_Lines", 'Orders'[Order Lines],
    "Order_Lines__PY_", 'Orders'[Order Lines (PY)]
)
```

### Line chart with conditional formatting

**Metadata:**

```json
{
  "visualType": "lineChart",
  "query": {
    "queryState": {
      "Category": {
        "projections": [{
          "field": {
            "Column": {
              "Expression": {"SourceRef": {"Entity": "Date"}},
              "Property": "Month"
            }
          }
        }]
      },
      "Y": {
        "projections": [{
          "field": {
            "Measure": {
              "Expression": {"SourceRef": {"Entity": "Budget"}},
              "Property": "Budget vs. Turnover (%)"
            }
          }
        }]
      }
    }
  },
  "objects": {
    "dataPoint": [
      {},
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
                        "Entity": "_Demo of SVG Measures"
                      }
                    },
                    "Property": "Formatting"
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
}
```

**reportExtensions.json:**

```json
{
  "entities": [{
    "name": "_Demo of SVG Measures",
    "measures": [{
      "name": "Formatting",
      "expression": "IF([Budget vs. Turnover (%)] < 0, \"#D64550\", \"#118DFF\")"
    }]
  }]
}
```

**Query:**

```dax
DEFINE
    MEASURE '_Demo of SVG Measures'[Formatting] =
        IF([Budget vs. Turnover (%)] < 0, "#D64550", "#118DFF")

EVALUATE
SUMMARIZECOLUMNS(
    'Date'[Month],
    'Date'[Month Number],
    "Budget_vs__Turnover____", 'Budget'[Budget vs. Turnover (%)],
    "Formatting", IGNORE('_Demo of SVG Measures'[Formatting])
)
```

Note: Extension measures typically use `IGNORE()` wrapper.

## Quick reference

**Column → Grouping:**

- `field.Column` in projections
- Becomes grouping column in SUMMARIZECOLUMNS
- Sort column auto-added if exists

**Measure → Measure:**

- `field.Measure` in projections
- Becomes `"alias", Table[Measure]` in SUMMARIZECOLUMNS
- Use `IGNORE()` if no grouping columns (cards)

**Extension measure:**

- `SourceRef.Schema = "extension"`
- Add to DEFINE section
- Include in SUMMARIZECOLUMNS (usually with `IGNORE()`)

**Alias naming:**

- Spaces → underscores
- Special chars → underscores
- Example: `Standard Margin (%)` → `"Standard_Margin____"`

**Visual-specific patterns:**

- **Cards:** No grouping, all measures with `IGNORE()`
- **Slicers:** Use `CALCULATETABLE + SUMMARIZE + VALUES`, not SUMMARIZECOLUMNS
- **Charts:** Grouping + measures, no `IGNORE()`
- **KPIs:** Multiple measures (Indicator, Goal), optional TrendLine grouping

## Performance notes

- Each grouping column multiplies cardinality
- Extension measures evaluate per data point when `matchingOption: 1`
- Complex extension measures can slow queries significantly
- TOPN limits results (1001 for charts, 501 for tables, 101 for slicers)

## See also

- [Model queries](model-queries.md) - Running DAX queries against semantic models
- [Extension measures](../measures.md) - Creating report-level measures
- [Field references](field-references.md) - Understanding field metadata
