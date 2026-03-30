# Fix Broken Field References in PBIR Reports

Workflow for diagnosing and repairing reports with broken field references caused by semantic model changes (renamed tables, renamed columns/measures, moved measures between tables, or removed fields).

## Symptoms

- Visual error icons (X) with "Something's wrong with one or more fields"
- "Fields that need to be fixed" dialog showing `Missing_References`
- Filter pane showing warning icons on filters
- Visuals rendering with blank/zero data despite valid filters
- `pbir validate --fields` reporting missing fields (when model is accessible)

## Diagnosis Workflow

### 1. Identify broken references

Extract all unique field references from the report and compare against the semantic model.

```bash
# List all fields referenced by the report
pbir fields list "Report.Report"

# If model is remote, query it via DAX to check field existence
fab api -A powerbi "groups/$WS_ID/datasets/$MODEL_ID/executeQueries" \
  -X post -i '{"queries":[{"query":"EVALUATE TOPN(1, '\''TableName'\'')"}]}'
```

For each table referenced by the report, verify:
1. The table exists in the model
2. The columns/measures exist within that table

### 2. Categorize each broken reference

Each broken reference falls into one of four categories:

| Category | Example | Fix strategy |
|----------|---------|--------------|
| **Table renamed** | `1. Measures: Actuals` -> `Actuals` | Replace Entity everywhere |
| **Field renamed** | `Gross Sales MTD` -> `Turnover MTD` | Replace Property + queryRef + metadata |
| **Field moved** | `Invoices.Revenue` -> `Actuals.Revenue` | Replace Entity only (Property unchanged) |
| **Field removed** | `Gross Sales YTD` no longer exists | Find substitute or remove from visuals |

### 3. Build a replacement map

Create a mapping of old references to new ones. Probe the model to find where fields moved:

```bash
# Check if a measure exists (unqualified -- finds it in any table)
fab api -A powerbi "groups/$WS_ID/datasets/$MODEL_ID/executeQueries" \
  -X post -i '{"queries":[{"query":"EVALUATE ROW(\"v\", [MeasureName])"}]}'

# Check if a measure exists in a specific table
fab api -A powerbi "groups/$WS_ID/datasets/$MODEL_ID/executeQueries" \
  -X post -i '{"queries":[{"query":"EVALUATE ROW(\"v\", '\''TableName'\''[MeasureName])"}]}'

# Get measure DAX expression to understand its logic
te get "TableName/MeasureName" -q expression -s "workspace" -d "model"
```

## Repair Workflow

### Step 1: Use `pbir fields replace` for structured field references

```bash
pbir fields replace "Report.Report" \
  --from "OldTable.OldField" --to "NewTable.NewField" --skip-validation
```

This handles `Entity`, `Property`, and `queryRef` in query projections and sort definitions. Run once per renamed field.

### Step 2: Bulk-replace remaining references

`pbir fields replace` does not currently catch all locations. Perform a bulk text replacement for:

- **queryRef strings**: `"OldTable.FieldName"` -> `"NewTable.FieldName"`
- **nativeQueryRef strings**: if the table prefix changed
- **metadata selectors**: `"metadata": "OldTable.FieldName"` in `objects`
- **filter Entity references**: `"Entity": "OldTable"` in `From` arrays
- **FillRule/Conditional expressions**: deeply nested `SourceRef.Entity`
- **SparklineData metadata**: compact selector strings

```python
import os, json

replacements = {
    '"OldTableName"': '"NewTableName"',
    'OldTable.FieldName': 'NewTable.FieldName',
}

for root, dirs, files in os.walk('Report.Report/definition'):
    for f in files:
        if not f.endswith('.json'):
            continue
        path = os.path.join(root, f)
        with open(path) as fh:
            content = fh.read()
        original = content
        for old, new in sorted(replacements.items(), key=lambda x: -len(x[0])):
            content = content.replace(old, new)
        if content != original:
            json.loads(content)  # validate before writing
            with open(path, 'w') as fh:
                fh.write(content)
```

See `references/rename-patterns.md` for the complete list of locations where Entity references appear.

### Step 3: Handle slicer filter values carefully

**Critical distinction**: filter **field references** vs filter **literal values**.

- `"Entity": "TableName"` and `"Property": "FieldName"` are field references -- replace them
- `"Value": "'Gross Sales MTD vs. Budget'"` is a **data value** from the model -- do NOT replace unless the model data actually changed

Slicer default selections (in `objects.general[0].properties.filter`) contain literal values from the model's data. Only change these if the underlying data values in the model actually changed. Renaming a measure does not change slicer data values.

### Step 4: Handle removed fields

For fields that no longer exist in the model:

1. **Find a substitute**: Query the model for similar measures. Check `te get` for related DAX expressions.
2. **Add the missing measure**: If the measure was simply deleted, recreate it using `te add`:
   ```bash
   te add "TableName/MeasureName" -i "[Related Measure Expression]" \
     -s "workspace" -d "model" --save
   ```
3. **Remove from visual**: If no substitute exists, remove the projection from the visual's `queryState`.

### Step 5: Validate and deploy

```bash
# Validate structure
pbir validate "Report.Report" --allow-download-schemas

# Deploy
fab import "Workspace.Workspace/Report.Report" -i "Report.Report" -f
```

## Common Pitfalls

### queryRef mismatch causes blank visuals

Visuals may pass schema validation but render with no data if `queryRef` strings reference old table names. Power BI uses `queryRef` internally to match data to visual slots. Always update `queryRef` when renaming tables.

### Visual interactions lost during conversion

Legacy reports store visual interactions as `relationships` in the page config. These must be converted to `visualInteractions` in `page.json`. Only `NoFilter` interactions need to be stored (Filter is the default).

### Combo chart roles

`lineStackedColumnComboChart` and `lineClusteredColumnComboChart` use `Y` (column bars) and `Y2` (lines), NOT `ColumnY`/`LineY`.

### Report-level filters vs slicer-controlled filters

Avoid duplicating filter logic. If a slicer controls a field (e.g. Calendar Month), do not also add a report-level filter on the same field -- they will conflict and may narrow results unexpectedly.
