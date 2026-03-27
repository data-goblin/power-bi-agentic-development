# Power BI Themes

## Overview

Themes in Power BI define default formatting that is automatically inherited by all visuals, pages, and reports. They are the foundation of report styling and should be reviewed first before making individual visual or page changes.

**Key Concept:** Themes specify formatting that becomes the "default" option for visuals. When you see formatting in the Power BI Service UI but don't see it in the visual JSON, it's being inherited from the theme.

**Tools:** If the `pbir` CLI is available, prefer it for theme operations (`pbir theme colors`, `pbir theme set-formatting`, etc.). If not, use `jq` to read and modify the theme JSON files directly. All examples below show the `jq` approach, which always works.

## Theme Structure

A theme consists of:

1. **Base Theme** - Built-in Microsoft theme (e.g., "CY24SU10")
2. **Custom Theme** - Report-specific overrides and extensions

Both are referenced in `report.json`:

```json
{
  "themeCollection": {
    "baseTheme": {
      "name": "CY24SU10",
      "type": "SharedResources"
    },
    "customTheme": {
      "name": "ThemeName.json",
      "type": "RegisteredResources"
    }
  }
}
```

## Theme Files Location

**Base Theme:**
```
<Report>.Report/StaticResources/SharedResources/BaseThemes/<ThemeName>.json
```

**Custom Theme:**
```
<Report>.Report/StaticResources/RegisteredResources/<CustomThemeName>.json
```

## How Themes Work: Inheritance and Wildcards

Themes use a selector-based system where formatting cascades from general to specific:

### Wildcard Selectors

The wildcard selector `["*"]["*"]` applies to ALL visuals:

```json
{
  "visualStyles": {
    "*": {
      "*": {
        "title": [{"show": true, "fontSize": 12, ...}],
        "background": [{"show": true, ...}],
        "border": [{"show": true, ...}],
        "dropShadow": [{"show": true, ...}]
      }
    }
  }
}
```

**Result:** Every visual in the report inherits these settings automatically.

### Visual-Specific Overrides

Override wildcard defaults for specific visual types:

```json
{
  "visualStyles": {
    "*": {
      "*": {
        "title": [{"show": true}]
      }
    },
    "textbox": {
      "*": {
        "title": [{"show": false}],
        "background": [{"show": false}],
        "border": [{"show": false}],
        "dropShadow": [{"show": false}]
      }
    }
  }
}
```

**Result:** Textboxes inherit `show: false` for container properties, overriding the wildcard defaults.

### Inheritance Hierarchy

1. **Wildcard** (`["*"]["*"]`) - Applies to everything
2. **Visual Type** (e.g., `["textbox"]["*"]`) - Overrides wildcard for that type
3. **Visual Instance** (in `visualContainerObjects`) - Overrides theme for specific visual

## Common Theme Properties

### Container Formatting (visualContainerObjects)

These properties appear in `visualContainerObjects` in visual JSON:

```json
"title": [{"show": true/false, "fontSize": ..., "fontFamily": ..., "fontColor": ..., ...}]
"subTitle": [{"show": true/false, ...}]
"background": [{"show": true/false, "color": {...}, "transparency": ...}]
"border": [{"show": true/false, "width": ..., "color": {...}, "radius": ...}]
"dropShadow": [{"show": true/false, "angle": ..., "distance": ..., "blur": ..., ...}]
"padding": [{"top": ..., "bottom": ..., "left": ..., "right": ...}]
"divider": [{"show": true/false, "color": {...}, "style": ..., "width": ...}]
"visualHeader": [{"show": true/false}]
```

### Visual-Specific Formatting (objects)

These properties appear in `objects` in visual JSON:

```json
"categoryAxis": [{"show": ..., "fontSize": ..., ...}]
"valueAxis": [{"show": ..., ...}]
"dataLabels": [{"show": ..., ...}]
"legend": [{"show": ..., "position": ..., ...}]
"dataPoint": [{"fillColor": {...}, ...}]
```

## Getting a Theme from a Report

### Method 1: Download from Fabric (Recommended)

Download a report from Fabric with the theme included automatically:

```bash
# With pbir CLI
pbir download "Workspace.Workspace/Report.Report" -o ./tmp --format pbip

# With Fabric CLI
fab export "Workspace.Workspace/Report.Report" -o ./tmp
```

The theme files will be in:
- `tmp/ReportName/ReportName.Report/StaticResources/SharedResources/BaseThemes/`
- `tmp/ReportName/ReportName.Report/StaticResources/RegisteredResources/`

### Method 2: Export from Power BI Service

1. Open report in Power BI Service
2. Go to **View** → **Themes** → **Customize current theme**
3. Click **Export current theme**
4. Download JSON file

**Note:** This only exports the custom theme, not the base theme.

### Method 3: Extract from Power BI Desktop

1. Open `.pbix` file in Power BI Desktop
2. **View** → **Themes** → **Save current theme**
3. Save as JSON

## Applying a Theme

### Using Fabric CLI (Programmatic)

Deploy the report with updated theme files:

```bash
fab import "Workspace.Workspace/Report.Report" -i ./Report.Report -f
```

### Using Power BI Service (Manual)

1. Open report in Power BI Service
2. **View** → **Themes** → **Customize current theme**
3. Click **Import theme** or paste JSON
4. **Save** to apply

### Modifying Theme in Downloaded Report

When working with downloaded reports, modify the theme JSON directly:

```bash
# Find the custom theme file path from report.json
THEME_NAME=$(jq -r '.themeCollection.customTheme.name' Report.Report/definition/report.json)
THEME="Report.Report/StaticResources/RegisteredResources/$THEME_NAME"

# Edit with jq (always use temp file pattern to avoid truncation)
jq '.visualStyles["*"]["*"].title[0].fontSize = 14' "$THEME" > "$THEME.tmp" && mv "$THEME.tmp" "$THEME"

# Validate after every change
jq empty "$THEME"
```

## When to Modify Theme vs Visual vs Page

**CRITICAL:** Always review the theme FIRST before making formatting changes.

### Modify the Theme When:

- The formatting issue affects ALL visuals of a type (e.g., all textboxes)
- You want to change the default for future visuals
- The current default is clearly wrong for a visual type
- You're establishing design system standards

**Example:** Textboxes shouldn't have titles/borders by default

### Modify the Visual When:

- One specific visual needs different formatting than others of its type
- The theme default is correct for most cases, but this is an exception
- The formatting is content-specific (e.g., highlighting a specific metric)

**Example:** One textbox needs a red background to highlight an error

### Modify the Page When:

- All visuals on the page need the same override
- Page-level settings like alignment or spacing
- Page background or watermark

**Example:** Dashboard page has different background than detail pages

## Inspecting and Modifying Themes

**CRITICAL:** Theme files can be 75KB+ with 2000+ lines. Use targeted `jq` queries to read specific sections rather than loading the entire file.

First, locate the theme file:

```bash
# Get the custom theme file name from report.json
THEME_NAME=$(jq -r '.themeCollection.customTheme.name' Report.Report/definition/report.json)
THEME="Report.Report/StaticResources/RegisteredResources/$THEME_NAME"
```

### Reading Theme Properties

```bash
# Color palette (first 10 data colors)
jq '.dataColors[:10]' "$THEME"

# Wildcard formatting (inherited by ALL visuals)
jq '.visualStyles["*"]["*"]' "$THEME"

# Wildcard title formatting specifically
jq '.visualStyles["*"]["*"].title' "$THEME"

# List visual types that have overrides
jq '.visualStyles | keys | map(select(. != "*"))' "$THEME"

# Get overrides for a specific visual type
jq '.visualStyles.kpi' "$THEME"
jq '.visualStyles.lineChart["*"].labels' "$THEME"

# Text class definitions (title, label, callout, header, etc.)
jq '.textClasses' "$THEME"

# Filter pane styling
jq '.visualStyles["*"]["*"].outspacePane' "$THEME"
jq '.visualStyles["*"]["*"].filterCard' "$THEME"
```

### Modifying Theme Properties

Always use the temp file pattern to avoid truncating the file. Always validate immediately after.

```bash
# Set a wildcard property (applies to all visuals)
jq '.visualStyles["*"]["*"].title[0].fontSize = 14' "$THEME" > "$THEME.tmp" && mv "$THEME.tmp" "$THEME"

# Add a visual-type override (e.g. disable title for textboxes)
jq '.visualStyles.textbox["*"].title = [{"show": false}]' "$THEME" > "$THEME.tmp" && mv "$THEME.tmp" "$THEME"

# Replace a data color
jq '.dataColors[0] = "#FF0000"' "$THEME" > "$THEME.tmp" && mv "$THEME.tmp" "$THEME"

# Set all text classes to the same font
jq '.textClasses |= with_entries(.value.fontFace = "DIN")' "$THEME" > "$THEME.tmp" && mv "$THEME.tmp" "$THEME"

# Chain multiple changes in one jq expression
jq '
  .visualStyles.textbox["*"].title = [{"show": false}] |
  .visualStyles.textbox["*"].background = [{"show": false}] |
  .visualStyles.textbox["*"].border = [{"show": false}]
' "$THEME" > "$THEME.tmp" && mv "$THEME.tmp" "$THEME"

# ALWAYS validate after changes
jq empty "$THEME"
```

## Workflow for Theme Review

When starting work on a report:

1. **Locate the theme file:**
   ```bash
   THEME_NAME=$(jq -r '.themeCollection.customTheme.name' Report.Report/definition/report.json)
   THEME="Report.Report/StaticResources/RegisteredResources/$THEME_NAME"
   ```

2. **Review wildcard settings:**
   ```bash
   jq '.visualStyles["*"]["*"]' "$THEME"
   ```

3. **Check visual-specific formatting:**
   ```bash
   # See what overrides exist for KPIs
   jq '.visualStyles.kpi' "$THEME"

   # Check specific properties
   jq '.visualStyles.kpi["*"].indicator' "$THEME"
   jq '.visualStyles.lineChart["*"].labels' "$THEME"
   ```

4. **Identify potential issues:**
   - Are container properties (title, background, border, dropShadow) enabled for all visuals?
   - Do specific visual types need exceptions?
   - Are colors/fonts appropriate?

5. **Make theme fixes BEFORE visual edits:**
   - Add visual-specific overrides to theme
   - Test with a few visuals
   - Remove per-visual overrides once theme is correct

## Common Theme Issues and Fixes

### Issue: Textboxes Have Unwanted Titles/Borders

**Problem:** Wildcard enables titles/borders for all visuals, but textboxes shouldn't have them.

**Fix in Theme:**
```json
{
  "visualStyles": {
    "textbox": {
      "*": {
        "title": [{"show": false}],
        "subTitle": [{"show": false}],
        "background": [{"show": false}],
        "border": [{"show": false}],
        "dropShadow": [{"show": false}]
      }
    }
  }
}
```

### Issue: All Charts Have Wrong Default Colors

**Problem:** Theme dataPoint colors don't match brand guidelines.

**Fix in Theme:**
```json
{
  "visualStyles": {
    "*": {
      "*": {
        "dataPoint": [{
          "fillColor": {"solid": {"color": "#yourBrandColor"}}
        }]
      }
    }
  }
}
```

### Issue: Legend Position Wrong for All Visuals

**Problem:** Theme sets legend to right, but you want bottom.

**Fix in Theme:**
```json
{
  "visualStyles": {
    "*": {
      "*": {
        "legend": [{
          "position": "Bottom",
          "show": true
        }]
      }
    }
  }
}
```

## Theme Validation

After modifying a theme, validate it:

```bash
# Check JSON is valid
jq empty theme.json

# Verify specific visual type settings
jq '.visualStyles.textbox' theme.json

# Check wildcard settings
jq '.visualStyles["*"]["*"]' theme.json
```

## Example: Complete Theme Modification Workflow

```bash
# 1. Locate the theme file
THEME_NAME=$(jq -r '.themeCollection.customTheme.name' Q4Report.Report/definition/report.json)
THEME="Q4Report.Report/StaticResources/RegisteredResources/$THEME_NAME"

# 2. Check wildcard defaults
jq '.visualStyles["*"]["*"]' "$THEME"

# 3. Identify issue: titles enabled for textboxes

# 4. Fix: add textbox overrides
jq '
  .visualStyles.textbox["*"].title = [{"show": false}] |
  .visualStyles.textbox["*"].background = [{"show": false}] |
  .visualStyles.textbox["*"].border = [{"show": false}]
' "$THEME" > "$THEME.tmp" && mv "$THEME.tmp" "$THEME"

# 5. Validate
jq empty "$THEME"

# 6. Verify change
jq '.visualStyles.textbox' "$THEME"

# 7. Deploy (with Fabric CLI or pbir CLI)
fab import "Sales.Workspace/Q4Report.Report" -i ./Q4Report.Report -f
```

## Filter Pane and Filter Card Formatting in Themes

**CRITICAL:** Filter pane styling should be done at the **theme level**, not page level. While page-level formatting works, theme-level ensures consistency across all pages.

### Filter Pane (outspacePane)

Location in theme: `visualStyles["*"]["*"].outspacePane`

All properties available (verified against schema):

| Property | Type | Format | Description | Example Value |
|----------|------|--------|-------------|---------------|
| `backgroundColor` | color | `{"solid": {"color": ...}}` | Background color of filter pane | `{"solid": {"color": "#F0F8FF"}}` or ThemeDataColor |
| `transparency` | number | integer 0-100 | Background transparency (0=opaque, 100=transparent) | `37` |
| `border` | boolean | true/false | Show vertical separator line | `true` |
| `borderColor` | color | `{"solid": {"color": ...}}` | Color of separator line | `{"solid": {"color": "#4682B4"}}` |
| `fontFamily` | string | Font name with fallbacks | Font for titles and headers | `"'Segoe UI Semibold', wf_segoe-ui_semibold, helvetica, arial, sans-serif"` |
| `foregroundColor` | color | `{"solid": {"color": ...}}` | Text, icons, button color | ThemeDataColor with ColorId |
| `titleSize` | integer | Number (points) | Font size for pane title ("Filters") | `14` |
| `headerSize` | integer | Number (points) | Font size for section headers | `14` |
| `searchTextSize` | integer | Number (points) | Font size for search box | `8` |
| `inputBoxColor` | color | `{"solid": {"color": ...}}` | Background for input fields | ThemeDataColor |
| `checkboxAndApplyColor` | color | `{"solid": {"color": ...}}` | Color for Apply button and checkboxes | ThemeDataColor |
| `width` | integer | Number (pixels) | Width of filter pane | `307` |

**Format Notes:**
- **Integers**: Use bare integers (no suffix) in theme JSON: `14`, `307`, `37`
- **Booleans**: Use bare `true` or `false` (no quotes)
- **Colors**: Use `{"solid": {"color": "#RRGGBB"}}` OR `{"solid": {"color": {"ThemeDataColor": {"ColorId": N, "Percent": 0}}}}}`
- **Font family**: Triple-quote the primary font name with fallbacks: `"'Segoe UI Semibold', wf_segoe-ui_semibold, helvetica, arial, sans-serif"`

### Filter Cards (filterCard)

Location in theme: `visualStyles["*"]["*"].filterCard`

Target specific filter types using `$id`:

| Property | Type | Format | Description | Example Value |
|----------|------|--------|-------------|---------------|
| `$id` | string | "Available", "Applied", or filter GUID | Which filters to style | `"Applied"` |
| `backgroundColor` | color | `{"solid": {"color": ...}}` | Card background color | ThemeDataColor with ColorId and Percent |
| `transparency` | integer | 0-100 | Card transparency | `47` |
| `border` | boolean | true/false | Show card border | `false` |
| `borderColor` | color | `{"solid": {"color": ...}}` | Border color | `{"solid": {"color": "#CCCCCC"}}` |
| `fontFamily` | string | Font with fallbacks | Card text font | Same as outspacePane |
| `foregroundColor` | color | `{"solid": {"color": ...}}` | Text and icon color | `{"solid": {"color": "#e03131"}}` (bare hex string) |
| `textSize` | integer | Number (points) | Font size for card text | `11` |
| `inputBoxColor` | color | `{"solid": {"color": ...}}` | Input field background | ThemeDataColor |

**Filter Card Selectors:**
- `"$id": "Available"` - Style filters in "Filters on this page" section
- `"$id": "Applied"` - Style actively applied filters
- `"$id": "GUID"` - Style specific filter by its ID from filterConfig

### ThemeDataColor with Percent

ThemeDataColor allows referencing theme palette colors with lightness adjustments:

```json
{
  "solid": {
    "color": {
      "ThemeDataColor": {
        "ColorId": 5,      // Index into theme dataColors array (0-based)
        "Percent": 0.4     // Lightness: 0 = no change, 0.4 = 40% lighter, -0.5 = 50% darker
      }
    }
  }
}
```

**Percent values:**
- **0**: Use exact color from theme
- **Positive (0.1 to 1.0)**: Lighten (0.4 = 40% lighter)
- **Negative (-1.0 to -0.1)**: Darken (-0.5 = 50% darker)

### Complete Theme Example

```json
{
  "visualStyles": {
    "*": {
      "*": {
        "outspacePane": [
          {
            "foregroundColor": {
              "solid": {
                "color": {
                  "ThemeDataColor": {
                    "ColorId": 5,
                    "Percent": 0
                  }
                }
              }
            },
            "fontFamily": "'Segoe UI Semibold', wf_segoe-ui_semibold, helvetica, arial, sans-serif",
            "titleSize": 14,
            "headerSize": 14,
            "searchTextSize": 8,
            "inputBoxColor": {
              "solid": {
                "color": {
                  "ThemeDataColor": {
                    "ColorId": 0,
                    "Percent": 0
                  }
                }
              }
            },
            "border": false,
            "transparency": 37,
            "width": 307,
            "checkboxAndApplyColor": {
              "solid": {
                "color": {
                  "ThemeDataColor": {
                    "ColorId": 1,
                    "Percent": 0
                  }
                }
              }
            }
          }
        ],
        "filterCard": [
          {
            "$id": "Available",
            "fontFamily": "'Segoe UI Semibold', wf_segoe-ui_semibold, helvetica, arial, sans-serif",
            "textSize": 11,
            "foregroundColor": {
              "solid": {
                "color": "#e03131"
              }
            },
            "inputBoxColor": {
              "solid": {
                "color": {
                  "ThemeDataColor": {
                    "ColorId": 1,
                    "Percent": 0
                  }
                }
              }
            },
            "border": false,
            "backgroundColor": {
              "solid": {
                "color": {
                  "ThemeDataColor": {
                    "ColorId": 6,
                    "Percent": 0.4
                  }
                }
              }
            },
            "transparency": 47
          },
          {
            "$id": "Applied",
            "textSize": 11,
            "foregroundColor": {
              "solid": {
                "color": {
                  "ThemeDataColor": {
                    "ColorId": 5,
                    "Percent": -0.5
                  }
                }
              }
            },
            "inputBoxColor": {
              "solid": {
                "color": {
                  "ThemeDataColor": {
                    "ColorId": 3,
                    "Percent": 0.4
                  }
                }
              }
            },
            "border": false,
            "backgroundColor": {
              "solid": {
                "color": {
                  "ThemeDataColor": {
                    "ColorId": 3,
                    "Percent": 0.6
                  }
                }
              }
            },
            "transparency": 74
          }
        ]
      }
    }
  }
}
```

### Instructions for Implementing Filter Pane Formatting

1. **Locate theme file**: `<Report>.Report/StaticResources/RegisteredResources/<CustomTheme>.json`

2. **Navigate to visual wildcards**: `visualStyles["*"]["*"]`

3. **Add outspacePane array** (or modify existing):
   - Use bare integers for sizes/transparency/width: `14`, `307`, `37`
   - Use bare booleans: `true`, `false`
   - Use ThemeDataColor for colors to maintain theme consistency
   - Font family: triple-quote primary font with fallbacks

4. **Add filterCard array** with two entries:
   - First entry: `"$id": "Available"` for unapplied filters
   - Second entry: `"$id": "Applied"` for active filters
   - Style them differently for visual distinction

5. **Test deployment**:
   ```bash
   fab import "Workspace.Workspace/Report.Report" -i ./Report.Report -f
   ```

6. **Verify in browser** - Check filter pane appearance across all pages

### Common Mistakes to Avoid

1. **Don't use "D" or "L" suffixes** in theme JSON - use bare integers
2. **Don't use page-level formatting** - put it in theme for consistency
3. **Theme JSON color values use bare hex strings**: `"#e03131"` — no inner quotes. Inner single quotes (`"'#e03131'"`) are specific to `expr.Literal.Value` in visual.json, not theme JSON.
4. **Don't use `"id"` in theme** - it's `"$id"` in theme, `"selector": {"id": ...}` in page.json
5. **Don't exceed ColorId range** - check your theme's dataColors array length

## Clearing Visual-Level Overrides for Theme Enforcement

When applying a new theme, existing visual-level overrides in `objects` and `visualContainerObjects` take precedence over theme defaults. To enforce the theme fully, strip these overrides. This preserves field bindings, position/size, and visual type -- only bespoke formatting is removed.

The key JSON paths to clear in each `visual.json`:
- `visual.objects` -- chart-specific overrides (legend, axis, labels, dataPoint, etc.)
- `visual.visualContainerObjects` -- container overrides (title, border, background, shadow, padding)

With `pbir` CLI (if available):

```bash
pbir visuals clear-formatting "Report.Report/**/*.Visual" --keep-cf -f
```

With `jq` (manual approach per visual):

```bash
# Clear container overrides only (safe -- doesn't touch CF)
jq 'del(.visualContainerObjects)' visual.json > visual.json.tmp && mv visual.json.tmp visual.json

# Clear all bespoke formatting (WARNING: also removes conditional formatting)
jq 'del(.objects) | del(.visualContainerObjects)' visual.json > visual.json.tmp && mv visual.json.tmp visual.json

# Validate
jq empty visual.json
```

**Warning**: Clearing `objects` also removes conditional formatting expressions. If the report uses CF, only clear `visualContainerObjects`, or selectively delete specific keys from `objects` rather than removing it entirely.

## Best Practices

1. **Always review theme first** before making visual-level changes
2. **Fix theme issues at the theme level**, not by overriding every visual
3. **Clear visual overrides when switching themes** -- stale overrides prevent new theme from taking effect
4. **Use visual-specific sections** for visual types that need different defaults
5. **Keep the wildcard minimal** - only defaults that apply to everything
6. **Document theme decisions** - comment why specific overrides exist
7. **Test theme changes** with multiple visual types before mass deployment
8. **Version control themes** - commit theme changes separately from visual changes
9. **Use ThemeDataColor for filter pane** - maintains color palette consistency
10. **Style Available and Applied filters differently** - helps users distinguish filter states

## Related Documentation

- [visual-container-formatting.md](./visual-container-formatting.md) - Container vs visual properties
- [textbox.md](./textbox.md) - Textbox-specific theme issues
- [filter-pane.md](./filter-pane.md) - Filter pane formatting
