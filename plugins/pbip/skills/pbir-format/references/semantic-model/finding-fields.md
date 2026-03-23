# Finding Fields in Semantic Models

- When creating or modifying visuals, you need to use the correct field names from the semantic model
- This means that you need to first get an overview of the fields you can use before trying to modify the report metadata; to understand how fields are referenced in reports, see [field-references.md](field-references.md)
- You might have to query a semantic model to get field values, too, for certain circumstances

**WARNING:** The most efficient way to do this is by using the `te` command-line tool. The following guidance outlines alternatives using `fab` CLI and local metadata.

**Search locations:**

1. **reportExtensions.json** - Thin report measures (extension measures), visual calculations
2. **Semantic model** - Tables, columns, measures, hierarchies, calculation groups, functions

## Quick Methods

**Fastest:** Use `pbir model` to list fields from a connected report:

```bash
pbir model "Report.Report" -d              # All tables, columns, measures
pbir model "Report.Report" -d -t Sales     # Filter to specific table
```

**Alternative:** Use `te` or `fab` to query the published model directly (see commands below)

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

### Local Model Files

If the model is local (thick report with `byPath`), read TMDL files directly:

```bash
# Read specific table definition
cat path/to/Model.SemanticModel/definition/tables/TableName.tmdl
```

## Getting Field Values

To get actual data values for filters/slicers, query the model:

```bash
# Using pbir
pbir model "Report.Report" -q "EVALUATE VALUES('Products'[Type])"

# Using te
te query -q "EVALUATE VALUES('Products'[Type])" -s "WorkspaceName" -d "ModelName"
```

See [filter-pane.md](../filter-pane.md) for more DAX patterns for value discovery.

See [script docs](../../scripts/README.md#query-modelpy) for details.

## See Also

- [Field References](field-references.md) - How to use field names in report JSON
- **`tmdl` skill** - TMDL file structure, syntax, and editing (tables, columns, measures, hierarchies)
