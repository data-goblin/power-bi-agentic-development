---
name: c-sharp-scripting
description: This skill should be used when the user asks to "write a C# script", "create a Tabular Editor script", "automate model changes", "bulk update measures", "create calculation groups", "format DAX expressions", "manage model metadata", or mentions TOM (Tabular Object Model), XMLA, or C# scripting for Power BI semantic models. Provides comprehensive guidance for writing and executing C# scripts against Power BI semantic models using Tabular Editor 2/3 CLI or the Tabular Editor IDE.
---

# C# Scripting for Tabular Editor

Expert guidance for writing and executing C# scripts to manipulate Power BI semantic model metadata using Tabular Editor 2/3 CLI or the Tabular Editor IDE.


## When to Use This Skill

Activate automatically when tasks involve:

- Writing C# scripts for Tabular Editor
- Bulk operations on model objects (measures, columns, tables)
- Creating or modifying calculation groups
- Managing model security (roles, RLS, OLS)
- Formatting DAX expressions
- Automating repetitive model changes
- Querying model metadata via TOM API
- Building interactive scripts with user input dialogs


## Critical

- Every statement must end with `;` (semicolon required by C#)
- Use double quotes `"` for strings and escape with `\` when needed
- Use forward slashes `/` in DisplayFolder paths (auto-converted to `\`)
- Always add `Info()` statements for debugging - script stops at error point
- Test scripts on non-production models first
- Changes are undoable with Ctrl+Z in the Tabular Editor UI


## C# Version Support

| Environment | C# Version | Notes |
|-------------|------------|-------|
| **Tabular Editor 2** | Default compiler | Older C# syntax |
| **Tabular Editor 3** | Roslyn | Supports up to C# 12 with VS2022 |
| **TE2 with Roslyn** | Configurable | Set in File > Preferences > General |

To use newer C# features in TE2, configure Roslyn compiler path in preferences.


## Default Imports and Assemblies

### Auto-Imported Namespaces

Scripts automatically have these `using` statements applied:

```csharp
using System;
using System.Linq;
using System.Collections.Generic;
using Newtonsoft.Json;
using TabularEditor.TOMWrapper;
using TabularEditor.TOMWrapper.Utils;
using TabularEditor.UI;
```

### Pre-Loaded Assemblies

These .NET assemblies are loaded by default:

- `System.Dll`
- `System.Core.Dll`
- `System.Data.Dll`
- `System.Windows.Forms.Dll` (for UI dialogs)
- `Microsoft.Csharp.Dll`
- `Newtonsoft.Json.Dll`
- `TomWrapper.Dll`
- `TabularEditor.Exe`
- `Microsoft.AnalysisServices.Tabular.Dll`

### Adding External Assemblies

```csharp
// Assembly references must be at the very top of the file:
#r "System.IO.Compression"
#r "System.Drawing"

// Using statements come after assembly references:
using System.IO.Compression;
using System.Drawing;
```


## Prerequisites

### For Tabular Editor CLI

| Requirement | Description |
|-------------|-------------|
| **Tabular Editor 2 CLI** | Download from [GitHub releases](https://github.com/TabularEditor/TabularEditor/releases) |
| **XMLA Read/Write** | Enabled on Fabric capacity or Power BI Premium |
| **Azure Service Principal** | For XMLA connections (see authentication.md) |

### Environment Variables (for XMLA)

```
AZURE_CLIENT_ID=<app-id>
AZURE_TENANT_ID=<tenant-id>
AZURE_CLIENT_SECRET=<secret>
```


## Execution Methods

### 1. Tabular Editor CLI

```bash
# Inline script
TabularEditor.exe "WorkspaceName/ModelName" -S "Info(Model.Database.Name);"

# Script file
TabularEditor.exe "WorkspaceName/ModelName" -S "script.csx"
```

### 2. Connection Types

| Type | Format | Example |
|------|--------|---------|
| **XMLA** | `workspace/model` | `"Sales WS/Sales Model"` |
| **Local BIM** | `path/to/model.bim` | `"./model.bim"` |
| **Local TMDL** | `path/to/definition/` | `"./MyModel.SemanticModel/definition/"` |
| **PBI Desktop** | `localhost:PORT` | `"localhost:52123"` |


## Core Objects

### The `Model` Object

Access any object in the loaded Tabular Model:

```csharp
Model                           // Root model object
Model.Tables                    // All tables
Model.Tables["Sales"]           // Specific table
Model.AllMeasures               // All measures across all tables
Model.AllColumns                // All columns across all tables
Model.Relationships             // All relationships
Model.Roles                     // All security roles
Model.CalculationGroups         // All calculation groups
Model.Perspectives              // All perspectives
Model.Cultures                  // All translations/cultures
Model.Expressions               // All M expressions (shared queries)
Model.DataSources               // All data sources
```

### The `Selected` Object

Access objects currently selected in the TOM Explorer (IDE only):

```csharp
// Plural form - collections (safe even when empty)
Selected.Tables                 // Selected tables
Selected.Measures               // Selected measures
Selected.Columns                // Selected columns
Selected.Hierarchies            // Selected hierarchies

// Singular form - single object (error if not exactly one selected)
Selected.Table                  // The single selected table
Selected.Measure                // The single selected measure
Selected.Column                 // The single selected column

// Set properties on multiple objects at once
Selected.Measures.DisplayFolder = "Test";
Selected.Columns.IsHidden = true;

// Bulk rename with pattern
Selected.Measures.Rename("Amount", "Value");
```

When a Display Folder is selected, all child items are included in the selection.


## LINQ Fundamentals

LINQ (Language Integrated Query) is essential for filtering and transforming collections.

### Common LINQ Methods

| Method | Purpose | Example |
|--------|---------|---------|
| `Where(predicate)` | Filter collection | `.Where(m => m.Name.Contains("YTD"))` |
| `First([predicate])` | Get first item | `.First(t => t.Name == "Sales")` |
| `FirstOrDefault([predicate])` | Get first or null | `.FirstOrDefault(t => t.Name == "Sales")` |
| `Any([predicate])` | Check if any match | `.Any(m => m.IsHidden)` |
| `All(predicate)` | Check if all match | `.All(c => c.DataType == DataType.String)` |
| `Count([predicate])` | Count items | `.Count(m => !m.IsHidden)` |
| `Select(map)` | Transform items | `.Select(m => m.Name)` |
| `OrderBy(key)` | Sort ascending | `.OrderBy(m => m.Name)` |
| `OrderByDescending(key)` | Sort descending | `.OrderByDescending(m => m.Name)` |
| `ToList()` | Convert to List | `.Where(...).ToList()` |
| `ForEach(action)` | Execute on each | `.ForEach(m => m.IsHidden = true)` |

### Lambda Expression Syntax

```csharp
// Simple predicate (returns bool)
m => m.Name.Contains("YTD")

// Multi-condition predicate
m => m.Name.StartsWith("Total") && !m.IsHidden

// Complex predicate with curly braces
m => {
    if(m.Expression.Contains("CALCULATE")) {
        return m.Name.StartsWith("_");
    }
    return false;
}

// Action (no return value)
m => m.DisplayFolder = "Metrics"

// Map/projection
m => m.Name + " (" + m.Table.Name + ")"
```

### LINQ Examples

```csharp
// Filter measures by name pattern
var ytdMeasures = Model.AllMeasures.Where(m => m.Name.EndsWith("YTD"));

// Check if table exists before accessing
if(Model.Tables.Any(t => t.Name == "Sales")) {
    var sales = Model.Tables["Sales"];
}

// Get all hidden columns
var hiddenCols = Model.AllColumns.Where(c => c.IsHidden);

// Count measures per table
foreach(var t in Model.Tables) {
    Info($"{t.Name}: {t.Measures.Count()} measures");
}

// Find first matching or null
var dateTable = Model.Tables.FirstOrDefault(t => t.DataCategory == "Time");

// Chain operations
Model.AllMeasures
    .Where(m => m.Name.Contains("Revenue"))
    .Where(m => string.IsNullOrEmpty(m.FormatString))
    .ForEach(m => m.FormatString = "$#,0");
```


## Helper Methods

### Output and Messaging

| Method | Purpose |
|--------|---------|
| `Info(message)` | Display info popup (CLI: writes to console) |
| `Warning(message)` | Display warning popup |
| `Error(message)` | Display error popup and stop script |
| `Output(object)` | Display detailed object inspector dialog |

### Output() Variations

```csharp
// Scalar value - shows simple message
Output("Hello World");
Output(123);

// Single TOM object - shows property grid (editable)
Output(Model.Tables["Sales"].Measures["Revenue"]);

// Collection of TOM objects - shows list with property grid
Output(Model.AllMeasures.Where(m => m.IsHidden));

// DataTable - shows sortable grid
var dt = new System.Data.DataTable();
dt.Columns.Add("Name");
dt.Columns.Add("Expression");
foreach(var m in Model.AllMeasures) {
    dt.Rows.Add(m.Name, m.Expression);
}
Output(dt);
```

### File Operations

```csharp
SaveFile("path/to/file.txt", content);
string content = ReadFile("path/to/file.txt");
```

### Property Export/Import

```csharp
// Export to TSV
var tsv = ExportProperties(Model.AllMeasures, "Name,Expression,FormatString");
SaveFile("measures.tsv", tsv);

// Import from TSV
var tsv = ReadFile("measures.tsv");
ImportProperties(tsv);
```

### Interactive Selection (IDE Only)

```csharp
// Let user select a measure
var measure = SelectMeasure();
var measure = SelectMeasure(preselect, "Choose a base measure");

// Let user select from any collection
var table = SelectTable(Model.Tables, null, "Select target table");
var column = SelectColumn(table.Columns, null, "Select date column");
var obj = SelectObject(Model.AllMeasures, null, "Pick one");

// Multi-select
var selected = SelectObjects(Model.AllMeasures, null, "Pick measures");
```

### DAX Formatting

```csharp
// Queue for formatting (executed after script)
measure.FormatDax();

// Format immediately
CallDaxFormatter();

// Format collection
Model.AllMeasures.FormatDax();

// Convert locale (US/UK <-> non-US/UK)
var converted = ConvertDax(daxExpression, useSemicolons: true);
```

### DAX Execution (When Connected to AS)

```csharp
// Evaluate scalar or table expression
var result = EvaluateDax("SUM(Sales[Amount])");
var table = EvaluateDax("TOPN(10, Sales)");

// Execute DAX query returning DataSet
var ds = ExecuteDax("EVALUATE Sales");

// Execute and stream results
using(var reader = ExecuteReader("EVALUATE Sales")) {
    while(reader.Read()) { /* process rows */ }
}

// Execute TMSL command
ExecuteCommand(tmslJson);

// Execute XMLA command
ExecuteCommand(xmla, isXmla: true);
```

### Macro/Custom Action Invocation

```csharp
// Call another macro by name
CustomAction("Time Intelligence\\Create YTD");
CustomAction(Selected.Measures, "Format Measures");
```


## WinForms UI Patterns

Create interactive dialogs for user input using System.Windows.Forms.

### Basic Input Dialog

```csharp
#r "System.Drawing"

using System.Drawing;
using System.Windows.Forms;

// Hide the 'Running Macro' spinner
ScriptHelper.WaitFormVisible = false;

string userInput = "";

using(var form = new Form())
{
    form.Text = "Input Required";
    form.AutoSize = true;
    form.StartPosition = FormStartPosition.CenterScreen;
    form.AutoScaleMode = AutoScaleMode.Dpi;

    var font = new Font("Segoe UI", 11);

    var label = new Label() {
        Text = "Enter value:",
        Location = new Point(20, 20),
        AutoSize = true,
        Font = font
    };

    var textBox = new TextBox() {
        Location = new Point(20, 50),
        Width = 200,
        Font = font
    };

    var okButton = new Button() {
        Text = "OK",
        Location = new Point(20, 90),
        DialogResult = DialogResult.OK,
        Font = font
    };

    var cancelButton = new Button() {
        Text = "Cancel",
        Location = new Point(100, 90),
        DialogResult = DialogResult.Cancel,
        Font = font
    };

    form.AcceptButton = okButton;
    form.CancelButton = cancelButton;

    form.Controls.Add(label);
    form.Controls.Add(textBox);
    form.Controls.Add(okButton);
    form.Controls.Add(cancelButton);

    if(form.ShowDialog() == DialogResult.OK) {
        userInput = textBox.Text;
        Info("You entered: " + userInput);
    } else {
        Error("Cancelled!");
    }
}
```

### Dropdown Selection Dialog

```csharp
#r "System.Drawing"

using System.Drawing;
using System.Windows.Forms;

ScriptHelper.WaitFormVisible = false;

using(var form = new Form())
{
    form.Text = "Select Option";
    form.AutoSize = true;
    form.StartPosition = FormStartPosition.CenterScreen;

    var combo = new ComboBox() {
        Location = new Point(20, 20),
        Width = 150,
        DropDownStyle = ComboBoxStyle.DropDownList
    };
    combo.Items.AddRange(new object[] { "Option A", "Option B", "Option C" });
    combo.SelectedIndex = 0;

    var okButton = new Button() {
        Text = "OK",
        Location = new Point(20, 60),
        DialogResult = DialogResult.OK
    };

    form.Controls.Add(combo);
    form.Controls.Add(okButton);
    form.AcceptButton = okButton;

    if(form.ShowDialog() == DialogResult.OK) {
        Info("Selected: " + combo.SelectedItem.ToString());
    }
}
```


## Quick Reference

### Core Patterns

**Add a Measure:**
```csharp
var m = Model.Tables["Sales"].AddMeasure("Total Revenue", "SUM(Sales[Amount])");
m.FormatString = "$#,0";
m.DisplayFolder = "Key Metrics";
m.Description = "Total sales revenue";
Info("Added: " + m.Name);
```

**Iterate Tables/Columns:**
```csharp
foreach(var t in Model.Tables) {
    foreach(var c in t.Columns.Where(c => c.Name.EndsWith("Key"))) {
        c.IsHidden = true;
    }
}
Info("Hidden key columns");
```

**Conditional Operations:**
```csharp
foreach(var m in Model.AllMeasures) {
    if(m.Name.Contains("Revenue")) m.FormatString = "$#,0";
    if(m.Name.Contains("Rate")) m.FormatString = "0.00%";
}
```

**Create Calculation Group:**
```csharp
var cg = Model.AddCalculationGroup("Time Intelligence");
cg.Precedence = 10;

var ytd = cg.AddCalculationItem("YTD", "CALCULATE(SELECTEDMEASURE(), DATESYTD('Date'[Date]))");
var prior = cg.AddCalculationItem("Prior Year");
prior.Expression = @"
CALCULATE(
    SELECTEDMEASURE(),
    DATEADD('Date'[Date], -1, YEAR)
)
";
Info("Created calculation group");
```

### TOM API Quick Reference

| Object | Access | Common Properties |
|--------|--------|-------------------|
| **Model** | `Model` | `.Tables`, `.AllMeasures`, `.Relationships` |
| **Table** | `Model.Tables["Name"]` | `.Measures`, `.Columns`, `.Partitions`, `.IsHidden` |
| **Measure** | `Table.Measures["Name"]` | `.Expression`, `.FormatString`, `.DisplayFolder`, `.Description` |
| **Column** | `Table.Columns["Name"]` | `.DataType`, `.FormatString`, `.IsHidden`, `.SummarizeBy` |
| **Relationship** | `Model.Relationships` | `.FromTable`, `.ToTable`, `.IsActive`, `.CrossFilteringBehavior` |
| **Role** | `Model.Roles["Name"]` | `.Members`, `.TablePermissions` |
| **Hierarchy** | `Table.Hierarchies` | `.Levels`, `.DisplayFolder`, `.IsHidden` |
| **Partition** | `Table.Partitions` | `.Expression`, `.SourceType`, `.DataSource` |
| **Perspective** | `Model.Perspectives` | Objects have `.InPerspective["Name"]` |
| **Culture** | `Model.Cultures` | Objects have `.TranslatedNames["culture"]` |


## Object Type Reference

Detailed documentation for each object type in `object-types/`:

- `tables.md` - Table CRUD, properties, partitions
- `columns.md` - Column types, properties, sorting
- `measures.md` - Measure creation, formatting, organization
- `relationships.md` - Relationship management
- `calculation-groups.md` - Calculation groups and items
- `roles.md` - Roles, RLS, OLS configuration
- `hierarchies.md` - Hierarchy and level management
- `partitions.md` - Partition types and configuration
- `perspectives.md` - Perspective membership
- `translations.md` - Culture and translation management
- `annotations.md` - Custom metadata annotations


## Example Scripts

Example scripts organized by category in `examples/`:

### Structure & Organization
- `columns/` - Column properties, hiding, data types
- `relationships/` - Relationship creation and management
- `display-folders/` - Organize objects into folders
- `format-strings/` - Currency, percentage, date formats

### Measures & Calculations
- `measures/` - Measure CRUD and time intelligence
- `calculation-groups/` - Time intelligence calc groups

### Security
- `roles/` - Role and RLS configuration

### Bulk Operations
- `bulk-operations/` - Model initialization, batch updates

### Interactive Scripts
- `ui-dialogs/` - WinForms input dialogs


## Common Workflows

### 1. Bulk Format Measures

```csharp
var count = 0;
foreach(var m in Model.AllMeasures) {
    if(!string.IsNullOrEmpty(m.Expression)) {
        m.FormatDax();
        count++;
    }
}
Info("Formatted " + count + " measures");
```

### 2. Create Time Intelligence Measures

```csharp
var baseMeasure = Model.Tables["Metrics"].Measures["Sales Amount"];
var table = baseMeasure.Table;

var ytd = table.AddMeasure(
    baseMeasure.Name + " YTD",
    "CALCULATE([" + baseMeasure.Name + "], DATESYTD('Date'[Date]))"
);
ytd.FormatString = baseMeasure.FormatString;
ytd.DisplayFolder = "Time Intelligence";

var py = table.AddMeasure(
    baseMeasure.Name + " PY",
    "CALCULATE([" + baseMeasure.Name + "], SAMEPERIODLASTYEAR('Date'[Date]))"
);
py.FormatString = baseMeasure.FormatString;
py.DisplayFolder = "Time Intelligence";

Info("Created time intelligence measures");
```

### 3. Configure RLS

```csharp
var role = Model.AddRole("Regional Access");
role.ModelPermission = ModelPermission.Read;

// Add table filter
var salesPerm = role.TablePermissions.Find("Sales");
if(salesPerm == null) {
    salesPerm = role.AddTablePermission(Model.Tables["Sales"]);
}
salesPerm.FilterExpression = "[Region] = USERNAME()";

Info("Configured RLS for " + role.Name);
```

### 4. Audit Hidden Objects

```csharp
var hidden = new System.Text.StringBuilder();
hidden.AppendLine("Hidden Objects Report:");

foreach(var t in Model.Tables.Where(t => t.IsHidden)) {
    hidden.AppendLine("  Table: " + t.Name);
}

foreach(var c in Model.AllColumns.Where(c => c.IsHidden && !c.Table.IsHidden)) {
    hidden.AppendLine("  Column: " + c.DaxObjectFullName);
}

foreach(var m in Model.AllMeasures.Where(m => m.IsHidden)) {
    hidden.AppendLine("  Measure: " + m.DaxObjectFullName);
}

Output(hidden.ToString());
```


## Debugging & Troubleshooting

### Script Doesn't Complete

Add `Info()` checkpoints to find where script fails:

```csharp
Info("Step 1: Starting");
var table = Model.Tables["Sales"];
Info("Step 2: Got table");
var measure = table.AddMeasure("Test", "1");
Info("Step 3: Added measure");  // If this doesn't appear, AddMeasure failed
```

### Object Not Found

Check existence before accessing:

```csharp
if(Model.Tables.Contains("Sales")) {
    var table = Model.Tables["Sales"];
    // ...
} else {
    Error("Table 'Sales' not found");
}

// Or use FirstOrDefault
var table = Model.Tables.FirstOrDefault(t => t.Name == "Sales");
if(table == null) {
    Error("Table not found");
}
```

### Changes Not Appearing

- XMLA operations may take 2-5 seconds to sync
- Refresh Power BI Desktop connection after changes
- Check for silent errors (add `Info()` after each operation)


## TE2/TE3 Compatibility

Use preprocessor directives for version-specific code:

```csharp
#if TE3
    // TE3-specific code (version 3.10.0+)
    Info("Running in Tabular Editor 3");
#else
    // TE2 fallback
    Info("Running in Tabular Editor 2");
#endif
```

Check version at runtime:

```csharp
var majorVersion = Selected.GetType().Assembly.GetName().Version.Major;
if(majorVersion >= 3) {
    // TE3 code
}
```


## Best Practices

1. **Add Info() statements** - Track script execution and catch errors early
2. **Check object existence** - Use `.Contains()` or `.Any()` before accessing
3. **Use bulk operations** - Single script with loops is faster than multiple scripts
4. **Test on dev models** - Never test new scripts on production
5. **Use @"..." for DAX** - Multi-line strings for DAX expressions
6. **Format with FormatDax()** - After creating measures/columns
7. **Set DisplayFolder with /** - Forward slashes auto-convert to backslashes
8. **Hide the wait spinner** - `ScriptHelper.WaitFormVisible = false;` for UI dialogs


## Additional Resources

### Reference Files
- `object-types/` - Detailed API docs per object type
- `examples/` - Working script examples

### External References
- [Tabular Editor Advanced Scripting](https://docs.tabulareditor.com/te2/Advanced-Scripting.html)
- [TOM API Reference](https://learn.microsoft.com/en-us/dotnet/api/microsoft.analysisservices.tabular)
- [C# Scripts and Macros](https://docs.tabulareditor.com/getting-started/cs-scripts-and-macros.html)
- [Script Library](https://docs.tabulareditor.com/features/CSharpScripts/csharp-script-library.html)
