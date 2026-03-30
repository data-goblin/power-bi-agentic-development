# Textbox Visuals in Power BI Reports

## Overview

Textbox visuals (`visualType: "textbox"`) are used for static text content, titles, descriptions, and annotations on report pages.

## Minimal Working Structure

**CRITICAL:** Modern textboxes use direct array format for paragraphs, NOT `expr.Literal.Value` wrapper:

```json
{
  "$schema": "https://developer.microsoft.com/json-schemas/fabric/item/report/definition/visualContainer/2.4.0/schema.json",
  "name": "visual_id",
  "position": {
    "x": 42,
    "y": 37,
    "z": 1000,
    "height": 80,
    "width": 500,
    "tabOrder": 0
  },
  "visual": {
    "visualType": "textbox",
    "objects": {
      "general": [
        {
          "properties": {
            "paragraphs": [
              {
                "textRuns": [
                  {
                    "value": "Your Text Here",
                    "textStyle": {
                      "fontFamily": "Segoe UI",
                      "fontSize": "28pt",
                      "fontWeight": "600"
                    }
                  }
                ]
              }
            ]
          }
        }
      ]
    },
    "visualContainerObjects": {
      "title": [
        {
          "properties": {
            "show": {
              "expr": {"Literal": {"Value": "false"}}
            }
          }
        }
      ],
      "background": [
        {
          "properties": {
            "show": {
              "expr": {"Literal": {"Value": "false"}}
            }
          }
        }
      ],
      "border": [
        {
          "properties": {
            "show": {
              "expr": {"Literal": {"Value": "false"}}
            }
          }
        }
      ],
      "dropShadow": [
        {
          "properties": {
            "show": {
              "expr": {"Literal": {"Value": "false"}}
            }
          }
        }
      ]
    }
  }
}
```

### Key Configuration Points

1. **High z-order (1000+)**: Ensures textbox appears on top of other visuals
2. **Tab order 0**: Makes it first in navigation order
3. **No explicit chrome properties**: Do NOT add `background`, `border`, `shadow`, or `visualHeader` unless needed - they can interfere with display
4. **Sufficient size**: Make height/width large enough for text content

## Key Components

### Query

Textboxes do **not** use a `query` object — omit it entirely. Real textbox visual.json files have no `query` key at all. Adding an empty `query: {queryState: {}}` is harmless but unnecessary and inconsistent with Power BI Desktop output.

### Paragraphs Property

**Modern Format (Correct):** Direct array of paragraph objects:

```json
"paragraphs": [
  {
    "textRuns": [
      {
        "value": "Text",
        "textStyle": {
          "fontSize": "14pt",
          "fontFamily": "Segoe UI"
        }
      }
    ]
  }
]
```

**Legacy Format (Deprecated):** JSON-encoded string with `expr.Literal.Value`:

```json
"paragraphs": {
  "expr": {
    "Literal": {
      "Value": "[{\"textRuns\":[{\"value\":\"Text\",\"textStyle\":{...}}]}]"
    }
  }
}
```

**Always use the modern format.** The legacy format may work but creates maintenance issues and inconsistencies with Power BI Desktop's UI-generated JSON.

### Text Style Properties

Inside `textStyle`, you can configure:
- **fontFamily**: Font name (e.g., "Segoe UI", "Arial")
- **fontSize**: Size with "pt" suffix (e.g., "28pt", "14pt") - use "pt" not "px"
- **fontWeight**: "normal", "bold", "100"-"900", "600" (semibold)
- **fontStyle**: "normal", "italic"
- **textDecoration**: "none", "underline"
- **color**: Hex color (e.g., "#000000")

Example with full styling:
```json
{
  "value": "Bold Red Title",
  "textStyle": {
    "fontFamily": "Segoe UI",
    "fontSize": "32pt",
    "fontWeight": "bold",
    "color": "#D64550"
  }
}
```

**Note on fontSize units:** Use `"pt"` (points) not `"px"` (pixels). Power BI Desktop generates pt values.

## Visual Properties

### Hiding Chrome Elements

To create a "clean" textbox (no title, background, borders, or shadow), use `visualContainerObjects`:

```json
"visualContainerObjects": {
  "title": [{
    "properties": {
      "show": {"expr": {"Literal": {"Value": "false"}}}
    }
  }],
  "background": [{
    "properties": {
      "show": {"expr": {"Literal": {"Value": "false"}}}
    }
  }],
  "border": [{
    "properties": {
      "show": {"expr": {"Literal": {"Value": "false"}}}
    }
  }],
  "dropShadow": [{
    "properties": {
      "show": {"expr": {"Literal": {"Value": "false"}}}
    }
  }]
}
```

**CRITICAL:** These properties go in `visualContainerObjects`, NOT `objects`. See [visual-container-formatting.md](./visual-container-formatting.md) for details on why this matters.

### Background Properties

If showing background:
```json
"background": [{
  "properties": {
    "show": {"expr": {"Literal": {"Value": "true"}}},
    "color": {
      "solid": {
        "color": {
          "expr": {"Literal": {"Value": "'#FFFFFF'"}}
        }
      }
    },
    "transparency": {"expr": {"Literal": {"Value": "0D"}}}
  }
}]
```

### Border Properties

If showing border:
```json
"border": [{
  "properties": {
    "show": {"expr": {"Literal": {"Value": "true"}}},
    "color": {
      "solid": {
        "color": {
          "expr": {"ThemeDataColor": {"ColorId": 0, "Percent": 0}}
        }
      }
    },
    "radius": {"expr": {"Literal": {"Value": "0D"}}}
  }
}]
```

## Multiple Paragraphs

Textboxes can contain multiple paragraphs:

```json
"paragraphs": [
  {
    "textRuns": [
      {
        "value": "First Paragraph",
        "textStyle": {"fontSize": "24pt"}
      }
    ]
  },
  {
    "textRuns": [
      {
        "value": "Second Paragraph",
        "textStyle": {"fontSize": "14pt"}
      }
    ]
  }
]
```

Each paragraph is an object in the array with its own `textRuns`.

## Text Runs

Within a paragraph, you can have multiple text runs with different styles:

```json
{
  "textRuns": [
    {
      "value": "Normal text ",
      "textStyle": {"fontSize": "14pt"}
    },
    {
      "value": "bold text",
      "textStyle": {"fontSize": "14pt", "fontWeight": "bold"}
    }
  ]
}
```

## Common Use Cases

### Page Title

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
                  "value": "Sales Report",
                  "textStyle": {
                    "fontFamily": "Segoe UI",
                    "fontSize": "28pt"
                  }
                }
              ]
            }
          ]
        }
      }]
    },
    "visualContainerObjects": {
      "title": [{"properties": {"show": {"expr": {"Literal": {"Value": "false"}}}}}],
      "background": [{"properties": {"show": {"expr": {"Literal": {"Value": "false"}}}}}],
      "border": [{"properties": {"show": {"expr": {"Literal": {"Value": "false"}}}}}],
      "dropShadow": [{"properties": {"show": {"expr": {"Literal": {"Value": "false"}}}}}]
    }
  }
}
```

### Descriptive Text

```json
{
  "value": "This chart shows monthly trends over the past year. Gray areas indicate incomplete data.",
  "textStyle": {
    "fontFamily": "Segoe UI",
    "fontSize": "12pt",
    "color": "#605E5C"
  }
}
```

### Section Header

```json
{
  "value": "Key Metrics",
  "textStyle": {
    "fontFamily": "Segoe UI",
    "fontSize": "18pt",
    "fontWeight": "600"
  }
}
```

## Positioning

Textboxes use standard visual positioning:
- **x, y**: Top-left corner position in pixels
- **z**: Layering order (higher = more in front)
- **width, height**: Size in pixels
- **tabOrder**: Tab navigation order

For page titles, typical positioning:
```json
"position": {
  "x": 20,
  "y": 20,
  "z": 1000,  // High z-order to ensure visibility
  "height": 50,
  "width": 400,
  "tabOrder": 0
}
```

## Drill Filtering

Textboxes should not filter other visuals:
```json
"drillFilterOtherVisuals": false
```

## Troubleshooting

**Textbox not visible:**
- Check that outer single quotes are NOT present in the Value string
- Verify z-order is high enough (try 1000+)
- Ensure position is within page dimensions
- Check background isn't covering the text

**Text not formatting:**
- Verify JSON string is properly escaped
- Check fontSize includes "pt" suffix (not "px")
- Ensure fontFamily matches available system fonts

**Text cut off:**
- Increase width/height in position object
- Check for text overflow settings
- Verify page dimensions accommodate the textbox

## Related Documentation

- [visual-container-formatting.md](./visual-container-formatting.md) - objects vs visualContainerObjects
- [page.md](./page.md) - Page-level properties
