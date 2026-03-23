# Semantic Model File Structure

Understanding where tables, columns, measures, and hierarchies are defined in semantic model files.

## Model Locations

**Local models:** `.SemanticModel` folder in PBIP projects

**Remote models:** Download using [download-model.py](../../scripts/download-model.py) or query with `fab get WorkspaceName.Workspace/ModelName.SemanticModel -q "definition"`

## File Structure

### TMDL Format (Preferred)

Human-readable, one file per table:

```yaml
ModelName/
├── __field_index.md          # Generated index of all tables/columns/measures
├── definition/
│   ├── model.tmdl            # Model-level properties
│   ├── relationships.tmdl    # All relationships
│   └── tables/
│       ├── TableName.tmdl    # Each table in separate file
│       └── AnotherTable.tmdl
```

### TMSL Format (Legacy)

Single JSON file with all metadata:

```yaml
ModelName/
├── model.bim                 # All model metadata in one JSON file
```

## Finding Tables

**TMDL:** Each `.tmdl` file in `definition/tables/` is a table

```bash
ls definition/tables/
# Brands.tmdl  Budget.tmdl  Customers.tmdl  Date.tmdl  Orders.tmdl
```

**TMSL:** Tables are in the `tables` array in `model.bim`:

```json
{"model": {"tables": [{"name": "Brands"}, {"name": "Budget"}]}}
```

## Finding Columns

**TMDL:** Columns are listed under each table in `definition/tables/TableName.tmdl`:

```tmdl
table Brands
  column 'Brand Tier'
    dataType: string
    sourceColumn: Flagship

  column Brand
    dataType: string
    sourceColumn: Brand
```

**TMSL:** Columns are in `tables[N].columns` array in `model.bim`

## Finding Measures

**TMDL:** Measures are listed under each table in `definition/tables/TableName.tmdl`:

```tmdl
table Budget
  measure 'Budget MTD' = ```
    CALCULATE([Budget], DATESMTD('Date'[Date]))
    ```
    formatString: #,##0
    displayFolder: 0. Measures\ii. MTD
```

**TMSL:** Measures are in `tables[N].measures` array in `model.bim`

## Finding Hierarchies

**TMDL:** Hierarchies are listed under each table in `definition/tables/TableName.tmdl`:

```tmdl
table Brands
  hierarchy 'Brand Hierarchy'
    level Class
      column: 'Brand Class'
    level Flagship
      column: 'Brand Tier'
    level Brand
      column: Brand
```

**TMSL:** Hierarchies are in `tables[N].hierarchies` array in `model.bim`

## Quick Field Lookup

Use the generated `__field_index.md` (created by download-model.py) for fast field lookup:

```markdown
## Brands

**Columns:**
- `Brands.Brand Tier`
- `Brands.Brand`

**Hierarchies:**
- `Brands.Brand Hierarchy` (levels: Class, Flagship, Brand, Sub Brand)
```

## See Also

- [Finding Fields](finding-fields.md) - Commands to list fields from models
- [Field References](field-references.md) - How to reference fields in reports
