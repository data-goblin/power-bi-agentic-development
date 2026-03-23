# Finding Fields in Semantic Models

- When creating or modifying visuals, you need to use the correct field names from the semantic model
- This means that you need to first get an overview of the fields you can use before trying to modify the report metadata; to understand how fields are referenced in reports, see [field-references.md](field-references.md)
- You might have to query a semantic model to get field values, too, for certain circumstances

**Search locations:**

1. **reportExtensions.json** - Thin report measures (extension measures), visual calculations
2. **Semantic model** - Tables, columns, measures, hierarchies, calculation groups, functions

## Quick Methods

**Fastest:** Download the model and read `__field_index.md`:

```bash
python3 scripts/download-model.py --workspace "WorkspaceName" --model "ModelName" --output ./tmp/models --format tmdl
cat ./tmp/models/ModelName/__field_index.md
```

**CRITICAL:** Ask user permission before downloading. Don't download if model is already local or is a thick report

**Alternative:** Use `fab` commands to query the published model directly if you can't or prefer not to download the model (see commands below)

## Finding Fields in Published Models

### Tables in published models

```bash
fab get WorkspaceName.Workspace/ModelName.SemanticModel -q "definition.parts[?contains(path, 'definition/tables/')].path" | grep -o '[^/]*\.tmdl' | sed 's/\.tmdl$//' | sort
```

### Columns in published models

```bash
fab get WorkspaceName.Workspace/ModelName.SemanticModel -q "definition.parts[?contains(path, 'definition/tables/')].{table: path, payload: payload}" | python3 -c "
import json, sys
data = json.load(sys.stdin)
for item in data:
    table = item['table'].replace('definition/tables/', '').replace('.tmdl', '')
    for line in item['payload'].split('\n'):
        if line.startswith('\tcolumn '):
            col = line.replace('\tcolumn ', '').replace(\"'\", '').split(' =')[0].strip()
            print(f'{table}.{col}')
"
```

### Measures in published models

```bash
fab get WorkspaceName.Workspace/ModelName.SemanticModel -q "definition.parts[?contains(path, 'definition/tables/')].{table: path, payload: payload}" | python3 -c "
import json, sys
data = json.load(sys.stdin)
for item in data:
    table = item['table'].replace('definition/tables/', '').replace('.tmdl', '')
    for line in item['payload'].split('\n'):
        if line.startswith('\tmeasure '):
            measure = line.replace('\tmeasure ', '').split(' = ')[0].replace(\"'\", '').strip()
            print(f'{table}.{measure}')
"
```

### Hierarchies in published models

```bash
fab get WorkspaceName.Workspace/ModelName.SemanticModel -q "definition.parts[?contains(path, 'definition/tables/')].{table: path, payload: payload}" | python3 -c "
import json, sys
data = json.load(sys.stdin)
for item in data:
    table = item['table'].replace('definition/tables/', '').replace('.tmdl', '')
    for line in item['payload'].split('\n'):
        if line.startswith('\thierarchy '):
            hierarchy = line.replace('\thierarchy ', '').replace(\"'\", '').strip()
            print(f'{table}.{hierarchy}')
"
```

**Note:** All commands return results in `Table.Field` format, matching Power BI's field reference syntax

## Finding Fields in Local Models

For thick reports with local `.SemanticModel` folders, use these commands. Replace `path/to/Model.SemanticModel` with your actual path.

### Tables in local models

```bash
python3 << 'EOF'
import os, glob
base = "path/to/Model.SemanticModel/definition/tables"
tables = [os.path.basename(f).replace(".tmdl", "") for f in sorted(glob.glob(os.path.join(base, "*.tmdl")))]
for table in tables:
    print(table)
EOF
```

### Columns in local models

```bash
python3 << 'EOF'
import os, glob
base = "path/to/Model.SemanticModel/definition/tables"
for file in sorted(glob.glob(os.path.join(base, "*.tmdl"))):
    table = os.path.basename(file).replace(".tmdl", "")
    with open(file) as f:
        for line in f:
            if line.startswith("\tcolumn "):
                col = line.replace("\tcolumn ", "").replace("'", "").split(" =")[0].strip()
                print(f"{table}.{col}")
EOF
```

### Measures in local models

```bash
python3 << 'EOF'
import os, glob
base = "path/to/Model.SemanticModel/definition/tables"
for file in sorted(glob.glob(os.path.join(base, "*.tmdl"))):
    table = os.path.basename(file).replace(".tmdl", "")
    with open(file) as f:
        for line in f:
            if line.startswith("\tmeasure "):
                measure = line.replace("\tmeasure ", "").split(" = ")[0].replace("'", "").strip().rstrip("=").strip()
                print(f"{table}.{measure}")
EOF
```

### Hierarchies in local models

```bash
python3 << 'EOF'
import os, glob
base = "path/to/Model.SemanticModel/definition/tables"
for file in sorted(glob.glob(os.path.join(base, "*.tmdl"))):
    table = os.path.basename(file).replace(".tmdl", "")
    with open(file) as f:
        for line in f:
            if line.startswith("\thierarchy "):
                hierarchy = line.replace("\thierarchy ", "").replace("'", "").strip()
                print(f"{table}.{hierarchy}")
EOF
```

**Note:** All commands return results in `Table.Field` format, matching Power BI's field reference syntax

### Quick Reference Files

```bash
# Use __field_index.md if it exists (generated by download-model.py)
cat path/to/Model.SemanticModel/__field_index.md

# Read specific table definition
cat path/to/Model.SemanticModel/definition/tables/TableName.tmdl
```

## Getting Field Values

To get actual data values for filters/slicers, use [query-model.py](../../scripts/query-model.py):

```bash
python3 scripts/query-model.py --workspace "WorkspaceName" --model "ModelName" --table "Products" --column "Type"
```

See [script docs](../../scripts/README.md#query-modelpy) for details.

## See Also

- [Field References](field-references.md) - How to use field names in report JSON
- [Model Structure](model-structure.md) - Where fields are defined in model files
