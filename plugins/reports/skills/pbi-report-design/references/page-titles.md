# Page Titles

Guidelines for implementing page titles in Power BI reports.

## Why Page Titles Matter

- Provide context for report consumers
- Improve navigation and orientation
- Support accessibility (screen readers)
- Professional appearance

## Implementation Options

### Option 1: Textbox Visual (Recommended)

```json
{
  "name": "title-guid",
  "position": {
    "x": 24,
    "y": 24,
    "z": 1000,
    "width": 500,
    "height": 48
  },
  "visual": {
    "visualType": "textbox",
    "objects": {
      "general": [{
        "properties": {
          "paragraphs": {
            "expr": {
              "Literal": {
                "Value": "[{\"textRuns\":[{\"value\":\"Sales Overview\",\"textStyle\":{\"fontSize\":\"24pt\",\"fontWeight\":\"bold\"}}]}]"
              }
            }
          }
        }
      }]
    },
    "visualContainerObjects": {
      "background": [{"properties": {"show": {"expr": {"Literal": {"Value": "false"}}}}}],
      "border": [{"properties": {"show": {"expr": {"Literal": {"Value": "false"}}}}}],
      "title": [{"properties": {"show": {"expr": {"Literal": {"Value": "false"}}}}}]
    }
  }
}
```

### Option 2: Shape with Text

Use a rectangle shape with text overlay for styled backgrounds.

### Option 3: Card Visual

For dynamic titles that include measure values.

## Title Specifications

### Standard Title

```
Position:  x: 24, y: 24
Size:      width: 400-600px, height: 48-64px
Font:      24pt, bold
Color:     Dark gray (#333) or theme foreground
Alignment: Left
```

### With Subtitle

```
Title:    x: 24, y: 24, height: 40px, font: 24pt bold
Subtitle: x: 24, y: 64, height: 32px, font: 14pt regular
```

### Full-Width Title Bar

```
Position:  x: 0, y: 0
Size:      width: 1920px, height: 72px
Background: Theme color or gradient
```

## Dynamic Titles

### Include Current Filter Context

```dax
Title Text =
"Sales by Region - " &
SELECTEDVALUE('Date'[Year], "All Years")
```

### Include Last Refresh

```dax
Title Text =
"Sales Dashboard - Updated: " &
FORMAT(MAX('Refresh Log'[Timestamp]), "MMM DD, YYYY")
```

## Textbox Paragraph Structure

Textbox content uses a specific JSON structure:

```json
{
  "paragraphs": {
    "expr": {
      "Literal": {
        "Value": "[{\"textRuns\":[{\"value\":\"Title Text\",\"textStyle\":{\"fontSize\":\"24pt\",\"fontWeight\":\"bold\",\"fontColor\":\"#333333\"}}]}]"
      }
    }
  }
}
```

### Multiple Runs (Mixed Formatting)

```json
[{
  "textRuns": [
    {"value": "Sales ", "textStyle": {"fontSize": "24pt"}},
    {"value": "Overview", "textStyle": {"fontSize": "24pt", "fontWeight": "bold"}}
  ]
}]
```

### Multiple Paragraphs

```json
[
  {"textRuns": [{"value": "Main Title", "textStyle": {"fontSize": "24pt"}}]},
  {"textRuns": [{"value": "Subtitle here", "textStyle": {"fontSize": "14pt"}}]}
]
```

## Creating Title Textboxes

```bash
pbir add title "Report.Report/Page.Page" "Overview" --width 500
```

Use `pbir add subtitle` when the page genuinely needs a second line. Never hand-author the
textbox JSON.

## Theme Considerations

### Disable Container Properties

For titles, typically disable:

- Background
- Border
- Title (visual title)
- Drop shadow

### In Theme Wildcards

```json
"visualStyles": {
  "textbox": {
    "*": {
      "title": [{"show": false}],
      "background": [{"show": false}],
      "border": [{"show": false}],
      "dropShadow": [{"show": false}]
    }
  }
}
```

## Accessible Titles

A screen reader speaks a visual's title and type before any alt text. This means an acronym or jargon title is unintelligible spoken aloud; the accessibility constraint is stronger than the visual-design constraint.

- Spell out the subject ("Current year sales vs prior year", not "CY Sales vs PY")
- Reserve abbreviations for axis labels inside the chart, not the title
- Do not encode the chart type in the title; the reader announces it already
- A dynamic measure-bound title is spoken on every filter change; keep it a plain readable phrase with no glyphs or unit-suffix soup

Scan titles across a page:
```bash
pbir visuals format "MyPage/*" -p title.text
```

### Title visibility and alt text

A hidden title (`title.show=false`) makes the reader fall back to a worthless auto name ("chart 4"). If the title is hidden for layout reasons, supply descriptive alt text on the visual's `general.altText` property instead.

Decorative title textboxes (section headers, visual labels) should be removed from the tab order (set `tabOrder` to -1) so readers skip them rather than announcing them as navigation stops.

## Best Practices

1. **Consistent positioning** - Same x, y across all pages
2. **Consistent sizing** - Same width, height, font size
3. **Descriptive text** - Clearly describe page purpose, spell out abbreviations
4. **Avoid redundancy** - Don't repeat report name if obvious
5. **Consider mobile** - Ensure readable on smaller screens; see `mobile.md`
