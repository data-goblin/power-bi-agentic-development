# Rename Patterns in PBIR JSON

> This reference documents Entity, Property, queryRef, and nativeQueryRef patterns
> in PBIR report files that must be updated during table, column, or measure renames.
> For the full rename cascade (including TMDL files), see the `pbip` skill's
> `references/rename-cascade.md`.

Detailed documentation of the JSON structures found in Power BI Report files, focusing on patterns that contain table, column, and measure references.

## Visual JSON Structure

Each visual is stored in its own `visual.json` file at:
```
<Name>.Report/definition/pages/<pageId>/visuals/<visualId>/visual.json
```

### Top-Level Structure

```json
{
  "$schema": "https://developer.microsoft.com/json-schemas/fabric/item/report/definition/visualContainer/2.7.0/schema.json",
  "name": "<visualId>",
  "position": { "x": 0, "y": 0, "z": 0, "height": 200, "width": 300, "tabOrder": 0 },
  "visual": {
    "visualType": "clusteredBarChart",
    "query": { ... },
    "objects": { ... }
  },
  "filters": [ ... ],
  "filterConfig": { ... }
}
```

### Entity and Property References

The core pattern for referencing model objects in visual JSON:

#### Column Reference

```json
{
  "Column": {
    "Expression": {
      "SourceRef": {
        "Entity": "Customer"
      }
    },
    "Property": "Account Type"
  }
}
```

#### Measure Reference

```json
{
  "Measure": {
    "Expression": {
      "SourceRef": {
        "Entity": "_Measures"
      }
    },
    "Property": "Net Orders MTD"
  }
}
```

#### Hierarchy Reference

```json
{
  "HierarchyLevel": {
    "Expression": {
      "Hierarchy": {
        "Expression": {
          "SourceRef": {
            "Entity": "Product"
          }
        },
        "Hierarchy": "Product Hierarchy"
      }
    },
    "Level": "Type"
  }
}
```

### Query State Projections

The `query.queryState` object maps well slots (Category, Value, etc.) to field projections:

```json
{
  "query": {
    "queryState": {
      "Category": {
        "projections": [
          {
            "field": {
              "Column": {
                "Expression": {
                  "SourceRef": { "Entity": "Country" }
                },
                "Property": "Country Id"
              }
            },
            "queryRef": "Country.Country Id",
            "nativeQueryRef": "Country Id"
          }
        ]
      },
      "Value": {
        "projections": [
          {
            "field": {
              "Measure": {
                "Expression": {
                  "SourceRef": { "Entity": "_Measures" }
                },
                "Property": "Country Value"
              }
            },
            "queryRef": "_Measures.Country Value",
            "nativeQueryRef": "Country Value"
          }
        ]
      }
    }
  }
}
```

**Reference fields:**

| Field | Format | Contains Table Name? |
|-------|--------|---------------------|
| `Entity` | `"TableName"` | Yes |
| `Property` | `"ColumnOrMeasureName"` | No |
| `queryRef` | `"TableName.ColumnOrMeasureName"` | Yes |
| `nativeQueryRef` | `"ColumnOrMeasureName"` | No |

### Conditional Formatting Expressions

Entity references appear inside conditional formatting rules in the `objects` section:

```json
{
  "objects": {
    "dataPoint": [
      {
        "properties": {
          "fill": {
            "solid": {
              "color": {
                "expr": {
                  "Conditional": {
                    "Cases": [
                      {
                        "Condition": {
                          "Comparison": {
                            "Left": {
                              "Measure": {
                                "Expression": {
                                  "SourceRef": { "Entity": "_Measures" }
                                },
                                "Property": "Orders Target vs. Net Orders (Δ)"
                              }
                            },
                            "Right": { "Literal": { "Value": "0D" } }
                          }
                        },
                        "Value": { "Literal": { "Value": "'#1971c2'" } }
                      }
                    ]
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

These are deeply nested and easy to miss during renames. Search for `"Entity"` within `objects` sections.

## SparklineData

SparklineData appears in two forms within visual JSON files.

### Structured Form (in query projections)

```json
{
  "field": {
    "SparklineData": {
      "Measure": {
        "Measure": {
          "Expression": {
            "SourceRef": { "Entity": "_Measures" }
          },
          "Property": "Orders Target vs. Net Orders (Δ) Trend Line"
        }
      },
      "Groupings": [
        {
          "HierarchyLevel": {
            "Expression": {
              "Hierarchy": {
                "Expression": {
                  "SourceRef": { "Entity": "Date" }
                },
                "Hierarchy": "Date Hierarchy"
              }
            },
            "Level": "Date"
          }
        }
      ],
      "ApplyCalculationGroupTo": "Point"
    }
  }
}
```

### Metadata Selector Form (in objects)

SparklineData formatting rules use a compact metadata selector string:

```json
{
  "objects": {
    "sparklines": [
      {
        "properties": {
          "show": { "expr": { "Literal": { "Value": "true" } } }
        },
        "selector": {
          "metadata": "SparklineData(_Measures.Orders Target vs. Net Orders (Δ)_[Date.Date Hierarchy.Date])"
        }
      }
    ]
  }
}
```

**Metadata selector format:**
```
SparklineData(<MeasureEntity>.<MeasureName>_[<GroupEntity>.<Hierarchy>.<Level>])
```

This compact string embeds both the measure's Entity (table) reference and the grouping Entity reference. Both must be updated during table renames.

## Page JSON

Each page has a `page.json` file at:
```
<Name>.Report/definition/pages/<pageId>/page.json
```

```json
{
  "$schema": "https://developer.microsoft.com/json-schemas/fabric/item/report/definition/page/2.0.0/schema.json",
  "name": "<pageId>",
  "displayName": "Page Title",
  "displayOption": "FitToPage",
  "height": 720,
  "width": 1280
}
```

Page JSON typically does not contain Entity references directly, but page-level filters (if present) can contain them.

## Filter Config

Visuals and pages can have `filterConfig` sections with Entity references:

```json
{
  "filterConfig": {
    "filters": [
      {
        "name": "filter_abc123",
        "field": {
          "Column": {
            "Expression": {
              "SourceRef": { "Entity": "Product" }
            },
            "Property": "Type"
          }
        },
        "filter": {
          "Version": 2,
          "From": [
            { "Name": "p", "Entity": "Product", "Type": 0 }
          ],
          "Where": [
            {
              "Condition": {
                "In": {
                  "Expressions": [
                    {
                      "Column": {
                        "Expression": { "SourceRef": { "Entity": "Product" } },
                        "Property": "Type"
                      }
                    }
                  ],
                  "Values": [
                    [ { "Literal": { "Value": "'Parts'" } } ]
                  ]
                }
              }
            }
          ]
        },
        "type": "Categorical"
      }
    ]
  }
}
```

**Note:** The `From` array uses `"Entity"` directly. The `Where` conditions nest `Entity` references inside `SourceRef`. Both must be updated.

## ReportExtensions.json

Located at:
```
<Name>.Report/definition/reportExtensions.json
```

Contains report-scoped measures organized by entity (table):

```json
{
  "$schema": "https://developer.microsoft.com/json-schemas/fabric/item/report/definition/reportExtension/1.0.0/schema.json",
  "name": "extension",
  "entities": [
    {
      "name": "Date",
      "measures": [
        {
          "name": "Area Color",
          "dataType": "Text",
          "expression": "IF ( [Orders Target vs. Net Orders (Δ)] >= 0, \"#1971c2\", \"#c2255c\" )",
          "references": {
            "measures": [
              {
                "entity": "_Measures",
                "name": "Orders Target vs. Net Orders (Δ)"
              }
            ]
          }
        }
      ]
    }
  ]
}
```

**Key fields containing table/measure references:**

| Field | Contains |
|-------|----------|
| `entities[].name` | Table name (where the report measure is attached) |
| `entities[].measures[].name` | Measure name |
| `entities[].measures[].expression` | DAX expression (may reference other tables/measures) |
| `entities[].measures[].references.measures[].entity` | Referenced measure's table |
| `entities[].measures[].references.measures[].name` | Referenced measure name |

## SemanticModelDiagramLayout.json

Located at:
```
<Name>.Report/semanticModelDiagramLayout.json
```

Contains diagram node positions using table names as identifiers:

```json
{
  "version": "1.1.0",
  "diagrams": [
    {
      "ordinal": 0,
      "scrollPosition": { "x": 960.3, "y": 759.2 },
      "nodes": [
        {
          "location": { "x": 378.2, "y": 0 },
          "nodeIndex": "Orders",
          "size": { "height": 300, "width": 234 },
          "zIndex": 0
        },
        {
          "location": { "x": 776.6, "y": 735.6 },
          "nodeIndex": "_Measures",
          "size": { "height": 300, "width": 234 },
          "zIndex": 0
        }
      ]
    }
  ]
}
```

The `nodeIndex` field contains the table name and must be updated during table renames.

## Summary: Where Entity References Live

| Location | Field Pattern | Example |
|----------|---------------|---------|
| Query projections | `SourceRef.Entity` | `"Entity": "Customer"` |
| Query projections | `queryRef` | `"queryRef": "Customer.Name"` |
| Query projections | `nativeQueryRef` | `"nativeQueryRef": "Name"` |
| Conditional formatting | `SourceRef.Entity` (nested in `Conditional.Cases`) | `"Entity": "_Measures"` |
| SparklineData (structured) | `SourceRef.Entity` | `"Entity": "Date"` |
| SparklineData (metadata) | Compact selector string | `"metadata": "SparklineData(Table.Measure_[...])"` |
| Filter config | `SourceRef.Entity` and `From[].Entity` | `"Entity": "Product"` |
| Report extensions | `entities[].name` and `references.measures[].entity` | `"entity": "_Measures"` |
| Diagram layout | `nodeIndex` | `"nodeIndex": "Orders"` |
