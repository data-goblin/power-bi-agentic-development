# Converting BIM to TMDL

A PBIP semantic model can use either `model.bim` (single TMSL JSON file, legacy) or a `definition/` folder (TMDL files, modern). They are mutually exclusive; only one should exist. The `definition.pbism` version property determines the format: `1.0` = TMSL only, `4.0+` = TMSL or TMDL. TMDL is preferred for source control (smaller diffs, per-table files).

## Via Tabular Editor CLI

```bash
# Convert model.bim to TMDL folder
TabularEditor.exe Model.bim -T definition/

# Convert and run a script in one step
TabularEditor.exe Model.bim -S script.csx -T definition/
```

After conversion:
1. Delete `model.bim` from the `.SemanticModel/` folder (they are mutually exclusive)
2. Verify `definition.pbism` has `"version": "4.0"` or higher (required for TMDL)
3. Open the `.pbip` in PBI Desktop to validate the converted model loads correctly

## Via TOM TmdlSerializer (PowerShell)

If connected to a live model (PBI Desktop or XMLA endpoint):

```powershell
$tmdlFolder = "C:\path\to\MyModel.SemanticModel\definition"
[Microsoft.AnalysisServices.Tabular.TmdlSerializer]::SerializeModelToFolder($db.Model, $tmdlFolder)
```

Requires a recent `Microsoft.AnalysisServices.retail.amd64` NuGet package. If `TmdlSerializer` is not found, update the package or use Tabular Editor CLI instead.

## Converting Back (TMDL to BIM)

```bash
# Convert TMDL folder back to model.bim
TabularEditor.exe definition/ -B Model.bim
```
