# Sample Scripts

Reference examples for C# scripting with Tabular Editor. These are **patterns** to learn from - write custom scripts tailored to each specific use case.


## Organization

| Directory | Purpose |
|-----------|---------|
| `measures/` | Measure CRUD, formatting, time intelligence, organization |
| `columns/` | Column properties, sorting, hiding, formatting |
| `calculation-groups/` | Time intelligence, currency conversion calc groups |
| `relationships/` | Relationship creation and management |
| `roles/` | Security roles, RLS, OLS configuration |
| `bulk-operations/` | Multi-object operations, model initialization |
| `display-folders/` | Organize objects into folders |
| `format-strings/` | Currency, percentage, date format application |
| `ui-dialogs/` | WinForms user interface patterns for interactive scripts |


## New Examples

### Interactive UI Scripts (`ui-dialogs/`)

- **`find-replace-dialog.csx`** - WinForms dialog for find/replace in measure expressions
- **`format-string-picker.csx`** - Dropdown dialog for applying format strings to selected measures

### Selected Object Patterns (`measures/`)

- **`selected-measures-to-folder.csx`** - Move selected measures to a chosen display folder


## Usage

### Tabular Editor CLI

**Windows (PowerShell):**
```powershell
TabularEditor.exe "WorkspaceName/ModelName" -S "examples/measures/add-measure.csx"
```

**macOS/Linux:**
```bash
TabularEditor "WorkspaceName/ModelName" -S "examples/measures/add-measure.csx"
```

### Tabular Editor IDE

1. Open model in Tabular Editor 2/3
2. Go to File > New C# Script (or use script pane)
3. Copy/paste script content
4. Press F5 or click Run


## Key Patterns Demonstrated

### WinForms UI

```csharp
#r "System.Drawing"
using System.Drawing;
using System.Windows.Forms;
ScriptHelper.WaitFormVisible = false;

using(var form = new Form()) {
    // ... build UI
    if(form.ShowDialog() == DialogResult.OK) {
        // ... process result
    }
}
```

### Selected Object Operations

```csharp
// Work with selected objects (IDE only)
if(!Selected.Measures.Any()) {
    Error("Select measures first");
    return;
}

foreach(var m in Selected.Measures) {
    m.DisplayFolder = "New Folder";
}
```

### LINQ Filtering

```csharp
// Filter and transform collections
Model.AllMeasures
    .Where(m => m.Name.Contains("Revenue"))
    .ForEach(m => m.FormatString = "$#,0");
```


## Important Notes

These samples demonstrate syntax and patterns. Always:

1. Review and adapt to your model structure
2. Test on non-production models first
3. Add appropriate error handling
4. Include Info() statements for debugging
5. Use `Selected` patterns only in Tabular Editor IDE (not CLI)
