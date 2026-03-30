# Sorting Visuals in Power BI Reports

## Overview

Visual sorting is configured in the `query.sortDefinition` object, not via a separate `orderBy` property.

## Sort Configuration Structure

```json
{
  "query": {
    "queryState": {
      // ... visual query projections
    },
    "sortDefinition": {
      "sort": [
        {
          "field": {
            "Measure": {
              "Expression": {
                "SourceRef": {
                  "Entity": "TableName"
                }
              },
              "Property": "MeasureName"
            }
          },
          "direction": "Descending"
        }
      ],
      "isDefaultSort": true
    }
  }
}
```

## Key Properties

### sortDefinition.sort (array)
Array of sort specifications. Each entry defines:

**field**: The field to sort by
- Can be a `Measure` or `Column`
- Must reference the same entity structure as query projections

**direction**: Sort direction
- `"Descending"` - Largest to smallest
- `"Ascending"` - Smallest to largest

### sortDefinition.isDefaultSort (boolean)
- `true` - Marks this as the default sort (Power BI may reset it to this when users clear their custom sort)
- `false` or omitted - The sort array is applied as-is without the "default" flag; programmatic sorts often omit this property

## Examples

### Sort Bar Chart by Measure (Descending)

```json
{
  "visual": {
    "visualType": "barChart",
    "query": {
      "queryState": {
        "Category": {
          "projections": [{
            "field": {
              "Column": {
                "Expression": {"SourceRef": {"Entity": "Customers"}},
                "Property": "Key Account Name"
              }
            },
            "queryRef": "Customers.Key Account Name",
            "nativeQueryRef": "Key Account Name",
            "active": true
          }]
        },
        "Y": {
          "projections": [{
            "field": {
              "Measure": {
                "Expression": {"SourceRef": {"Entity": "Orders"}},
                "Property": "Order Lines"
              }
            },
            "queryRef": "Orders.Order Lines",
            "nativeQueryRef": "Order Lines"
          }]
        }
      },
      "sortDefinition": {
        "sort": [{
          "field": {
            "Measure": {
              "Expression": {"SourceRef": {"Entity": "Orders"}},
              "Property": "Order Lines"
            }
          },
          "direction": "Descending"
        }],
        "isDefaultSort": true
      }
    }
  }
}
```

This sorts the bar chart by "Order Lines" in descending order (largest bars at top).

### Sort by Column (Ascending)

```json
"sortDefinition": {
  "sort": [{
    "field": {
      "Column": {
        "Expression": {"SourceRef": {"Entity": "Date"}},
        "Property": "Calendar Month Year (ie Jan 21)"
      }
    },
    "direction": "Ascending"
  }],
  "isDefaultSort": true
}
```

This sorts by the calendar month in ascending chronological order.

## Visual Types That Support Sorting

- **Bar Charts** (`barChart`, `clusteredBarChart`, `hundredPercentStackedBarChart`)
- **Column Charts** (`columnChart`, `clusteredColumnChart`, `hundredPercentStackedColumnChart`)
- **Line Charts** (`lineChart`)
- **Tables** (`tableEx`)
- **Matrix** (`pivotTable`)

## Common Patterns

### Sort by Value (Default)
Most charts default to sorting by the measure value:
```json
"sort": [{
  "field": {"Measure": {...}},
  "direction": "Descending"
}]
```

### Sort by Category
Sort alphabetically by category name:
```json
"sort": [{
  "field": {"Column": {...}},
  "direction": "Ascending"
}]
```

### Multiple Sort Fields
You can specify multiple sort criteria (evaluated in order):
```json
"sort": [
  {
    "field": {"Column": {"Expression": {"SourceRef": {"Entity": "Date"}}, "Property": "Year"}},
    "direction": "Descending"
  },
  {
    "field": {"Column": {"Expression": {"SourceRef": {"Entity": "Date"}}, "Property": "Month"}},
    "direction": "Ascending"
  }
]
```

## Troubleshooting

**Sort not applying:**
- Verify `sortDefinition` is inside `query`, not inside `queryState`
- Check field reference matches exactly (Entity and Property names)
- Ensure direction is capitalized: `"Descending"` or `"Ascending"`

**Schema validation error:**
- Do NOT use `orderBy` - this is not supported in the schema
- Use `sortDefinition` instead

**Sort direction:**
- For bar/column charts showing "top N", use `"Descending"` to show largest values
- For time series, use `"Ascending"` for chronological order

## Related Documentation

- [visual.json](./visual-json.md) - Visual structure including query
- [expressions.md](./schema-patterns/expressions.md) - Field reference patterns
