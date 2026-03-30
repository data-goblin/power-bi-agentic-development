# Fabric CLI Utility Scripts

Python scripts extending `fab` CLI with common operations. All scripts use the same path syntax as fab commands.

## Path Syntax

All scripts use Fabric path format: `Workspace.Workspace/Item.ItemType`

```bash
# Examples
"Sales.Workspace/Model.SemanticModel"
"Production.Workspace/LH.Lakehouse"
"Dev.Workspace/Report.Report"
```

## Scripts

### create_direct_lake_model.py

Create a Direct Lake semantic model from lakehouse tables. This is the recommended approach for querying lakehouse data via DAX.

```bash
python3 create_direct_lake_model.py "src.Workspace/LH.Lakehouse" "dest.Workspace/Model.SemanticModel" -t schema.table
python3 create_direct_lake_model.py "Sales.Workspace/SalesLH.Lakehouse" "Sales.Workspace/Sales Model.SemanticModel" -t gold.orders
```

Arguments:

- `source` - Source lakehouse: Workspace.Workspace/Lakehouse.Lakehouse
- `dest` - Destination model: Workspace.Workspace/Model.SemanticModel
- `-t, --table` - Table in schema.table format (required)

### execute_dax.py

Execute DAX queries against semantic models.

```bash
python3 execute_dax.py "ws.Workspace/Model.SemanticModel" -q "EVALUATE VALUES('Date'[Year])"
python3 execute_dax.py "Sales.Workspace/Sales Model.SemanticModel" -q "EVALUATE TOPN(10, 'Orders')" --format csv
python3 execute_dax.py "ws.Workspace/Model.SemanticModel" -q "EVALUATE ROW(\"Total\", SUM('Sales'[Amount]))" -o results.json
```

Options:

- `-q, --query` - DAX query (required)
- `-o, --output` - Output file
- `--format` - Output format: table (default), csv, json
- `--include-nulls` - Include null values

### export_semantic_model_as_pbip.py

Export semantic model as PBIP (Power BI Project) format.

```bash
python3 export_semantic_model_as_pbip.py "ws.Workspace/Model.SemanticModel" -o ./output
python3 export_semantic_model_as_pbip.py "Sales.Workspace/Sales Model.SemanticModel" -o /tmp/exports
```

Creates complete PBIP structure with TMDL definition and blank report.

### download_workspace.py

Download complete workspace with all items and lakehouse files.

```bash
python3 download_workspace.py "Sales.Workspace"
python3 download_workspace.py "Production.Workspace" ./backup
python3 download_workspace.py "Dev.Workspace" --no-lakehouse-files
```

Options:

- `output_dir` - Output directory (default: ./workspace_downloads/<name>)
- `--no-lakehouse-files` - Skip lakehouse file downloads

## Requirements

- Python 3.10+
- `fab` CLI installed and authenticated
- For lakehouse file downloads: `azure-storage-file-datalake`, `azure-identity`
