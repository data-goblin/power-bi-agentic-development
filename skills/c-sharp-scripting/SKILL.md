---
name: c-sharp-scripting
description: This skill should be used when the user asks to "write a C# script", "create a Tabular Editor script", "automate model changes", "bulk update measures", "create calculation groups", "format DAX expressions", "manage model metadata", or mentions TOM (Tabular Object Model), XMLA, or C# scripting for Power BI semantic models. Provides comprehensive guidance for writing and executing C# scripts against Power BI semantic models using Tabular Editor.
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

## Critical

- Tabular Editor 2 uses **C# 10** syntax - avoid C# 11+ features
- Every statement must end with `;` (even single-line scripts)
- Use double quotes `"` for strings and escape with `\` when needed
- Use forward slashes `/` in DisplayFolder paths (auto-converted to `\`)
- Always add `Info()` statements for debugging - script stops at error point
- Test scripts on non-production models first

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
te "WorkspaceName/ModelName" "Info(Model.Database.Name);"

# Script file
te "WorkspaceName/ModelName" script.csx --file
```

### 2. Connection Types

| Type | Format | Example |
|------|--------|---------|
| **XMLA** | `workspace/model` | `"Sales WS/Sales Model"` |
| **Local BIM** | `path/to/model.bim` | `"./model.bim"` |
| **Local TMDL** | `path/to/definition/` | `"./MyModel.SemanticModel/definition/"` |
| **PBI Desktop** | `pbi-desktop` or `localhost:PORT` | `"pbi-desktop"` |

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

### Helper Functions

| Function | Purpose |
|----------|---------|
| `Info(message)` | Print info message to output |
| `Warning(message)` | Print warning |
| `Error(message)` | Print error and stop |
| `Output(message)` | Print to console |
| `Selected.Measures` | Currently selected objects (TE3 IDE) |

### LINQ Patterns

```csharp
// Filter by name pattern
Model.AllMeasures.Where(m => m.Name.StartsWith("Total"))

// Check existence
Model.Tables.Any(t => t.Name == "Sales")

// Count objects
Model.AllColumns.Count(c => c.IsHidden)

// Select properties
Model.Tables.Select(t => t.Name)
```

## Object Type Reference

Detailed documentation for each object type in `object-types/`:

- `tables.md` - Table CRUD, properties, partitions
- `columns.md` - Column types, properties, sorting
- `measures.md` - Measure creation, formatting, organization
- `relationships.md` - Relationship management
- `calculation-groups.md` - Calculation groups and items
- `roles.md` - Roles, RLS, OLS configuration

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
```

### Changes Not Appearing

- XMLA operations may take 2-5 seconds to sync
- Refresh Power BI Desktop connection after changes
- Check for silent errors (add `Info()` after each operation)

## Best Practices

1. **Add Info() statements** - Track script execution and catch errors early
2. **Check object existence** - Use `.Contains()` or `.Any()` before accessing
3. **Use bulk operations** - Single script with loops is faster than multiple scripts
4. **Test on dev models** - Never test new scripts on production
5. **Use @"..." for DAX** - Multi-line strings for DAX expressions
6. **Format with FormatDax()** - After creating measures/columns
7. **Set DisplayFolder with /** - Forward slashes auto-convert to backslashes

## Additional Resources

### Reference Files
- `object-types/` - Detailed API docs per object type
- `examples/` - Working script examples

### External References
- [Tabular Editor Advanced Scripting](https://docs.tabulareditor.com/te2/Advanced-Scripting.html)
- [TOM API Reference](https://learn.microsoft.com/en-us/dotnet/api/microsoft.analysisservices.tabular)
- [C# Scripts and Macros](https://docs.tabulareditor.com/getting-started/cs-scripts-and-macros.html)
