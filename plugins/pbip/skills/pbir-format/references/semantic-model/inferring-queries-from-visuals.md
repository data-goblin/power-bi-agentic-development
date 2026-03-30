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
| card (old card) | - | Values |
| cardVisual (new card) | - | Data |
| lineChart | Category | Y (also Y2 for combo) |
| barChart / clusteredBarChart / hundredPercentStackedBarChart | Category | Y |
| columnChart / clusteredColumnChart / hundredPercentStackedColumnChart | Category | Y |
| areaChart / stackedAreaChart / hundredPercentStackedAreaChart | Category, Series (optional breakdown) | Y |
| waterfallChart / ribbonChart / donutChart | Category | Y |
| Slicer | Values | - |
| KPI | TrendLine (when bound) | Indicator, Goal |
| tableEx (standard table) | Values (columns = groupings) | Values (measures) |
| pivotTable (matrix) | Rows, Columns | Values |
| Scatter | Category | X, Y, Size, Tooltips |
| multiRowCard | Values (dims) | Values (measures) |

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

### cardVisual (New Card)

The new card visual uses the **`Data`** role, not `Values`. This is a direct conflict with the old `card` — use the correct role name for the visual type.

**Metadata:**

```json
{
  "visualType": "cardVisual",
  "query": {
    "queryState": {
      "Data": {
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

Note: Same no-grouping `IGNORE()` pattern as the old card.

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
    "Formatting", '_Demo of SVG Measures'[Formatting]
)
```

Note: When a chart has grouping columns (like this line chart with `'Date'[Month]`), extension measures are included **without** `IGNORE()`. Use `IGNORE()` only for visuals with **no** grouping columns (cards, KPIs) to prevent a blank row.

### tableEx (Standard Table) — visualType: `tableEx`

Table visuals use a single `Values` role containing a **mix** of columns (become grouping arguments) and measures (become measure aliases). This is unique — all columns and measures are in one role, unlike charts which separate grouping and measures.

**K201 Table example metadata (Values role):**
```
- Column: Customers.Key Account Name  → grouping
- Measure: On-Time Delivery.OTD % (Value)  → measure alias
```

**Query:**
```dax
EVALUATE
SUMMARIZECOLUMNS(
    'Customers'[Key Account Name],     -- Column from Values → grouping
    "OTD____Value_", 'On-Time Delivery'[OTD % (Value)]  -- Measure from Values
)
```

All columns in the `Values` role become grouping columns. All measures become measure aliases.

### pivotTable (Matrix) — visualType: `pivotTable`

Matrix visuals have **three** distinct roles — `Rows`, `Columns`, and `Values`. Both `Rows` and `Columns` become grouping arguments; `Values` become measure aliases. Power BI generates a SUMMARIZECOLUMNS query covering the cross-product.

**Example:**
```dax
EVALUATE
SUMMARIZECOLUMNS(
    'Products'[Category],              -- Rows role
    'Date'[Year],                      -- Columns role
    "Revenue", 'Sales'[Revenue]        -- Values role
)
```

Note: The matrix's row/column layout is controlled by the visual rendering, not by the DAX query. The query returns a flat table; Power BI pivots it visually.

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
- Include in SUMMARIZECOLUMNS without `IGNORE()` (charts with grouping columns)
- Use `IGNORE()` only when there are **no grouping columns** (cards and KPIs without a TrendLine bound). A KPI with a TrendLine has a grouping column — do not use `IGNORE()` in that case.

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
