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
