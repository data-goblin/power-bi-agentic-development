---
name: c-sharp-macros
description: This skill should be used when the user asks to "create a macro", "write a Tabular Editor macro", "save a script as macro", "edit MacroActions.json", "automate TE3 actions", or mentions Tabular Editor C# macros. Provides guidance for creating, editing, and managing C# macros in Tabular Editor 3.
---

# Tabular Editor C# Macros

Expert guidance for creating and managing C# macros in Tabular Editor 3 for Power BI semantic model development.

## When to Use This Skill

Activate automatically when tasks involve:

- Creating new macros from C# scripts
- Editing or organizing existing macros
- Understanding MacroActions.json structure
- Setting up macro contexts and enabling conditions
- Sharing macros across teams

## Critical

- Macros execute C# code with full model access - ensure scripts are safe before saving
- Test scripts thoroughly in the C# Script pane before saving as macros
- ValidContexts determines where macros appear in right-click menus
- MacroActions.json is stored in `%LocalAppData%\TabularEditor3`

## About Macros

- Macros are saved C# scripts that can be reused across semantic models
- They appear in right-click context menus based on ValidContexts
- Macros can automate repetitive tasks like formatting DAX, creating measures, etc.
- The Enabled expression controls when a macro is available

## File Location

| Platform | Path |
|----------|------|
| **Windows** | `%LocalAppData%\TabularEditor3\MacroActions.json` |
| **Expanded** | `C:\Users\<Username>\AppData\Local\TabularEditor3\MacroActions.json` |

**Note:** There is only one macro file per user. Macros are not stored per-model or per-machine.

**Sharing macros:** To share macros across a team, export MacroActions.json and distribute via version control. Team members merge into their local file. Consider using symlinks for synchronized sharing.

### Cross-Platform Access (macOS/Linux)

When working on macOS or Linux with Tabular Editor installed in a Windows VM:

**Parallels on macOS:**
```
/Users/<macUser>/Library/Parallels/Windows Disks/{VM-UUID}/[C] <DiskName>.hidden/
```

Full path to MacroActions.json:
- `<ParallelsRoot>/Users/<WinUser>/AppData/Local/TabularEditor3/MacroActions.json`

**Other platforms:**
- **VMware Fusion** - Check `/Volumes/` for mounted Windows drives
- **WSL on Windows** - `/mnt/c/Users/<username>/AppData/Local/TabularEditor3/`

**Note:** The VM must be running for the filesystem to be accessible.

## Quick Reference

### Macro JSON Structure

Macros are stored in MacroActions.json with an `Actions` array:

| Field | Required | Type | Description |
|-------|----------|------|-------------|
| `Id` | No | int | Unique identifier (use -1 for auto-assignment) |
| `Name` | Yes | string | Display name (use `\` for folder paths: `Formatting\Format DAX`) |
| `Enabled` | No | string | C# expression returning bool for when macro is enabled (default: `"true"`) |
| `Execute` | Yes | string | C# script code to execute |
| `Tooltip` | No | string | Tooltip text shown on hover |
| `ValidContexts` | No | string | Context(s) where macro appears in menus |

```json
{
  "Actions": [
    {
      "Id": 0,
      "Name": "Formatting\\Format DAX",
      "Enabled": "Selected.Measures.Any()",
      "Execute": "foreach(var m in Selected.Measures) { m.FormatDax(); }",
      "Tooltip": "Formats DAX for selected measures",
      "ValidContexts": "Measure"
    }
  ]
}
```

### Valid Contexts

Contexts control where macros appear in the UI:

| Context | Description |
|---------|-------------|
| `Model` | Root model object |
| `Table` | Single table selected |
| `Tables` | Tables collection |
| `Measure` | Single measure selected |
| `Column` | Single column selected |
| `CalculatedColumn` | Calculated column |
| `CalculatedTable` | Calculated table |
| `Hierarchy` | Hierarchy object |
| `Level` | Hierarchy level |
| `Partition` | Table partition |
| `Relationship` | Relationship object |
| `Relationships` | Relationships collection |
| `DataSource` | Data source object |
| `DataSources` | Data sources collection |
| `Role` | Security role |
| `Roles` | Roles collection |
| `RoleMember` | Role member |
| `Perspective` | Perspective object |
| `Perspectives` | Perspectives collection |
| `Translation` | Translation/culture |
| `Translations` | Translations collection |
| `KPI` | KPI object |
| `CalculationGroup` | Calculation group table |
| `CalculationItem` | Calculation item |
| `Expression` | Named expression |
| `Expressions` | Expressions collection |
| `TablePermission` | RLS table permission |
| `PartitionCollection` | Partitions of a table |
| `Functions` | DAX UDFs |
| `SingularObjects` | Any single object |
| `FolderOrSingularObject` | Folder or single object |

**Multiple contexts:** Use comma-separated values: `"Table, Measure, Column"`

### Enabled Expressions

Common patterns for the `Enabled` field:

```csharp
// Always enabled
"true"

// Only when measures are selected
"Selected.Measures.Any()"

// Only when a single table is selected
"Selected.Table != null"

// Only when columns exist
"Selected.Columns.Any()"

// Only for hidden measures
"Selected.Measures.Any(m => m.IsHidden)"

// Only when connected to a workspace
"Model.Database.Server != null"
```

## Execute Script Patterns

### Common Script Objects

```csharp
// Selected object(s)
Selected.Measure      // Single measure (null if multiple/none)
Selected.Measures     // All selected measures
Selected.Table        // Single table
Selected.Tables       // All selected tables
Selected.Columns      // All selected columns

// Model access
Model                 // Root model object
Model.Tables          // All tables
Model.AllMeasures     // All measures in model
Model.Relationships   // All relationships

// Scripting helpers
Info("Message")       // Show info dialog
Warning("Message")    // Show warning
Error("Message")      // Show error
Output("text")        // Output to console
```

### Example Scripts

**Format all selected measures:**
```csharp
foreach(var m in Selected.Measures) {
    m.FormatDax();
}
```

**Create SUM measures for selected columns:**
```csharp
foreach(var c in Selected.Columns) {
    var measure = c.Table.AddMeasure(
        "Sum of " + c.Name,
        "SUM(" + c.DaxObjectFullName + ")"
    );
    measure.DisplayFolder = "Auto-generated";
}
```

**Hide all columns not used anywhere:**
```csharp
foreach(var c in Model.AllColumns.Where(c =>
    !c.IsHidden &&
    c.ReferencedBy.Count == 0 &&
    !c.UsedInRelationships.Any())) {
    c.IsHidden = true;
}
```

## File Locations

| File | Location | Purpose |
|------|----------|---------|
| `MacroActions.json` | `%LocalAppData%\TabularEditor3\` | Stores all macro definitions |

## Workflow

### Creating a Macro

1. Write and test your C# script in the Script pane
2. Click "Save as Macro" in the toolbar
3. Enter name (use `\` for folders: `Category\Name`)
4. Add tooltip description
5. Select appropriate context(s)
6. Save

### Sharing Macros

1. Export MacroActions.json from `%LocalAppData%\TabularEditor3\`
2. Share with team via version control
3. Team members merge into their MacroActions.json
4. Consider using symlinks for synchronized sharing

## Additional Resources

### Reference Files

- **`schema/macros-schema.json`** - JSON Schema for validating MacroActions.json *(temporary location)*

### Scripts

- **`scripts/validate_macros.py`** - Validate macro files for schema compliance

### External References

- [Tabular Editor Creating Macros](https://docs.tabulareditor.com/features/creating-macros.html)
- [Tabular Editor Macros View](https://docs.tabulareditor.com/features/views/macros-view.html)
- [C# Scripts and Macros](https://docs.tabulareditor.com/getting-started/cs-scripts-and-macros.html)
- [Tabular Editor Script Library](https://docs.tabulareditor.com/features/CSharpScripts/csharp-script-library.html)
- [Supported File Types](https://docs.tabulareditor.com/references/supported-files.html#macroactionsjson)


## Advanced Macro Patterns

### Overview

When building macros that execute DAX queries, you'll encounter patterns for embedding DAX in C#, handling query results, building dynamic queries from user selections, and optimizing performance.

These patterns are applicable to any macro that queries or manipulates semantic model data.

**Source**: Extracted from production macro development at https://github.com/vdvoorder/tabular-editor-macros

### Core Patterns

#### Embedding DAX in C#

See `references/dax-in-csharp.md` for patterns including:
- Verbatim strings with escaped quotes
- String interpolation with `DaxObjectFullName`
- Multi-line string building for complex queries
- InvariantCulture for number formatting

**Key principle**: Use `@""` for DAX strings, escape inner quotes with `""`, use `DaxObjectFullName` for table/column references.

#### Handling DAX Results

See `references/dax-results-handling.md` for patterns including:
- DBNull checking before type conversion (critical - DAX BLANK maps to DBNull)
- Column name format (DAX returns names with brackets: `"[ColumnName]"`)
- Building output DataTables with proper types
- Conditional column addition based on pre-scanning

**Key principle**: Always check `row["[Column]"] == DBNull.Value` before `Convert.ToXxx()`.

#### Dynamic Query Construction

See `references/dynamic-queries.md` for patterns including:
- Selection-aware query building (columns vs tables vs measures)
- Same-table validation for multi-column operations
- Building UNION queries from multiple ROW() expressions
- Type-conditional queries (Boolean columns need FORMAT wrapper for MINX/MAXX)
- Error resilience per object

**Key principle**: Build DAX dynamically from TOM metadata, validate selections, handle type-specific edge cases.

#### Performance Optimization

See `references/performance-patterns.md` for patterns including:
- **Counter-intuitive**: Multiple separate `EvaluateDax()` calls outperform batched UNION queries
- TopN sampling for large tables (10-100x speedup)
- Stopwatch timing for user feedback
- Pre-scanning to skip unnecessary expensive calculations
- Phased execution (cheap operations first)

**Key principle**: Measure, don't guess. DAX engine parallelizes separate queries better than it parallelizes subqueries.

### Quick Reference

```csharp
// Pattern: Safe DAX result handling
var result = EvaluateDax(dax) as System.Data.DataTable;
if (result == null || result.Rows.Count == 0) return;

foreach (System.Data.DataRow row in result.Rows)
{
    // Always check for DBNull
    long value = row["[Column]"] == DBNull.Value
        ? 0
        : Convert.ToInt64(row["[Column]"]);
}

// Pattern: Dynamic query from selection
foreach (var col in Selected.Columns)
{
    string dax = $@"
    ROW(
        ""Column"", ""{col.Name}"",
        ""Count"", COUNTROWS({col.Table.DaxObjectFullName})
    )";

    var colResult = EvaluateDax(dax);
    // Process result
}

// Pattern: Boolean column handling
string minExpr = IsBooleanColumn(col)
    ? $@"MINX({table}, FORMAT({column}, ""True/False""))"
    : $@"MINX({table}, {column})";
```

### Common Edge Cases

1. **Boolean columns**: MINX/MAXX don't support Boolean directly - wrap with `FORMAT([Column], "True/False")`
2. **DBNull values**: Always check before type conversion
3. **Column names in results**: Include brackets: `row["[ColumnName]"]`
4. **Number formatting in DAX**: Use `InvariantCulture` to avoid culture-dependent decimal separators
5. **Same-table requirement**: Many operations require all selected columns from same table

## Example Macros

### Format Numeric Measures

```json
{
  "Id": 0,
  "Name": "Formatting\\Format Numeric Measures",
  "Enabled": "Selected.Measures.Any()",
  "Execute": "foreach(var m in Selected.Measures.Where(m => string.IsNullOrEmpty(m.FormatString))) { m.FormatString = \"#,##0\"; }",
  "Tooltip": "Applies #,##0 format to measures without a format string",
  "ValidContexts": "Measure"
}
```

### Create Calculation Group

```json
{
  "Id": 1,
  "Name": "Create\\New Calculation Group",
  "Enabled": "true",
  "Execute": "var cg = Model.AddCalculationGroup(\"New Calculation Group\"); cg.AddCalculationItem(\"Default\", \"SELECTEDMEASURE()\");",
  "Tooltip": "Creates a new calculation group with a default item",
  "ValidContexts": "Model, Tables"
}
```
