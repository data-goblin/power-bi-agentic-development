# Power BI Themes

## Overview

Themes in Power BI define default formatting that is automatically inherited by all visuals, pages, and reports. They are the foundation of report styling and should be reviewed first before making individual visual or page changes.

**Key Concept:** Themes specify formatting that becomes the "default" option for visuals. When you see formatting in the Power BI Service UI but don't see it in the visual JSON, it's being inherited from the theme.

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

### Method 1: From Downloaded Report (Recommended)

When you download a report with `download-report.py`, the theme is included automatically:

```bash
python3 scripts/download-report.py "Workspace Name" "Report Name" ./tmp --format pbip
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

When working with downloaded reports, edit the theme JSON directly:

```bash
# Edit custom theme
vim tmp/ReportName/ReportName.Report/StaticResources/RegisteredResources/CustomTheme.json

# Changes deploy automatically if auto-deploy is enabled
# Check deployment-status.md for results
```

## When to Modify Theme vs Visual vs Page

**CRITICAL:** Always review the theme FIRST before making formatting changes.

### Modify the Theme When:

✅ The formatting issue affects ALL visuals of a type (e.g., all textboxes)
✅ You want to change the default for future visuals
✅ The current default is clearly wrong for a visual type
✅ You're establishing design system standards

**Example:** Textboxes shouldn't have titles/borders by default

### Modify the Visual When:

✅ One specific visual needs different formatting than others of its type
✅ The theme default is correct for most cases, but this is an exception
✅ The formatting is content-specific (e.g., highlighting a specific metric)

**Example:** One textbox needs a red background to highlight an error

### Modify the Page When:

✅ All visuals on the page need the same override
✅ Page-level settings like alignment or spacing
✅ Page background or watermark

**Example:** Dashboard page has different background than detail pages

## Efficient Theme Inspection with get-theme.py

**CRITICAL:** Theme files can be 75KB+ with 2000+ lines. The `get-theme.py` script provides efficient access to theme formatting without loading the entire file.

### Usage

```bash
# Get effective formatting for a visual type (wildcards + overrides merged)
python3 scripts/get-theme.py tmp/ReportName kpi
python3 scripts/get-theme.py tmp/ReportName lineChart

# Get global wildcard formatting
python3 scripts/get-theme.py tmp/ReportName wildcards

# Get theme colors (first 10 only)
python3 scripts/get-theme.py tmp/ReportName colors
```

### How It Works

**Lazy cache generation:**
- First run: Auto-generates `.theme-cache/` directory (50+ visual types)
- Subsequent runs: Instant retrieval from cache
- Auto-regenerates if theme file changes (hash-based invalidation)

**Effective formatting:**
- Merges wildcards + visual-specific overrides
- Shows final formatting that visual will inherit
- Handles Power BI's single-element array pattern

**Token savings:**
```
Full theme file:        75,156 bytes
Cached KPI formatting:   6,756 bytes  (91% smaller)
Cached colors:             253 bytes  (99.7% smaller)
Cached wildcards:        5,183 bytes  (93% smaller)
```

### Cache Structure

```
tmp/ReportName/.theme-cache/
├── kpi.json          # Effective KPI formatting (wildcards + overrides merged)
├── lineChart.json    # Effective lineChart formatting
├── tableEx.json      # etc...
├── colors.json       # First 10 data colors
├── wildcards.json    # Global *.* formatting
└── metadata.json     # Hash for invalidation
```

### Common Queries

```bash
# Check what formatting applies to KPI indicator
python3 scripts/get-theme.py tmp/Test kpi | jq '.indicator'

# Check if data labels are enabled for line charts
python3 scripts/get-theme.py tmp/Test lineChart | jq '.labels.show'

# Get title formatting that all visuals inherit
python3 scripts/get-theme.py tmp/Test wildcards | jq '.title'

# Get theme color palette
python3 scripts/get-theme.py tmp/Test colors
```

### When to Use This

**Use get-theme.py when:**
- Checking what formatting a visual type inherits
- Debugging why a visual has unexpected formatting
- Understanding effective formatting (wildcards + overrides merged)
- Need specific properties without loading entire theme

**Use direct theme.json access when:**
- Making bulk edits across multiple visual types
- Need all 480 data colors (not just first 10)
- Analyzing theme structure comprehensively

## Workflow for Theme Review

When starting work on a report:

1. **Check the theme reference:**
   ```bash
   cat tmp/ReportName/ReportName.Report/definition/report.json | jq '.themeCollection'
   ```

2. **Review wildcard settings (use get-theme.py for efficiency):**
   ```bash
   # Efficient: Only loads wildcards (~5KB)
   python3 scripts/get-theme.py tmp/ReportName wildcards

   # Alternative: Direct access (loads full 75KB theme)
   cat tmp/ReportName/ReportName.Report/StaticResources/RegisteredResources/<CustomTheme>.json | \
     jq '.visualStyles["*"]["*"]'
   ```

3. **Check visual-specific formatting:**
   ```bash
   # See what KPIs actually inherit (wildcards + overrides merged)
   python3 scripts/get-theme.py tmp/ReportName kpi

   # Check specific properties
   python3 scripts/get-theme.py tmp/ReportName kpi | jq '.indicator'
   python3 scripts/get-theme.py tmp/ReportName lineChart | jq '.labels.show'
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
# 1. Download report
python3 scripts/download-report.py "Sales" "Q4 Report" ./tmp --format pbip

# 2. Review theme
cat ./tmp/Q4Report/Q4Report.Report/definition/report.json | jq '.themeCollection'

# 3. Check wildcard defaults
THEME_FILE=./tmp/Q4Report/Q4Report.Report/StaticResources/RegisteredResources/CustomTheme.json
cat $THEME_FILE | jq '.visualStyles["*"]["*"]'

# 4. Identify issue: titles enabled for textboxes

# 5. Backup theme
cp $THEME_FILE ${THEME_FILE}.bak

# 6. Add textbox exception
cat $THEME_FILE | jq '.visualStyles.textbox["*"] += {
  "title": [{"show": false}],
  "background": [{"show": false}],
  "border": [{"show": false}]
}' > ${THEME_FILE}.tmp && mv ${THEME_FILE}.tmp $THEME_FILE

# 7. Verify change
cat $THEME_FILE | jq '.visualStyles.textbox'

# 8. Changes deploy automatically (if auto-deploy enabled)
cat ./tmp/Q4Report/deployment-status.md

# 9. Test in browser
# All textboxes now inherit correct defaults
```

## Filter Pane and Filter Card Formatting in Themes

**CRITICAL:** Filter pane styling should be done at the **theme level**, not page level. While page-level formatting works, theme-level ensures consistency across all pages.

### Filter Pane (outspacePane)

Location in theme: `visualStyles.page."*".outspacePane`

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

Location in theme: `visualStyles.page."*".filterCard`

Target specific filter types using `$id`:

| Property | Type | Format | Description | Example Value |
|----------|------|--------|-------------|---------------|
| `$id` | string | "Available", "Applied", or filter GUID | Which filters to style | `"Applied"` |
| `backgroundColor` | color | `{"solid": {"color": ...}}` | Card background color | ThemeDataColor with ColorId and Percent |
| `transparency` | integer | 0-100 | Card transparency | `47` |
| `border` | boolean | true/false | Show card border | `false` |
| `borderColor` | color | `{"solid": {"color": ...}}` | Border color | `{"solid": {"color": "#CCCCCC"}}` |
| `fontFamily` | string | Font with fallbacks | Card text font | Same as outspacePane |
| `foregroundColor` | color | `{"solid": {"color": ...}}` | Text and icon color | `{"solid": {"color": "'#e03131'"}}` (note inner quotes!) |
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
    "page": {
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

2. **Navigate to page wildcards**: `visualStyles.page."*"`

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
3. **Don't forget inner quotes** for literal color hex codes: `"'#e03131'"`
4. **Don't use `"id"` in theme** - it's `"$id"` in theme, `"selector": {"id": ...}` in page.json
5. **Don't exceed ColorId range** - check your theme's dataColors array length

## Clearing Visual-Level Overrides for Theme Enforcement

When applying a new theme, existing visual-level overrides in `objects` and `visualContainerObjects` take precedence over theme defaults. To enforce the theme fully, strip these overrides. This preserves field bindings, position/size, and visual type -- only bespoke formatting is removed.

Use `pbir visuals clear-formatting` to strip these overrides with glob support:

```bash
# Clear all formatting from all visuals, preserving CF
pbir visuals clear-formatting "Report.Report/**/*.Visual" --keep-cf -f

# Clear only container formatting (title, border, background, shadow, padding)
pbir visuals clear-formatting "Report.Report/**/*.Visual" --only-containers -f

# Preview what would be cleared
pbir visuals clear-formatting "Report.Report/**/*.Visual" --dry-run
```

The key JSON paths cleared:
- `visual.objects` -- chart-specific overrides (legend, axis, labels, dataPoint, etc.)
- `visual.visualContainerObjects` -- container overrides (title, border, background, shadow, padding)

**Warning**: Without `--keep-cf`, clearing `visual.objects` also removes conditional formatting expressions. Always use `--keep-cf` if the report has CF. See **`pbir-cli/references/apply-theme.md` > Clearing Visual-Level Formatting** for full workflow.

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
