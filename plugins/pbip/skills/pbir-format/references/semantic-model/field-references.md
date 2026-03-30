# Field References in Report Metadata

Power BI reports reference semantic model fields using structured JSON expressions. If you use the wrong field names, visuals will not render (even though the schema validates). To find fields to use in reports, see [finding-fields.md](finding-fields.md)

**CRITICAL:** Field references require three components:

1. Field type (Column, Measure, HierarchyLevel)
2. Table name (Entity)
3. Field name (Property)

## Field Reference Syntax

### Column References

```json
{
  "field": {
    "Column": {
      "Expression": {
        "SourceRef": {
          "Entity": "Date"
        }
      },
      "Property": "Calendar Year (ie 2021)"
    }
  },
  "queryRef": "Date.Calendar Year (ie 2021)",
  "nativeQueryRef": "Calendar Year (ie 2021)"
}
```

### Model Measure References

```json
{
  "field": {
    "Measure": {
      "Expression": {
        "SourceRef": {
          "Entity": "Orders"
        }
      },
      "Property": "Order Lines"
    }
  },
  "queryRef": "Orders.Order Lines",
  "nativeQueryRef": "Order Lines"
}
```

### Extension Measure References

For measures defined in `reportExtensions.json`:

```json
{
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
  },
  "queryRef": "Orders.Order Lines (PY)",
  "nativeQueryRef": "Order Lines (PY)"
}
```

**Extension measures require ONE thing in the field reference:**
- `"Schema": "extension"` in the SourceRef — this is the distinguishing marker

**The `queryRef` uses the standard `"Entity.Property"` format** — no `"extension."` prefix. Real example files consistently omit the prefix: `"On-Time Delivery.OTD % (Value; PY)"`, `"1) Selected Metric.Late Orders"`, etc.

### Hierarchy Level References

```json
{
  "field": {
    "HierarchyLevel": {
      "Expression": {
        "Hierarchy": {
          "Expression": {
            "SourceRef": {
              "Entity": "Brands"
            }
          },
          "Hierarchy": "Brand Hierarchy"
        }
      },
      "Level": "Class"
    }
  },
  "queryRef": "Brands.Brand Hierarchy.Class",
  "nativeQueryRef": "Brand Hierarchy Class"
}
```

**Structure:** HierarchyLevel references require Entity (table name), Hierarchy (hierarchy name), and Level (level name)

**See:** `../schema-patterns/expressions.md` for complete expression syntax documentation

## Field Values in Report Metadata

Power BI reports embed literal field values in metadata for filters, slicers, and conditional formatting.

### 1. Default Filter Values

Filters store field values in the `Where` clause using the `In` operator with a `Values` array:

```json
"filter": {
  "Version": 2,
  "From": [{"Name": "c", "Entity": "Customers", "Type": 0}],
  "Where": [{
    "Condition": {
      "In": {
        "Expressions": [{
          "Column": {
            "Expression": {"SourceRef": {"Source": "c"}},
            "Property": "Account Name"
          }
        }],
        "Values": [[{"Literal": {"Value": "'Aaron Gomez'"}}]]
      }
    }
  }]
}
```

**Pattern:** Each value is wrapped in nested arrays: `[[{Literal}], [{Literal}]]` for multiple values. The `"Source"` alias in `SourceRef` references the `"Name"` defined in the `"From"` array — `"From"` is required whenever `SourceRef.Source` is used.

### 2. Default Slicer Selections

Slicers use the same filter pattern in `general.filter` to set default selections:

```json
"general": [{
  "properties": {
    "filter": {
      "filter": {
        "Version": 2,
        "From": [{"Name": "b", "Entity": "Brands", "Type": 0}],
        "Where": [{
          "Condition": {
            "In": {
              "Expressions": [{
                "Column": {
                  "Expression": {"SourceRef": {"Source": "b"}},
                  "Property": "Brand Tier"
                }
              }],
              "Values": [
                [{"Literal": {"Value": "'Flagship Brand'"}}],
                [{"Literal": {"Value": "'Growth Brand'"}}],
                [{"Literal": {"Value": "'Other Brand'"}}]
              ]
            }
          }
        }]
      }
    }
  }
}]
```

### 3. Format Specific Values Differently

Use `scopeId` selector with `Comparison` to apply formatting to specific field values:

```json
"columnWidth": [{
  "properties": {
    "value": {"expr": {"Literal": {"Value": "132D"}}}
  },
  "selector": {
    "data": [{
      "scopeId": {
        "Comparison": {
          "ComparisonKind": 0,
          "Left": {
            "Column": {
              "Expression": {"SourceRef": {"Entity": "Products"}},
              "Property": "Type"
            }
          },
          "Right": {"Literal": {"Value": "'Engine & Propulsion'"}}
        }
      }
    }]
  }
}]
```

**ComparisonKind values:** `0` = Equal, `1` = GreaterThan, `2` = GreaterThanOrEqual, `3` = LessThanOrEqual, `4` = LessThan

**Notes:**

- String values use single quotes inside double quotes: `"'Value'"`
- These patterns are typically created by Power BI Desktop UI
- Must query the model to get valid field values before inserting them

**See:** `../schema-patterns/selectors.md` for complete selector documentation
