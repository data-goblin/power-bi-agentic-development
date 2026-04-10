---
name: c-sharp-scripting
version: 0.22.4
description: Writing and executing C# scripts and macros against Power BI semantic models using Tabular Editor 2/3. Automatically invoke when the user mentions "C# script", "Tabular Editor script", "TOM scripting", "MacroActions.json", "XMLA", or asks to "automate model changes", "bulk update measures", "create calculation groups", "write a macro", "format DAX expressions", "manage model metadata".
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

LINQ is essential for filtering and transforming TOM collections. See **`references/linq-reference.md`** for the full method table, lambda syntax, and examples.

Key methods: `Where()`, `First()`, `FirstOrDefault()`, `Any()`, `All()`, `Count()`, `Select()`, `OrderBy()`, `ForEach()`, `ToList()`.

```csharp
// Common pattern: filter, chain, act
Model.AllMeasures
    .Where(m => m.Name.Contains("Revenue"))
    .Where(m => string.IsNullOrEmpty(m.FormatString))
    .ForEach(m => m.FormatString = "$#,0");
```


## Helper Methods

See **`references/helper-methods.md`** for the complete reference including Output() variations, file operations, property export/import, interactive selection dialogs, DAX formatting/execution, and macro invocation.

| Method | Purpose |
|--------|---------|
| `Info(message)` | Display info popup (CLI: writes to console) |
| `Warning(message)` | Display warning popup |
| `Error(message)` | Display error popup and stop script |
| `Output(object)` | Display detailed object inspector dialog |
| `SaveFile(path, content)` / `ReadFile(path)` | File I/O |
| `ExportProperties()` / `ImportProperties()` | TSV export/import |
| `SelectMeasure()` / `SelectTable()` | Interactive selection (IDE only) |
| `FormatDax()` / `CallDaxFormatter()` | DAX formatting |
| `EvaluateDax()` / `ExecuteDax()` | DAX execution (connected) |


## WinForms UI Patterns

For interactive dialogs (input forms, dropdowns, multi-select), see **`references/winforms-dialogs.md`**. Key setup: `#r "System.Drawing"`, `ScriptHelper.WaitFormVisible = false;`


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

180 working `.csx` scripts organized by category in `examples/`. Before writing a script from scratch, check if a relevant example already exists -- read the example, adapt it to the task, and modify as needed.

| Category | Scripts | Description |
|----------|---------|-------------|
| `bulk-operations/` | 8 | Model initialization, batch updates, clean names, sync folders, validate |
| `calculation-groups/` | 2 | Time intelligence, currency conversion |
| `columns/` | 20 | Data types, hiding, sorting, encoding hints, cardinality, properties |
| `cultures/` | 4 | Add/delete cultures, list, modify translations |
| `display-folders/` | 8 | Organize by type, clear, rename, add/remove folders |
| `evaluate-dax/` | 5 | Execute DAX, scalar queries, table queries, column sizes, optimize |
| `format-dax/` | 8 | Format measures, calculated columns/tables, KPIs, detail rows |
| `format-strings/` | 6 | Apply by name/pattern, custom formats, dynamic format strings |
| `functions/` | 4 | Add/delete/list/modify shared M functions |
| `hierarchies/` | 4 | Add/delete/list/modify hierarchies |
| `kpis/` | 4 | Add/delete/list/modify KPIs |
| `measures/` | 18 | Full CRUD, time intelligence, bulk create, move, hide/unhide |
| `model/` | 10 | Properties, compatibility level, dependencies, refresh, export stats |
| `partitions/` | 6 | Refresh, find-replace M, incremental refresh, hybrid tables |
| `perspectives/` | 4 | Add/delete/list/modify perspectives |
| `relationships/` | 5 | Create, naming conventions, RI violations, integrity, properties |
| `roles/` | 7 | Add/delete roles, members, RLS, OLS configuration |
| `shared-expressions/` | 6 | Named expressions, range parameters, M functions |
| `svg-measures/` | 15 | Bar charts, bullet charts, dumbbells, lollipops, waterfall, jitter |
| `tables/` | 36 | All table types (import, DirectQuery, Direct Lake, calculated, field parameter, date), refresh policies, RLS/OLS, properties |


## Common Workflows

See **`references/common-workflows.md`** for complete workflow scripts: bulk format measures, create time intelligence measures, configure RLS, audit hidden objects. Also check `examples/` for 180 working `.csx` scripts before writing from scratch.


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
- `examples/` - 180 working `.csx` scripts across 20 categories; always check here before writing from scratch

### Fetching Docs

To retrieve current TOM API reference docs, use `microsoft_docs_search` + `microsoft_docs_fetch` (MCP) if available, otherwise `mslearn search` + `mslearn fetch` (CLI). Search based on the user's request and run multiple searches as needed to ensure sufficient context before proceeding.

### External References
- [Tabular Editor Advanced Scripting](https://docs.tabulareditor.com/te2/Advanced-Scripting.html)
- [TOM API Reference](https://learn.microsoft.com/en-us/dotnet/api/microsoft.analysisservices.tabular)
- [C# Scripts and Macros](https://docs.tabulareditor.com/getting-started/cs-scripts-and-macros.html)
- [Script Library](https://docs.tabulareditor.com/features/CSharpScripts/csharp-script-library.html)
