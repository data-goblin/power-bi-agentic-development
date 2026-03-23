# Visual Container Formatting

## Critical Concept: visualContainerObjects vs objects

Power BI visual definitions have TWO distinct property sections:

1. **`objects`** - Visual-specific properties (data labels, axes, legend, etc.)
2. **`visualContainerObjects`** - Container formatting (title, subtitle, background, border, dropShadow)

## Theme Inheritance and Wildcards

**CRITICAL:** Themes apply default container formatting via wildcard selectors `["*"]["*"]` that affect ALL visuals.

### Example from OrderLinesReport Theme

```json
{
  "visualStyles": {
    "*": {
      "*": {
        "title": [{ "show": true, "fontSize": 12, ... }],
        "subTitle": [{ "show": true, "fontSize": 10.5, ... }],
        "background": [{ "show": true, "color": {...}, ... }],
        "border": [{ "show": true, "width": 1, ... }],
        "dropShadow": [{ "show": true, "shadowBlur": 5, ... }]
      }
    }
  }
}
```

**Result:** Every visual inherits these settings automatically. You won't see them in the visual JSON unless explicitly overridden.

## Common Problem: Textboxes with Theme-Inherited Titles

When creating textboxes, the inherited `title.show: true` and `subTitle.show: true` create spacing for empty title/subtitle elements, making the textbox content illegible or poorly positioned.

### ✅ Proper Fix: Update the Theme

**This is a theme flaw, not a visual problem.** The correct solution is to add a textbox-specific exception to the theme:

```json
{
  "visualStyles": {
    "*": {
      "*": {
        "title": [{ "show": true, ... }],
        "subTitle": [{ "show": true, ... }],
        "background": [{ "show": true, ... }],
        "border": [{ "show": true, ... }],
        "dropShadow": [{ "show": true, ... }]
      }
    },
    "textbox": {
      "*": {
        "title": [{ "show": false }],
        "subTitle": [{ "show": false }],
        "background": [{ "show": false }],
        "border": [{ "show": false }],
        "dropShadow": [{ "show": false }]
      }
    }
  }
}
```

**When to fix in theme vs visual:**
- **Theme fix**: Affects ALL visuals of that type across the entire report. Use when the default is clearly wrong for a visual type.
- **Visual fix**: One-off exception for a specific visual instance. Use when you want different behavior than the theme default.

**For textboxes:** Always fix in the theme. Textboxes should never have titles/subtitles/borders by default.

### ❌ Incorrect Pattern (Theme-Inherited, Broken)

```json
{
  "visual": {
    "visualType": "textbox",
    "objects": {
      "general": [{
        "properties": {
          "paragraphs": {
            "expr": {
              "Literal": {
                "Value": "[{\"textRuns\":[{\"value\":\"Title\"}]}]"
              }
            }
          }
        }
      }],
      "background": [{ "properties": { "show": ... }}],  // WRONG LOCATION
      "border": [...]                                      // WRONG LOCATION
    }
  }
}
```

**Problems:**
1. `paragraphs` uses `expr.Literal.Value` with JSON string (old schema)
2. Container properties (`background`, `border`) in `objects` instead of `visualContainerObjects`
3. No explicit override of theme-inherited `title`, `subTitle`, `dropShadow`

### ✅ Correct Pattern (Explicitly Overridden)

```json
{
  "visual": {
    "visualType": "textbox",
    "objects": {
      "general": [{
        "properties": {
          "paragraphs": [
            {
              "textRuns": [
                {
                  "value": "Title",
                  "textStyle": {
                    "fontSize": "32pt"
                  }
                }
              ]
            }
          ]
        }
      }]
    },
    "visualContainerObjects": {
      "title": [{
        "properties": {
          "show": {
            "expr": { "Literal": { "Value": "false" }}
          }
        }
      }],
      "background": [{
        "properties": {
          "show": {
            "expr": { "Literal": { "Value": "false" }}
          }
        }
      }],
      "border": [{
        "properties": {
          "show": {
            "expr": { "Literal": { "Value": "false" }}
          }
        }
      }],
      "dropShadow": [{
        "properties": {
          "show": {
            "expr": { "Literal": { "Value": "false" }}
          }
        }
      }]
    }
  }
}
```

**Key Differences:**
1. `paragraphs` is direct array (no `expr` wrapper)
2. Container properties in `visualContainerObjects`, not `objects`
3. **Explicitly sets `show: false`** to override theme defaults

## General Rule for All Visuals

**When creating any visual programmatically:**

1. Check the theme wildcard settings (`visualStyles["*"]["*"]`)
2. Identify which container properties are enabled by default
3. **Explicitly override** any inherited settings you don't want
4. Always use `visualContainerObjects` for container formatting

## visualContainerObjects Properties

Common properties that belong in `visualContainerObjects`:

- `title` - Visual title
- `subTitle` - Visual subtitle
- `divider` - Line between title and visual
- `background` - Container background
- `border` - Container border
- `dropShadow` - Container drop shadow
- `padding` - Container padding
- `visualHeader` - Header with icons/actions (reading view)
- `visualTooltip` - Tooltip for entire visual

## objects Properties

Visual-specific formatting that belongs in `objects`:

- `general` - General visual settings
- `dataPoint` - Data point colors/formatting
- `categoryAxis`, `valueAxis` - Axis formatting
- `legend` - Legend formatting
- `dataLabels` - Data label formatting
- `plotArea` - Plot area formatting
- Type-specific properties (`lineStyles`, `columnStyles`, etc.)

## Schema Version Note

Schemas 2.1.0-2.2.0 use `objects` for both visual-specific and container formatting. Schema 2.4.0+ splits them into `objects` and `visualContainerObjects`. When editing older reports, container properties may legitimately be in `objects`.
