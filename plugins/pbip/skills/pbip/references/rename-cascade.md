# Rename Cascade Reference

Detailed before/after examples for every location that must be updated when renaming tables, measures, or columns in a PBIP project.

## Table Rename Examples

The examples below show renaming a table from `Customers` to `Customer`.

### TMDL File Name

```
# Before
tables/Customers.tmdl

# After
tables/Customer.tmdl
```

### Table Declaration

```tmdl
// Before
table Customers
	lineageTag: abc-123

// After
table Customer
	lineageTag: abc-123
```

**Quoting rules:** Only quote names that contain spaces or special characters. Simple names like `Customer` are unquoted. Names with spaces use single quotes: `'Invoice Document Type'`. Underscore-prefixed names without spaces are unquoted: `_Measures`.

### Partition Name

The partition name typically matches the table name:

```tmdl
// Before
partition Customers = m
	mode: import
	source = ...

// After
partition Customer = m
	mode: import
	source = ...
```

### Model.tmdl Ref Entries

```tmdl
// Before
ref table Customers

// After
ref table Customer
```

**Also update `PBI_QueryOrder` annotation** if it contains the table name:

```tmdl
// Before
annotation PBI_QueryOrder = ["Brand","Customers","Product"]

// After
annotation PBI_QueryOrder = ["Brand","Customer","Product"]
```

### Relationships.tmdl

Both `fromColumn` and `toColumn` use the format `TableName.'Column Name'`:

```tmdl
// Before
relationship abc-123
	fromColumn: Invoices.'Customer Key'
	toColumn: Customers.'Customer Key'

// After
relationship abc-123
	fromColumn: Invoices.'Customer Key'
	toColumn: Customer.'Customer Key'
```

### DAX Expressions Across All TMDL Files

Table references in DAX appear in single quotes when the name contains spaces, otherwise unquoted. After a rename, update every occurrence across all `.tmdl` files:

```dax
// Before (table name with no spaces - appears in single quotes in DAX anyway)
CALCULATE (
    [Sales Amount],
    Customers[Account Type] = "Enterprise"
)

// After
CALCULATE (
    [Sales Amount],
    Customer[Account Type] = "Enterprise"
)
```

**Edge case — unquoted vs. quoted in DAX:**

DAX always allows single-quoting table names, even simple ones. Both forms are valid:

```dax
// Both valid DAX:
Customer[Column]
'Customer'[Column]
```

When doing bulk find-and-replace, search for both patterns:
- `Customers[` (unquoted)
- `'Customers'[` (quoted)
- `'Customers'` (standalone reference in CALCULATE filters)

### Visual JSON Entity References

#### SourceRef.Entity

```json
// Before
{
  "Expression": {
    "SourceRef": {
      "Entity": "Customers"
    }
  }
}

// After
{
  "Expression": {
    "SourceRef": {
      "Entity": "Customer"
    }
  }
}
```

#### queryRef

The `queryRef` format is `TableName.ColumnOrMeasureName`:

```json
// Before
"queryRef": "Customers.Account Type"

// After
"queryRef": "Customer.Account Type"
```

#### nativeQueryRef

The `nativeQueryRef` contains only the column/measure name (no table prefix). It does **not** change during table renames — only during column/measure renames.

### Filter Config Entity References

Filter configurations in visual and page JSON files contain `From[].Entity` references:

```json
// Before (in visual.json or page.json filterConfig)
"From": [
  { "Name": "p", "Entity": "Customers", "Type": 0 }
]

// After
"From": [
  { "Name": "p", "Entity": "Customer", "Type": 0 }
]
```

### Conditional Formatting Entity References

Conditional formatting rules embed `SourceRef.Entity` inside expression trees:

```json
// Before (nested in objects.*.properties.*.expr.Conditional.Cases)
"Measure": {
  "Expression": {
    "SourceRef": { "Entity": "Customers" }
  },
  "Property": "Some Measure"
}

// After
"Measure": {
  "Expression": {
    "SourceRef": { "Entity": "Customer" }
  },
  "Property": "Some Measure"
}
```

### Bookmark Filter Snapshots

Bookmark JSON files (in `definition/bookmarks/`) contain filter state snapshots. Each filter entry has **two** distinct `Entity` references that must both be updated:

1. `filter.From[].Entity` — the aliased filter predicate
2. `expression.Column.Expression.SourceRef.Entity` — the top-level expression field

```json
// Before (in .bookmark.json explorationState.filters.byExpr[])
{
  "expression": {
    "Column": {
      "Expression": {"SourceRef": {"Entity": "Customers"}},  // ← must update
      "Property": "Account Name"
    }
  },
  "filter": {
    "Version": 2,
    "From": [{"Name": "c", "Entity": "Customers", "Type": 0}],  // ← must update
    "Where": [...]
  }
}

// After (renaming Customers → Customer)
{
  "expression": {
    "Column": {
      "Expression": {"SourceRef": {"Entity": "Customer"}},
      "Property": "Account Name"
    }
  },
  "filter": {
    "Version": 2,
    "From": [{"Name": "c", "Entity": "Customer", "Type": 0}],
    "Where": [...]
  }
}
```

### Bookmark Highlight Blocks

Bookmarks may also contain `highlight` blocks with `dataMap` keys in `"Table.Column"` format that must be updated on table or column renames:

```json
// Before (in .bookmark.json explorationState.sections.<page>.visualContainers.<visual>)
{
  "highlight": {
    "dataMap": {
      "Customers.Key Account Name": {...},   // ← key string must update
      "Sales.Revenue": {...}
    },
    "filterExpressionMetadata": {
      "expressions": [{
        "Column": {
          "Expression": {"SourceRef": {"Entity": "Customers"}},  // ← must update
          "Property": "Key Account Name"
        }
      }]
    }
  }
}

// After (renaming Customers → Customer)
{
  "highlight": {
    "dataMap": {
      "Customer.Key Account Name": {...},
      "Sales.Revenue": {...}
    },
    "filterExpressionMetadata": {
      "expressions": [{
        "Column": {
          "Expression": {"SourceRef": {"Entity": "Customer"}},
          "Property": "Key Account Name"
        }
      }]
    }
  }
}
```

Both `dataMap` key strings AND `filterExpressionMetadata.expressions[].Column.Expression.SourceRef.Entity` must be updated.

### SparklineData Metadata Selectors

SparklineData metadata selectors embed table names in a compact string format:

```json
// Before
{
  "selector": {
    "metadata": "SparklineData(Customers.Customer Count_[Date.Date Hierarchy.Date])"
  }
}

// After
{
  "selector": {
    "metadata": "SparklineData(Customer.Customer Count_[Date.Date Hierarchy.Date])"
  }
}
```

**Format breakdown:**
```
SparklineData(<MeasureTable>.<MeasureName>_[<GroupingTable>.<Hierarchy>.<Level>])
```

SparklineData also appears in query projections as structured JSON:

```json
// Before
{
  "field": {
    "SparklineData": {
      "Measure": {
        "Measure": {
          "Expression": {
            "SourceRef": { "Entity": "Customers" }
          },
          "Property": "Customer Count"
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
      ]
    }
  }
}
```

Both the `Entity` in the structured JSON and the table name in the metadata selector string must be updated.

### SemanticModelDiagramLayout.json

```json
// Before
{
  "nodeIndex": "Customers",
  "size": { "height": 300, "width": 234 }
}

// After
{
  "nodeIndex": "Customer",
  "size": { "height": 300, "width": 234 }
}
```

### ReportExtensions.json

```json
// Before
{
  "entities": [
    {
      "name": "Customers",
      "measures": [
        {
          "name": "Customer Color",
          "expression": "IF ( [Customer Count] > 100, \"blue\", \"gray\" )",
          "references": {
            "measures": [
              { "entity": "Customers", "name": "Customer Count" }
            ]
          }
        }
      ]
    }
  ]
}

// After
{
  "entities": [
    {
      "name": "Customer",
      "measures": [
        {
          "name": "Customer Color",
          "expression": "IF ( [Customer Count] > 100, \"blue\", \"gray\" )",
          "references": {
            "measures": [
              { "entity": "Customer", "name": "Customer Count" }
            ]
          }
        }
      ]
    }
  ]
}
```

**Note:** The `entity` field in `references.measures` entries must also be updated — not just the top-level `name`.

### Culture Files

The `linguisticMetadata` JSON inside culture `.tmdl` files contains `ConceptualEntity` and `ConceptualProperty` references:

```json
// Before (inside cultures/en-US.tmdl)
{
  "customers.account_type": {
    "Definition": {
      "Binding": {
        "ConceptualEntity": "Customers",
        "ConceptualProperty": "Account Type"
      }
    }
  }
}

// After
{
  "customers.account_type": {
    "Definition": {
      "Binding": {
        "ConceptualEntity": "Customer",
        "ConceptualProperty": "Account Type"
      }
    }
  }
}
```

**Note:** The dictionary key (`customers.account_type`) is an auto-generated lookup key. It does not need to match the actual table name, but the `ConceptualEntity` value does.

### DAX Query Files

Check both locations:

```
<Name>.SemanticModel/DAXQueries/*.dax
<Name>.Report/DAXQueries/*.dax
```

```dax
// Before
EVALUATE TOPN(100, Customers)

// After
EVALUATE TOPN(100, Customer)
```

## Measure Rename Examples

Renaming a measure from `# Customers` to `# Active Customers`.

### TMDL Measure Declaration

```tmdl
// Before
measure '# Customers' =
		COUNTROWS ( Customer )
	formatString: #,##0
	displayFolder: Measures
	lineageTag: abc-123

// After
measure '# Active Customers' =
		COUNTROWS ( Customer )
	formatString: #,##0
	displayFolder: Measures
	lineageTag: abc-123
```

### DAX References in Other Measures

```tmdl
// Before
measure '% Customer Growth' =
		DIVIDE ( [# Customers], [# Customers PY] )

// After
measure '% Customer Growth' =
		DIVIDE ( [# Active Customers], [# Customers PY] )
```

### Visual JSON Property and queryRef

```json
// Before
{
  "Measure": {
    "Expression": { "SourceRef": { "Entity": "Customer" } },
    "Property": "# Customers"
  }
},
"queryRef": "Customer.# Customers",
"nativeQueryRef": "# Customers"

// After
{
  "Measure": {
    "Expression": { "SourceRef": { "Entity": "Customer" } },
    "Property": "# Active Customers"
  }
},
"queryRef": "Customer.# Active Customers",
"nativeQueryRef": "# Active Customers"
```

### ReportExtensions.json

```json
// Before
{ "entity": "Customer", "name": "# Customers" }

// After
{ "entity": "Customer", "name": "# Active Customers" }
```

## Sort Definitions

`sortDefinition` blocks inside visual.json contain `SourceRef.Entity` references that must be updated during table or column renames. These are **commonly missed** because they live outside the `queryState` projections.

```json
// Before (in visual.json query.sortDefinition)
"sortDefinition": {
  "sort": [{
    "field": {
      "Measure": {
        "Expression": {
          "SourceRef": {"Entity": "Customers"}
        },
        "Property": "Revenue"
      }
    },
    "direction": "Descending"
  }],
  "isDefaultSort": true
}

// After
"sortDefinition": {
  "sort": [{
    "field": {
      "Measure": {
        "Expression": {
          "SourceRef": {"Entity": "Customer"}
        },
        "Property": "Revenue"
      }
    },
    "direction": "Descending"
  }],
  "isDefaultSort": true
}
```

**Note:** `sortDefinition` does not use `queryRef` — only `SourceRef.Entity` and `Property`. Search for `"sortDefinition"` across all `visual.json` files to find every instance.

## Edge Cases

### Names with Special Characters

DAX measure names with special characters (parentheses, percentage signs, delta symbols) are common:

```
Orders Target vs. Net Orders (Δ)
Sales Target MTD vs. Actuals (%)
OTD % (Value; PY REPT)
```

When searching for these in JSON files, remember that some characters may be escaped or may need regex escaping in grep patterns.

### Unquoted Names in TMDL

Simple names (no spaces, no special characters) are unquoted in TMDL declarations:

```tmdl
table Product          // unquoted - no spaces
table _Measures        // unquoted - underscore prefix, no spaces
table 'Budget Rate'    // quoted - contains space
table '1) Selected Metric'  // quoted - starts with digit, contains special chars
```

### Multiple Tables with Similar Names

When renaming `Order` in a model that also has `Orders` and `Order Status`, use word-boundary-aware search to avoid false matches:

```bash
# Use word boundaries to match exact table name
grep -rP "\bOrder\b" --include="*.tmdl" --include="*.json"

# Or search for the specific TMDL/JSON patterns
grep -r "table Order$" --include="*.tmdl"
grep -r '"Entity": "Order"' --include="*.json"
```

### Bulk Rename Strategy

For large-scale renames (e.g., applying SQLBI naming conventions to all tables):

1. Build a rename mapping (old name → new name)
2. Sort by longest name first to avoid substring collisions
3. Process one table at a time, running verification after each
4. Use a script for consistency to avoid manual errors
