# Page Definition (page.json)

## Schema

`https://developer.microsoft.com/json-schemas/fabric/item/report/definition/page/2.0.0/schema.json`

## Page Folder Naming

- Power BI Desktop may generate page folder names with spaces (e.g., `Before Report.Page`). For human-authored names, avoid spaces — use underscores or hyphens instead for predictable behaviour in tooling.

## Top-Level Properties

- `name`: Page GUID identifier (string)
- `displayName`: User-visible page name (string)
- `displayOption`: **MUST be string** - `"FitToPage"`, `"FitToWidth"`, or `"ActualSize"` (NOT integer)
- `height`, `width`: Page dimensions (numbers) - **Preferred: width=1920, height=1080**
- `verticalAlignment`: Vertical alignment of page canvas - `"Top"`, `"Middle"`, or `"Bottom"` (string)
- `horizontalAlignment`: Horizontal alignment of page canvas - `"Left"`, `"Center"`, or `"Right"` (string)
- `type`: `"Default"` or `"Tooltip"` (see Tooltip Pages below)
- `visibility`: `"AlwaysVisible"` or `"HiddenInViewMode"` (hidden pages don't show in page tabs)
- `filterConfig`: Page-level filters (see [filter-pane.md](./filter-pane.md))
- `pageBinding`: Parameter bindings for Q&A
- `visualInteractions`: Cross-visual interaction overrides (see below)
- `objects`: Formatting objects for page-level formatting

### visualInteractions

Override default cross-filtering between visuals on this page:

```json
"visualInteractions": [
  {"source": "slicer_visual_name", "target": "chart_visual_name", "type": "NoFilter"}
]
```

Types: `"NoFilter"` (disable cross-filter), `"Filter"`, `"Highlight"`.

### Tooltip Pages

Tooltip pages are small hidden pages that display as rich tooltips when users hover over visuals. They need three things: the page setup, the visual opt-in, and a smaller canvas size.

**Page setup** (page.json):

```json
{
  "$schema": "...page/2.0.0/schema.json",
  "name": "tooltip_page_id",
  "displayName": "Revenue Tooltip",
  "displayOption": "ActualSize",
  "width": 320,
  "height": 240,
  "type": "Tooltip",
  "visibility": "HiddenInViewMode"
}
```

Key properties:
- `type: "Tooltip"` -- marks this as a tooltip page
- `visibility: "HiddenInViewMode"` -- hides from page tabs (users shouldn't navigate to it)
- `displayOption: "ActualSize"` -- tooltip pages don't scale
- Common sizes: 320x240 (default), 400x120 (wide/compact), or custom

The tooltip page contains regular visuals (cards, textboxes, charts) that show contextual data. Put visuals on it like any other page.

**Visual opt-in** (visual.json `visualContainerObjects`):

To make a visual show this tooltip page on hover, set `visualTooltip` in the visual's `visualContainerObjects`:

```json
"visualContainerObjects": {
  "visualTooltip": [{
    "properties": {
      "show": {"expr": {"Literal": {"Value": "true"}}},
      "type": {"expr": {"Literal": {"Value": "'ReportPage'"}}},
      "section": {"expr": {"Literal": {"Value": "'tooltip_page_id'"}}}
    }
  }]
}
```

- `type: "'ReportPage'"` -- use a report page as tooltip (vs `"'Default'"` for auto/default tooltip)
- `section` -- the `name` property from the tooltip page's page.json (NOT the displayName)

To disable tooltips on a visual: `"show": {"expr": {"Literal": {"Value": "false"}}}`.

**Tooltip formatting** -- when using the default tooltip (not a report page), you can style it directly. These are honestly the kind of things that are better done in the theme, but if you must do it per-visual:

```json
"visualTooltip": [{
  "properties": {
    "show": {"expr": {"Literal": {"Value": "true"}}},
    "type": {"expr": {"Literal": {"Value": "'Default'"}}},
    "titleFontColor": {"solid": {"color": {"expr": {"Literal": {"Value": "'#333333'"}}}}},
    "valueFontColor": {"solid": {"color": {"expr": {"Literal": {"Value": "'#666666'"}}}}},
    "fontSize": {"expr": {"Literal": {"Value": "12D"}}},
    "fontFamily": {"expr": {"Literal": {"Value": "'Segoe UI'"}}},
    "bold": {"expr": {"Literal": {"Value": "false"}}},
    "background": {"solid": {"color": {"expr": {"Literal": {"Value": "'#FFFFFF'"}}}}},
    "transparency": {"expr": {"Literal": {"Value": "0D"}}}
  }
}]
```

All `visualTooltip` formatting properties: `show`, `type`, `section`, `titleFontColor`, `valueFontColor`, `fontSize`, `fontFamily`, `bold`, `italic`, `underline`, `background`, `transparency`, `actionFontColor`, `themedTitleFontColor`, `themedBackground`, `themedValueFontColor`.

There's also `visualHeaderTooltip` which styles the tooltip that appears when hovering over the visual header icons -- same idea, slightly different property set: `type`, `section`, `text`, `titleFontColor`, `fontSize`, `fontFamily`, `bold`, `italic`, `underline`, `background`, `transparency`.

To disable tooltips on a visual: `"show": {"expr": {"Literal": {"Value": "false"}}}`.

Additional `visualTooltip` styling properties: `titleFontColor`, `valueFontColor`, `fontSize`, `fontFamily`, `background`, `transparency`, `bold`, `italic`, `underline`.

### Drillthrough Pages

Drillthrough pages let users right-click a data point and navigate to a detail page filtered to that value. The drillthrough target is configured via page-level filters with specific drillthrough properties.

A drillthrough page is a regular page (`type: "Default"`) with a drillthrough filter in its `filterConfig`:

```json
{
  "name": "drillthrough_page_id",
  "displayName": "Customer Details",
  "displayOption": "FitToPage",
  "width": 1920,
  "height": 1080,
  "filterConfig": {
    "filters": [{
      "name": "drillthrough_filter_id",
      "field": {
        "Column": {
          "Expression": {"SourceRef": {"Entity": "Customers"}},
          "Property": "Customer Name"
        }
      },
      "type": "Categorical",
      "howCreated": "User"
    }]
  }
}
```

When a user right-clicks a data point that contains "Customer Name", Power BI offers to navigate to this page with the filter applied. The page's visuals then show data for that specific customer.

### Page Canvas Alignment

**verticalAlignment** and **horizontalAlignment** control how the page canvas is positioned within the display area when the canvas size differs from the viewport size (e.g., when using `displayOption: "ActualSize"`).

**verticalAlignment** values:
- `"Top"` - Align canvas to top of display area
- `"Middle"` - Center canvas vertically (default)
- `"Bottom"` - Align canvas to bottom of display area

**horizontalAlignment** values:
- `"Left"` - Align canvas to left of display area
- `"Center"` - Center canvas horizontally (default)
- `"Right"` - Align canvas to right of display area

**Example:**
```json
{
  "name": "page-guid",
  "displayName": "Dashboard",
  "displayOption": "ActualSize",
  "width": 1920,
  "height": 1080,
  "verticalAlignment": "Middle",
  "horizontalAlignment": "Center"
}
```

**Note:** Alignment is most relevant when:
- Using `displayOption: "ActualSize"` (canvas shown at exact size)
- Viewport is larger than canvas size
- Want to control canvas positioning within display area

## Page Formatting Objects

Available in `objects` property:

### background
**Canvas background** - The page/canvas background where visuals sit.

**IMPORTANT:** This is the canvas itself, NOT the wallpaper behind it.
- For wallpaper (area behind/around canvas), use `outspace` (see [wallpaper.md](./wallpaper.md))
- For image visuals placed ON the canvas, see [visual-types/image.md](./visual-types/image.md)

**Visual Hierarchy (bottom to top):**
1. **outspace** (wallpaper) - Behind everything
2. **background** (canvas) - Where visuals sit
3. **visuals** - On top of canvas

**Properties:**
- `color` - Canvas background color (solid.color.expr)
- `transparency` - Canvas transparency 0-100 (0D = opaque, 100D = transparent)
- `image` - Canvas background image (image.name, image.url, image.scaling)

**Setting Background Images:** See [images.md](./images.md) for how to register and reference images.

**Example:**
```json
{
  "background": [
    {
      "properties": {
        "color": {
          "solid": {
            "color": {
              "expr": {
                "Literal": {
                  "Value": "'#FFFFFF'"
                }
              }
            }
          }
        },
        "transparency": {
          "expr": {
            "Literal": {
              "Value": "0D"
            }
          }
        }
      }
    }
  ]
}
```

**Common Values:**
- Opaque white canvas: `color: '#FFFFFF'`, `transparency: 0D`
- Transparent canvas (shows wallpaper): `transparency: 100D`
- Semi-transparent canvas: `transparency: 50D`

### displayArea
Format the display area

### filterCard
Individual filter cards within the filter pane. See [filter-pane.md](./filter-pane.md) for complete documentation.

### outspace
**Wallpaper** - Area behind/around the report canvas. See [wallpaper.md](./wallpaper.md) for complete documentation on setting wallpaper color, images, and transparency.

### outspacePane
Filter pane visibility and expanded state. **Note:** In the K201 example, `outspacePane` appears only in `report.json` objects (report-level), not in `page.json`. The filter pane is a report-level UI element — set `outspacePane` in `definition/report.json`, not here. See [filter-pane.md](./filter-pane.md) for complete documentation.

### pageInformation
Page information formatting

### pageRefresh
Page refresh settings

### pageSize
Page size formatting

### personalizeVisual
Personalization settings

## Common Patterns

### Set Canvas Background Color (Opaque White)
```json
"objects": {
  "background": [
    {
      "properties": {
        "color": {
          "solid": {
            "color": {
              "expr": {
                "Literal": {
                  "Value": "'#FFFFFF'"
                }
              }
            }
          }
        },
        "transparency": {
          "expr": {
            "Literal": {
              "Value": "0D"
            }
          }
        }
      }
    }
  ]
}
```

### Set Canvas Background Color (Transparent - Shows Wallpaper)
```json
"objects": {
  "background": [
    {
      "properties": {
        "color": {
          "solid": {
            "color": {
              "expr": {
                "Literal": {
                  "Value": "'#FFFFFF'"
                }
              }
            }
          }
        },
        "transparency": {
          "expr": {
            "Literal": {
              "Value": "100D"
            }
          }
        }
      }
    }
  ]
}
```

### Set Canvas or Wallpaper Images

**Using the script (recommended):**

See [images.md](./images.md) for image registration and referencing patterns.

**Key Differences:**
- **Canvas (background)**: Image on the page where visuals sit (99% use case)
- **Wallpaper (outspace)**: Image behind/around the canvas area
- **Theme**: Image applies to all pages (uses data URI in theme JSON)

## Creating a New Page

**Minimal page.json structure:**

```json
{
  "$schema": "https://developer.microsoft.com/json-schemas/fabric/item/report/definition/page/2.0.0/schema.json",
  "name": "unique-guid-here",
  "displayName": "Page Name",
  "displayOption": "FitToPage",
  "width": 1920,
  "height": 1080
}
```

**CRITICAL:**
- `displayOption` MUST be a STRING (`"FitToPage"`, `"FitToWidth"`, `"ActualSize"`), NOT an integer
- Preferred page size: **1920 x 1080** (width x height)
- Always check existing page.json files for correct schema format before creating new pages

### Common Page Sizes

| Type | Width | Height |
|------|-------|--------|
| Default | 1280 | 720 |
| Large (preferred) | 1920 | 1080 |
| Tooltip | 320 | 240 |
| Letter portrait | 816 | 1056 |

## Key Learnings

1. **Background property is `background`, NOT `canvasBackground`**
2. **Color uses same structure as visual colors**: `solid.color.expr.Literal.Value`
3. **Literal string values need single quotes inside double quotes**: `"'#FF0000'"`
4. **Numeric values need D suffix**: `"0D"`, `"50D"`
5. **Background is an array** (supports multiple entries like visual formatting)
6. **Properties are always required** even if empty
7. **displayOption is a STRING, not an integer** - Use `"FitToPage"` not `1`
