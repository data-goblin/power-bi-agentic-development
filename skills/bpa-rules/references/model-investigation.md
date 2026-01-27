# Model Investigation for BPA Rule Generation

Investigate a semantic model's structure to generate targeted, relevant BPA rules. Two paths exist: published models (Fabric CLI) and local models (.bim / TMDL / PBIP).

## Path 1: Published Model (Fabric CLI)

When the model is published to Microsoft Fabric or Power BI Service, use the `fab` CLI to inspect it remotely.

### Prerequisites

- `fab` CLI installed and authenticated (`fab auth login`)
- Workspace access with at least Viewer permissions

### Discover the Model

```bash
# List semantic models in a workspace
fab ls "MyWorkspace.Workspace" --type SemanticModel

# Get model metadata
fab get "MyWorkspace.Workspace/SalesModel.SemanticModel"

# Get model definition parts (list all TMDL files)
fab get "MyWorkspace.Workspace/SalesModel.SemanticModel" -q "definition.parts[].path"
```

### Inspect Model Structure

```bash
# Read model.tmdl (top-level: culture, compatibility, annotations)
fab get "ws.Workspace/Model.SemanticModel" -q "definition.parts[?path=='model.tmdl'].payload | [0]"

# List all table TMDL files
fab get "ws.Workspace/Model.SemanticModel" -q "definition.parts[?starts_with(path, 'definition/tables/')][].path"

# Read a specific table definition
fab get "ws.Workspace/Model.SemanticModel" -q "definition.parts[?path=='definition/tables/Sales.tmdl'].payload | [0]"

# Read relationships
fab get "ws.Workspace/Model.SemanticModel" -q "definition.parts[?path=='definition/relationships.tmdl'].payload | [0]"

# Read expressions (Power Query / M)
fab get "ws.Workspace/Model.SemanticModel" -q "definition.parts[?path=='definition/expressions.tmdl'].payload | [0]"

# Read roles (RLS)
fab get "ws.Workspace/Model.SemanticModel" -q "definition.parts[?path=='definition/roles.tmdl'].payload | [0]"

# Read existing BPA annotations
fab get "ws.Workspace/Model.SemanticModel" -q "definition.parts[?path=='model.tmdl'].payload | [0]" | grep -i "BestPracticeAnalyzer"
```

### What to Look For

When inspecting via Fabric CLI, extract:

| Aspect | What to check | Command filter |
|--------|---------------|----------------|
| **Table count** | Number of tables | Count table TMDL files |
| **Measure count** | Number of measures per table | Look for `measure` keyword in table files |
| **Hidden objects** | Columns/tables marked `isHidden` | Grep for `isHidden` |
| **Descriptions** | Missing descriptions on visible objects | Grep for `description` presence |
| **DAX patterns** | CALCULATE, FILTER, ALL usage | Grep measure expressions |
| **Relationships** | Bi-directional, many-to-many | Read relationships.tmdl |
| **Partitions** | Import vs DirectQuery vs Direct Lake | Grep for `mode:` in table files |
| **Format strings** | Missing format strings on measures | Grep for `formatString` |
| **Display folders** | Organization of measures/columns | Grep for `displayFolder` |
| **Calculation groups** | Existence and item count | Look for calculationGroup tables |
| **RLS roles** | Security role definitions | Read roles.tmdl |

## Path 2: Local Model (.bim / TMDL / PBIP)

When the model is available locally as files.

### File Formats

| Format | Extension | Structure |
|--------|-----------|-----------|
| **model.bim** | `.bim` | Single JSON file containing entire model definition |
| **TMDL** | `.tmdl` | Directory of `.tmdl` text files (one per table, plus model/relationships/expressions) |
| **PBIP** | `.pbip` | Power BI Project format -- contains TMDL inside `<ModelName>.SemanticModel/definition/` |

### Finding the Model Files

**PBIP projects** (saved from Power BI Desktop via File > Save as > Power BI Project):
```
MyReport.Report/
MyModel.SemanticModel/
  definition/
    model.tmdl           # Top-level model settings
    relationships.tmdl    # All relationships
    expressions.tmdl      # Shared M expressions
    tables/
      Sales.tmdl          # Each table as separate file
      Date.tmdl
      Product.tmdl
  .platform
```

**model.bim** (exported from Tabular Editor or SSMS):
- Single JSON file
- All tables, measures, columns, relationships in one file
- Parse with `jq` for inspection

### Inspecting Local Files

**TMDL / PBIP:**
```bash
# List all tables
ls definition/tables/

# Count measures across all tables
grep -r "^[[:space:]]*measure " definition/tables/ | wc -l

# Find tables without descriptions
grep -rL "description:" definition/tables/

# Find measures without format strings
grep -A5 "measure " definition/tables/ | grep -B5 -v "formatString"

# Check for hidden objects
grep -r "isHidden" definition/tables/

# Find bi-directional relationships
grep -B2 -A2 "crossFilteringBehavior: bothDirections" definition/relationships.tmdl

# Find existing BPA annotations
grep -A1 "BestPracticeAnalyzer" definition/model.tmdl
```

**model.bim (JSON):**
```bash
# Count tables
jq '.model.tables | length' model.bim

# List table names
jq '.model.tables[].name' model.bim

# Count all measures
jq '[.model.tables[].measures // [] | length] | add' model.bim

# Find measures without descriptions
jq '.model.tables[].measures[]? | select(.description == null or .description == "") | .name' model.bim

# Find hidden columns
jq '.model.tables[].columns[]? | select(.isHidden == true) | "\(.name) in \(input_filename)"' model.bim

# Check relationships
jq '.model.relationships[] | {from: .fromTable, to: .toTable, crossFilter: .crossFilteringBehavior}' model.bim
```

## Guiding Users to Get Model Files

### Save as PBIP from Power BI Desktop

If the user has a .pbix file but no .bim or TMDL files, guide them to save as PBIP:

1. Open the .pbix file in Power BI Desktop
2. Go to **File > Save as**
3. In the Save dialog, change the file type dropdown to **Power BI Project (*.pbip)**
4. Choose a location and save
5. This creates a folder with `<Name>.SemanticModel/definition/` containing TMDL files

**Note:** PBIP is available in Power BI Desktop from October 2023 onward. The user may need to enable it under **File > Options > Preview features > Power BI Project (.pbip) save option** in older versions.

### Export from Tabular Editor

1. Open the model in Tabular Editor (File > Open > From DB or from .pbix)
2. **For .bim:** File > Save As > model.bim
3. **For TMDL:** File > Save As > choose TMDL folder format
4. Provide the path to the saved files

### Export from Fabric (via CLI)

```bash
# Export entire model definition as TMDL
python scripts/export_semantic_model_as_pbip.py "WorkspaceName.Workspace/ModelName.SemanticModel" /output/path
```

## Model Analysis Checklist

After inspecting the model, document these findings to inform rule generation:

- [ ] **Model size**: Number of tables, columns, measures
- [ ] **Storage mode**: Import, DirectQuery, Direct Lake, or mixed
- [ ] **Metadata completeness**: Descriptions, display folders, format strings
- [ ] **DAX complexity**: Calculation groups, UDFs, complex measure patterns
- [ ] **Relationships**: Bi-directional, many-to-many, inactive
- [ ] **Security**: RLS roles defined
- [ ] **Naming conventions**: Current patterns (CamelCase, spaces, prefixes)
- [ ] **Existing BPA rules**: Any already embedded in model annotations
- [ ] **Unused objects**: Hidden columns/measures with no references
