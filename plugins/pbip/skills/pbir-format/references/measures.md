# Extension Measures (Thin Report Measures)

## Overview

Extension measures are DAX measures defined in `reportExtensions.json` that exist **only in the report layer**, not in the semantic model. They are also called "thin report measures" or "report-level measures."

They are useful for the following: 
- Report-specific calculations that don't need to be re-used in other reports and therefore shouldn't be in the model
- Centralizing formatting logic in DAX rather than custom bespoke formatting split over many visuals. This might be better as a model measure if this must be re-used across multiple reports.


They are **not** useful in the following scenarios:
- Report-specific calculations or logic for a single visual. This is better done with a DAX visual calculation (visicalc, viz calc)
- Calculations or logic (including conditional formatting logic) that must apply to multiple reports. This is better done with model measures.
- Objects that must be in-memory (i.e. used as a category or filter). This obviously must be done in the model.

> [!NOTE] You can always consider creating a composite model if you need special logic or calculations that apply to a subset of reports


## Why Use Extension Measures

### The Formatting Centralization Pattern

**Problem:** Applying conditional formatting across multiple visuals requires:
- Repeating logic in each visual's conditional formatting dialog
- Manual updates when logic changes
- Inconsistency when logic differs between visuals

**Solution:** Define formatting logic once in an extension or model measure, reference it everywhere. That way, if you want to change the logic, you only do it once. Ideally, however, you should reference theme semantic colors like "bad", "good", etc. rather than custom hex colors such as "#171717" or "#FAFAFA".

**Benefits:**
1. **Centralized logic** - Change formatting rules in one place
2. **No model changes** - No semantic model permissions or refresh needed
3. **Version control friendly-ish** - Stored in reportExtensions.json alongside visual definitions. Not ideal, but better than nothing, I guess...
4. **Reusable** - Same measure drives colors, sizes, transparency, and even text across visuals
5. **Theme integration** - Can reference theme colors which centralize colors while the extension measures centralize the conditional logic

### When to Use Extension Measures vs Model Measures

| Extension Measures | Model Measures |
|-------------------|----------------|
| Formatting logic (colors, sizes) | Core business metrics |
| Report-specific calculations | Reusable across all reports |
| Rapid prototyping/testing | Certified/validated metrics |
| Don't require model permissions | Available in Excel, other tools |
| Self-contained in report | Centralized in semantic model |

**Rule of thumb:** Use extension measures for formatting and report-specific logic. Use model measures for business calculations.

## reportExtensions.json Structure

### File Location

```
ReportName.Report/
└── definition/
    ├── reportExtensions.json  ← Extension measures defined here (optional)
    ├── report.json
    └── pages/
```

**IMPORTANT:** The `reportExtensions.json` file is **optional**. If you have no extension measures, **delete the file entirely** rather than leaving an empty structure. An empty file with `"entities": []` will cause Power BI Desktop to fail during deserialization with the error:

```
Cannot perform interop call to: ModelAuthoringHostService.UpdateModelExtensions(args:1) -
wrong arg[0]=extensions value [ { "name": "extension" } ]
```

**When to include reportExtensions.json:**
- ✅ When you have at least one extension measure defined
- ❌ When you have no extension measures (delete the file)

**Moving from extension measures to model measures:**
If you move all extension measures to the semantic model (e.g., from `reportExtensions.json` to TMDL tables), remember to:
1. Delete `reportExtensions.json` entirely
2. Update all visual references to remove `"Schema": "extension"` from SourceRefs

### Schema

```json
{
  "$schema": "https://developer.microsoft.com/json-schemas/fabric/item/report/definition/reportExtension/1.0.0/schema.json",
  "name": "extension",
  "entities": [
    {
      "name": "EntityName",
      "measures": [
        {
          "name": "MeasureName",
          "dataType": "Text",
          "expression": "DAX expression",
          "formatString": "#,0.00",
          "displayFolder": "Formatting\\Colors",
          "description": "What this measure does",
          "hidden": false,
          "references": {
            "measures": [...]
          }
        }
      ]
    }
  ]
}
```

### Required Fields

**Root level:**
- `$schema` - Must be reportExtension schema URL
- `name` - Always `"extension"` (this is the schema name for references)

**Entity level:**
- `name` - **CRITICAL: Must be an EXISTING entity/table from the semantic model**
  - Cannot create new entities in reportExtensions.json
  - Must match exact table name from model (case-sensitive)
  - Use `pbir model "Report.Report" -d` or `te` to discover available tables

**Measure level:**
- `name` - Measure name (must be unique across model and all extension measures)
- `dataType` - Data type (see Data Types section)
  - **CRITICAL: For formatting measures (colors, etc.), must be `"Text"`**
- `expression` - DAX expression as a string

### Optional Fields

**Measure level:**
- `references` - Track dependencies on model measures (see References section)
- `hidden` - Hide from field list (boolean)
- `formatString` - VBA-style format string (e.g., `"#,0.00"`)
- `description` - Documentation string
- `displayFolder` - Organize in field list (e.g., `"Colors\\Status"`)
- `dataCategory` - Extended category (e.g., `"WebURL"`, `"ImageURL"`)
- `annotations` - Custom metadata (array of name/value pairs)
- `measureTemplate` - Template tracking info (for DAX templates)

## Discovering Model Entities

**CRITICAL:** Extension measures must be added to EXISTING entities (tables) from the semantic model. Before creating extension measures, you need to know what entities are available.

### Discovering Entities

Use `pbir model`, `te`, or `fab` to list available tables:

```bash
# Using pbir (preferred -- reads from connected model)
pbir model "Report.Report" -d

# Using te (explicit workspace/model)
te query -q "SELECT [Name] FROM $SYSTEM.TMSCHEMA_TABLES" -s "Workspace" -d "Model"

# Using fab
fab get "ws.Workspace/Model.SemanticModel" -q "definition" | grep "^table "
```

### Using Entities for Extension Measures

"Entities" in reportExtensions.json are table names from the semantic model. You need to discover what tables exist before adding extension measures.

**Pick an existing table** to host your extension measures:

**Option 1: Use a measure-heavy table**
```json
{
  "entities": [
    {
      "name": "Sales",  // ← Existing entity from model
      "measures": [
        {
          "name": "Revenue Color",  // ← New extension measure
          "dataType": "Text",
          "expression": "IF([Total Revenue] >= [Target Revenue], \"#4CAF50\", \"#D64550\")"
        }
      ]
    }
  ]
}
```

**Option 2 (PREFERRED): Use a dedicated measures or reporting objects table (if one exists)**

If none exists, you might want to advise the user to create a new table or calculated table specifically for extension measures that is hidden. This ensures organization and makes it easier to find/use these measures.

```json
{
  "entities": [
    {
      "name": "__ExtensionMeasures",
      "measures": [
        {
          "name": "KPI Color",
          "dataType": "Text",
          "expression": "..."
        }
      ]
    }
  ]
}
```


**If no dedicated measure table exists:** Then you should ask the user where the measure should go.


### Checking Current reportExtensions.json

If the report already has extension measures, check what entities are used:

```bash
jq '.entities[].name' reportExtensions.json
```

Example output:
```
"_Demo of SVG Measures"
"Budget"
```

These are existing entities from the model that already host extension measures.

**IMPORTANT:** You might want to advise the user to organize these extension measures under a dedicated table for organizational purposes.


## Creating Extension Measures

### Basic Formatting Measure

**Step 1: Identify existing entity from model**

Check reportExtensions.json to find available entities. For this example, we'll use `__ExtensionMeasures`.

**Step 2: Define in reportExtensions.json:**

```json
{
  "$schema": "https://developer.microsoft.com/json-schemas/fabric/item/report/definition/reportExtension/1.0.0/schema.json",
  "name": "extension",
  "entities": [
    {
      "name": "__ExtensionMeasures",
      "measures": [
        {
          "name": "Status Color",
          "dataType": "Text",  // ← MUST be "Text" for conditional formatting measures
          "expression": "IF([Revenue] >= [Target], \"good\", \"bad\")",
          "displayFolder": "Formatting",
          "description": "Returns theme color name based on revenue vs target"
        }
      ]
    }
  ]
}
```

**Step 3: Use in visual.json:**

```json
{
  "dataPoint": [
    {},
    {
      "properties": {
        "fill": {
          "solid": {
            "color": {
              "expr": {
                "Measure": {
                  "Expression": {
                    "SourceRef": {
                      "Schema": "extension",  // ← Required for extension measures
                      "Entity": "Budget"      // ← Must match entity name exactly
                    }
                  },
                  "Property": "Status Color"  // ← Extension measure name
                }
              }
            }
          }
        }
      },
      "selector": {
        "data": [{
          "dataViewWildcard": {"matchingOption": 1}
        }]
      }
    }
  ]
}
```

### Organizing Extension Measures

**Best Practices (from SQLBI):**

1. **Choose appropriate existing entity**
   - **CANNOT create new entities** - must use existing tables from model
   - Prefer measure-only tables (e.g., `_Measures`, `KPIs`) if they exist
   - Otherwise use primary fact table (e.g., `Sales`, `Budget`)

2. **Clear naming conventions**
   - Descriptive names: `"Status Color"`, `"Variance Indicator"`, `"Alert Icon"`
   - Avoid generic names like `"Color1"`, `"Format"`
   - Prefix with purpose if needed: `"Fmt_Revenue_Color"`, `"Chart_Line_Color"`

3. **Use display folders to organize**
   ```json
   "displayFolder": "Formatting\\Colors"
   ```
   - Groups extension measures visually in field list
   - Separates them from model measures

4. **Hidden property**
   ```json
   "hidden": true
   ```
   - Not necessary or recommended for extension measures

5. **Document each measure**
   ```json
   "description": "Returns hex color based on KPI status thresholds"
   ```
   - Descriptions should be concise and friendly, aligning with conventions already in place in the model. They should include a justification about why the extension measure exists and is not a visual calculation or model measure.

**Example organization:**

```json
{
  "name": "extension",
  "entities": [
    {
      "name": "Sales",  // ← Existing entity from model
      "measures": [
        {
          "name": "KPI Color",
          "displayFolder": "Formatting\\Colors",
          "dataType": "Text",
          "expression": "...",
          "description": "Returns hex color based on KPI status",
          "hidden": false
        },
        {
          "name": "Trend Arrow",
          "displayFolder": "Formatting\\Icons",
          "dataType": "Text",
          "expression": "...",
          "description": "Returns Unicode arrow based on trend direction",
          "hidden": false
        },
        {
          "name": "_Helper Variance",
          "displayFolder": "Formatting\\Helpers",
          "dataType": "Double",
          "expression": "[Revenue] - [Revenue PY]",
          "description": "Internal helper for variance calculations",
          "hidden": true  // ← Hide from field list
        },
        {
          "name": "Alert Transparency",
          "displayFolder": "Formatting\\Visual Effects",
          "dataType": "Int64",
          "expression": "IF([_Helper Variance] < 0, 60, 0)",
          "description": "Returns 0-100 transparency for alert highlighting",
          "hidden": false
        }
      ]
    }
  ]
}
```

**Result in Power BI field list:**
```
Sales
├── [model measures...]
└── Formatting
    ├── Colors
    │   └── KPI Color
    ├── Icons
    │   └── Trend Arrow
    ├── Visual Effects
    │   └── Alert Transparency
    └── Helpers
        └── _Helper Variance (hidden)
```

## Data Types

Extension measures support these primitive data types:

### Common Types for Formatting

| dataType | Use For | Return Examples |
|----------|---------|----------------|
| `"Text"` | **Colors**, icons, labels | `"good"`, `"bad"`, `"#FF0000"`, `"⬆"`, `"High"` |
| `"Int64"` | Sizes, transparency, counts | `0`, `50`, `100` |
| `"Double"` | Decimal values, percentages | `0.5`, `85.5` |
| `"Boolean"` | Show/hide toggles | `TRUE()`, `FALSE()` |

**CRITICAL:** For color formatting (strokeColor, fill, etc.), dataType **MUST** be `"Text"`. Any other type will fail.

### All Available Types

From schema: `Binary`, `Boolean`, `Date`, `DateTime`, `DateTimeZone`, `Decimal`, `Double`, `Duration`, `Integer`, `Int64`, `Json`, `None`, `Null`, `Text`, `Time`, `Variant`

### Type Requirements by Property

**Colors (strokeColor, fill, etc.):**
- Must use `"Text"` dataType
- **In extension measures:** Can return theme color names (`"good"`, `"bad"`, `"neutral"`, `"minColor"`, `"maxColor"`)
- **In JSON literals:** Must use hex codes (`"#RRGGBB"` or `"#RRGGBBAA"`)
- Cannot return CSS color names or RGBA() format
- Can return empty string `""` to use default

**Transparency:**
- Use `"Int64"` or `"Double"`
- Return 0-100 (0 = opaque, 100 = fully transparent)

**Sizes (fontSize, strokeWidth, etc.):**
- Use `"Int64"` or `"Double"`
- Return numeric value (units depend on property)

**Show/Hide properties:**
- Use `"Boolean"`
- Return `TRUE()` or `FALSE()`

## DAX Expression Patterns

### Conditional Colors

**Simple binary:**
```dax
IF(
    [Actual] >= [Target],
    "good",   // Green - success
    "bad"     // Red - fail
)
```

**Multiple thresholds:**
```dax
SWITCH(
    TRUE(),
    [Variance %] >= 0.10, "good",     // Green - exceeding
    [Variance %] >= 0, "neutral",     // Blue - meeting
    [Variance %] >= -0.10, "neutral", // Orange - warning
    "bad"                              // Red - critical
)
```

**Three-color diverging:**
```dax
// Return theme color names for use with linearGradient3
VAR _Value = [Metric]
VAR _Min = CALCULATE(MIN([Metric]), ALL())
VAR _Max = CALCULATE(MAX([Metric]), ALL())
RETURN
    IF(
        _Value < (_Min + (_Max - _Min) * 0.5),
        "minColor",
        IF(_Value > (_Min + (_Max - _Min) * 0.5), "maxColor", "midColor")
    )
```

### Multiline DAX Expressions

Use proper line breaks in JSON strings:

```json
{
  "name": "Complex Color Logic",
  "dataType": "Text",
  "expression": "\n    VAR _CurrentValue = [Sales]\n    VAR _PriorValue = [Sales PY]\n    VAR _VariancePct = \n        DIVIDE(\n            _CurrentValue - _PriorValue,\n            _PriorValue\n        )\n    RETURN\n        SWITCH(\n            TRUE(),\n            _VariancePct >= 0.20, \"good\",\n            _VariancePct >= 0.05, \"neutral\",\n            _VariancePct >= -0.05, \"neutral\",\n            \"bad\"\n        )\n    "
}
```

**Formatting tip:** Leading `\n` makes DAX readable in formatted JSON.

### Referencing Model Measures

Extension measures can reference model measures:

```json
{
  "name": "YTD Indicator",
  "dataType": "Text",
  "expression": "IF([YTD Sales] > [YTD Sales PY], \"⬆\", \"⬇\")",
  "references": {
    "measures": [
      {
        "entity": "Sales",
        "name": "YTD Sales"
      },
      {
        "entity": "Sales",
        "name": "YTD Sales PY"
      }
    ]
  }
}
```

**The `references` object:**
- Documents which model measures this extension measure depends on
- Power BI uses this for dependency tracking
- Helps with refresh/update logic

### Referencing Other Extension Measures

Extension measures can reference each other:

```json
{
  "entities": [
    {
      "name": "Sales",  // ← Existing entity from model
      "measures": [
        {
          "name": "Base Status",
          "dataType": "Text",
          "expression": "IF([Revenue] >= [Target], \"Good\", \"Bad\")"
        },
        {
          "name": "Status Color",
          "dataType": "Text",
          "expression": "IF([Base Status] = \"Good\", \"#4CAF50\", \"#D64550\")",
          "references": {
            "measures": [
              {
                "schema": "extension",  // ← Required for extension measure references
                "entity": "Sales",      // ← Entity hosting the extension measure
                "name": "Base Status"   // ← Extension measure name
              }
            ]
          }
        }
      ]
    }
  ]
}
```

**Note the `"schema": "extension"` field when referencing other extension measures.**

## Referencing Extension Measures in Visuals

### The SourceRef Pattern

Extension measures require `"Schema": "extension"` in the SourceRef:

```json
"expr": {
  "Measure": {
    "Expression": {
      "SourceRef": {
        "Schema": "extension",    // ← Required for extension measures
        "Entity": "Budget"        // ← Entity name from reportExtensions.json (MUST be existing entity)
      }
    },
    "Property": "Status Color"    // ← Measure name
  }
}
```

**Contrast with model measures:**

```json
"expr": {
  "Measure": {
    "Expression": {
      "SourceRef": {
        "Entity": "Sales"         // ← No Schema field for model measures
      }
    },
    "Property": "Total Revenue"
  }
}
```

### Using with Selectors

**Global (single evaluation):**
```json
{
  "properties": {
    "strokeColor": {
      "solid": {
        "color": {
          "expr": {
            "Measure": {
              "Expression": {
                "SourceRef": {
                  "Schema": "extension",
                  "Entity": "Sales"
                }
              },
              "Property": "Overall Color"
            }
          }
        }
      }
    }
  }
}
```
- No selector = applies to entire series
- Measure evaluates once in visual context

**Per-data-point (conditional per category):**
```json
{
  "properties": {
    "strokeColor": {
      "solid": {
        "color": {
          "expr": {
            "Measure": {
              "Expression": {
                "SourceRef": {
                  "Schema": "extension",
                  "Entity": "Sales"  // ← Existing entity hosting extension measure
                }
              },
              "Property": "Category Color"
            }
          }
        }
      }
    }
  },
  "selector": {
    "data": [{
      "dataViewWildcard": {
        "matchingOption": 1  // ← Per-instance evaluation
      }
    }]
  }
}
```
- Measure evaluates for each data point
- Enables different colors per category/segment
- **Critical for line segment conditional formatting**

See `schema-patterns/conditional-formatting.md` for detailed selector patterns.

## Common Patterns

### Pattern 1: Status Indicator Colors

**Extension measure:**
```json
{
  "name": "Performance Color",
  "dataType": "Text",
  "expression": "\n    VAR Status = [Performance Status]\n    RETURN\n        SWITCH(\n            Status,\n            \"Exceeding\", \"#4CAF50\",\n            \"Meeting\", \"#118DFF\",\n            \"Warning\", \"#FFA500\",\n            \"Critical\", \"#D64550\",\n            \"#666666\"  // Default gray\n        )\n    ",
  "references": {
    "measures": [
      {
        "entity": "KPIs",
        "name": "Performance Status"
      }
    ]
  }
}
```

**Use in multiple visuals:**
- Line chart stroke color
- Bar chart fill color
- Card background color
- Data label color

All reference the same measure → change logic once, applies everywhere.

### Pattern 2: Variance-Based Formatting

**Extension measure:**
```json
{
  "name": "Variance Color",
  "dataType": "Text",
  "expression": "\n    VAR Variance = [Revenue] - [Revenue PY]\n    VAR VariancePct = DIVIDE(Variance, [Revenue PY])\n    RETURN\n        IF(\n            ISBLANK(VariancePct), \"\",\n            IF(\n                VariancePct >= 0.05, \"#4CAF50\",\n                IF(\n                    VariancePct <= -0.05, \"#D64550\",\n                    \"#666666\"\n                )\n            )\n        )\n    "
}
```

**Handles blanks gracefully** - returns empty string when no prior year data.

### Pattern 3: Dynamic Transparency

**Extension measure:**
```json
{
  "name": "Highlight Transparency",
  "dataType": "Int64",
  "expression": "\n    // Fade out non-selected items\n    IF(\n        [Is Selected] = TRUE(),\n        0,    // Fully opaque\n        75    // Mostly transparent\n    )\n    "
}
```

**Use in visual:**
```json
"transparency": {
  "expr": {
    "Measure": {
      "Expression": {
        "SourceRef": {
          "Schema": "extension",
          "Entity": "Sales"  // ← Existing entity hosting extension measure
        }
      },
      "Property": "Highlight Transparency"
    }
  }
}
```

### Pattern 4: Threshold-Based Icons (Unicode)

**Extension measure:**
```json
{
  "name": "Trend Icon",
  "dataType": "Text",
  "expression": "\n    VAR Change = [Current] - [Previous]\n    RETURN\n        SWITCH(\n            TRUE(),\n            Change > 0, \"⬆\",\n            Change < 0, \"⬇\",\n            \"➡\"\n        )\n    "
}
```

**Use in title or data label** to show dynamic icons based on data.

### Pattern 5: Combine Formatting and Theme

**Model measure (uses THEME function):**
```dax
Theme Primary = "#" & SELECTEDVALUE('Theme Colors'[Primary Hex])
```

**Extension measure (references model measure):**
```json
{
  "name": "Brand Color",
  "dataType": "Text",
  "expression": "\n    IF(\n        [Is Flagship Product] = TRUE(),\n        [Theme Primary],  // Model measure\n        \"#CCCCCC\"         // Gray for others\n    )\n    ",
  "references": {
    "measures": [
      {
        "entity": "Products",
        "name": "Is Flagship Product"
      },
      {
        "entity": "Theme",
        "name": "Theme Primary"
      }
    ]
  }
}
```

**Benefit:** Formatting logic in extension measure, color values in model/theme.

## Advanced Features

### Format Strings

Control display format of the measure result:

```json
{
  "name": "Formatted Sales",
  "dataType": "Double",
  "expression": "[Total Sales]",
  "formatString": "\"$\"#,0.00"
}
```

**VBA format string patterns:**
- `"#,0"` - Thousands separator, no decimals
- `"#,0.00"` - Two decimals
- `"0.0%"` - Percentage
- `"\"$\"#,0.00"` - Currency with literal $

### Hidden Measures

Helper measures not meant for field list:

```json
{
  "name": "_Helper Variance",
  "dataType": "Double",
  "expression": "[Revenue] - [Revenue PY]",
  "hidden": true
}
```

### Annotations

Custom metadata for tools/documentation:

```json
{
  "name": "KPI Color",
  "dataType": "Text",
  "expression": "...",
  "annotations": [
    {
      "name": "Purpose",
      "value": "Conditional formatting for KPI status indicators"
    },
    {
      "name": "Author",
      "value": "Analytics Team"
    },
    {
      "name": "LastModified",
      "value": "2025-01-15"
    }
  ]
}
```

### Display Folders

Organize in field list:

```json
{
  "name": "Revenue Color",
  "displayFolder": "Formatting\\Revenue",
  "dataType": "Text",
  "expression": "..."
}
```

Creates hierarchy: `Formatting > Revenue > Revenue Color`

### Data Categories

Extended semantic information:

```json
{
  "name": "Product Image URL",
  "dataType": "Text",
  "dataCategory": "ImageURL",
  "expression": "\"https://cdn.example.com/\" & [Product Code] & \".jpg\""
}
```

**Common categories:** `WebURL`, `ImageURL`, `Barcode`

### Measure Templates

Track if created from DAX template:

```json
{
  "name": "Time Intelligence YTD",
  "dataType": "Double",
  "expression": "TOTALYTD([Sales], 'Date'[Date])",
  "measureTemplate": {
    "daxTemplateName": "YTD",
    "version": 1
  }
}
```

**Note:** This is informational metadata, not commonly used.

## Best Practices

### 1. Centralize Formatting Logic

**Don't:**
- Repeat color logic in each visual's conditional formatting
- Hardcode colors in multiple measures

**Do:**
- Create one formatting measure
- Reference it in all visuals that need the logic
- Update once, applies everywhere

### 2. Return Empty String for Defaults

```dax
IF(
    ISBLANK([Value]),
    "",           // Let visual use default color
    "#FF0000"     // Use red when value exists
)
```

Allows graceful fallback to visual defaults.

### 3. Document Complex Logic

Use `description` field:

```json
{
  "name": "Complex Indicator",
  "description": "Returns green if revenue >= target AND growth >= 5%, orange if revenue >= target but growth < 5%, red otherwise",
  "dataType": "Text",
  "expression": "..."
}
```

### 4. Use VAR for Readability

```dax
VAR Actual = [Revenue]
VAR Target = [Revenue Target]
VAR Variance = Actual - Target
VAR VariancePct = DIVIDE(Variance, Target)
RETURN
    SWITCH(
        TRUE(),
        VariancePct >= 0.10, "#4CAF50",
        VariancePct >= 0, "#118DFF",
        "#D64550"
    )
```

Makes logic clear and maintainable.

### 5. Handle Edge Cases

```dax
// Check for blanks, zeros, errors
IF(
    OR(ISBLANK([Value]), [Value] = 0),
    "",
    IF([Value] > 0, "#4CAF50", "#D64550")
)
```

### 6. Prefer Measure-Only Entities

If your model has measure-only entities (common naming patterns):
- `_Measures` - Generic measure container
- `_Formatting` - Formatting logic (if exists)
- `_Helpers` - Helper/utility measures
- `_Chart Config` - Chart configuration

These are good hosts for extension measures since they already contain only measures, not data.

### 7. Track Dependencies

Always populate `references` when using model measures:

```json
"references": {
  "measures": [
    {"entity": "Sales", "name": "Revenue"},
    {"entity": "Sales", "name": "Target"}
  ]
}
```

**Benefits:**
- Power BI tracks dependencies
- Easier debugging
- Better IntelliSense in some tools

### 8. Test Incrementally

1. Create measure in reportExtensions.json
2. Validate JSON syntax
3. Add to visual
4. Check for DAX errors in visual
5. Verify calculation results

## Troubleshooting

### Measure Not Found

**Symptom:** Visual shows error "Can't find measure"

**Causes:**
1. Missing `"Schema": "extension"` in SourceRef
2. Misspelled entity or measure name
3. reportExtensions.json has syntax errors

**Fix:**
```json
// Verify exact names match
"SourceRef": {
  "Schema": "extension",        // ← Must be present
  "Entity": "Sales"             // ← Check spelling (must be existing entity)
},
"Property": "Status Color"      // ← Check spelling
```

Validate reportExtensions.json:
```bash
jq empty reportExtensions.json
```

Check entity exists in model:
```bash
# List entities in reportExtensions.json
jq '.entities[].name' reportExtensions.json

# Compare with model tables: pbir model "Report.Report" -d
```

### Empty reportExtensions.json Error

**Symptom:** Power BI Desktop fails to open .pbip file with error:

```
Cannot perform interop call to: ModelAuthoringHostService.UpdateModelExtensions(args:1) -
wrong arg[0]=extensions value [ { "name": "extension" } ]
```

**Cause:** `reportExtensions.json` exists but has no extension measures defined (empty `entities` array or only root-level properties).

**Fix:** Delete `reportExtensions.json` entirely when you have no extension measures:

```bash
# Delete the file
rm definition/reportExtensions.json
```

The file is **optional** - only include it when you have at least one extension measure. Power BI Desktop's deserializer fails when the file exists but contains no measures.

**Common scenario:** This happens after moving all extension measures to the semantic model. Remember to:
1. Delete `reportExtensions.json`
2. Update visual references to remove `"Schema": "extension"` from SourceRefs

### Measure Not Evaluating

**Symptom:** Measure found but returns a blank or no formatting (if used in conditional formatting)

**Causes:**
1. DAX error in expression (will result in a "grey box of death error")
2. Wrong data type (e.g., Text for numeric property)
3. Invalid return value (e.g., color name instead of hex)
4. Wrong selector (metadata vs dataViewWildcard)

**Fix:**

Check data type matches property:
```json
// For colors:
"dataType": "Text"  // NOT Int64 or Double

// For transparency:
"dataType": "Int64"  // NOT Text
```

Check return format:
```dax
// For colors - use theme colors or hexes:
"bad"      // ✓ Preferred
"#FF0000"  // ✓ Correct but prefer theme colors instead
"red"      // ✗ Wrong - will render, but not preferred
"rgb(255,0,0)"  // ✗ Wrong
```

Check selector for per-point evaluation:
```json
"selector": {
  "data": [{
    "dataViewWildcard": {"matchingOption": 1}  // ← For per-category
  }]
}
```

### JSON Syntax Errors

**Symptom:** Report won't load, deployment fails

**Causes:**
1. Missing quotes
2. Missing commas
3. Extra commas
4. Unclosed braces
5. Invalid escape sequences in DAX

**Fix:**

Validate JSON:
```bash
jq empty reportExtensions.json
```

Common escape issues:
```json
// DAX with quotes - escape properly:
"expression": "\"String literal\""

// DAX with newlines - use \n:
"expression": "\n    IF(\n        [Value] > 0,\n        \"#4CAF50\",\n        \"#D64550\"\n    )\n    "

// DAX with backslash - double escape if needed:
"expression": "\"Path: C:\\\\Folder\\\\ File\""
```

### Unrecognized References

**Symptom:** `"unrecognizedReferences": true` in references object

**Meaning:** Power BI couldn't find one or more referenced measures

**Causes:**
1. Referenced measure doesn't exist
2. Measure renamed or removed, but the dependency downstream in the visual was not updated

**Fix:**

Verify measure exists:
```json
"references": {
  "unrecognizedReferences": true,  // ← Warning flag
  "measures": [
    {
      "entity": "Sales",
      "name": "Total Revenue"  // ← Check this exists
    }
  ]
}
```


## Examples

For a real-world example with extension measures, conditional formatting colors, and inter-extension references, see `examples/K201-MonthSlicer.Report/definition/reportExtensions.json` and the visuals that reference them in `examples/K201-MonthSlicer.Report/definition/pages/`.

## Related Documentation

- **schema-patterns/conditional-formatting.md** - Selector patterns for per-segment formatting
- **measures-vs-literals.md** - When to use measures vs static values
- **schema-patterns/expressions.md** - Expression type syntax
- **schemas/reportExtension/1.0.0/schema.json** - Complete schema definition

## External Resources

- **SQLBI: Re-using visual formatting in and across Power BI reports**
  https://www.sqlbi.com/articles/re-using-visual-formatting-in-and-across-power-bi-reports/

- **Microsoft: Power BI Desktop project report folder**
  https://learn.microsoft.com/en-us/power-bi/developer/projects/projects-report

- **Schema Repository**
  https://github.com/microsoft/json-schemas