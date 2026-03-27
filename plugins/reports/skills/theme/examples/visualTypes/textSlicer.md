# textSlicer (Text Slicer)

Text search/input slicer for filtering by typed string values; designed for free-text filter conditions rather than list selection.

## Containers

| Container | Key Properties |
|-----------|----------------|
| `inputText` | `fontColor`, `fontFamily`, `fontSize`, `bold`, `italic`, `underline`, `placeholder`, `backColor`, `backShow`, `borderColor`, `borderShow`, `borderWidth`, `dismissColor`, `dismissSize` |
| `inputTextBox` | `backColor`, `backShow`, `borderColor`, `borderShow`, `borderWidth`, `placeholderFontColor`, `placeholderFontFamily`, `placeholderFontSize`, `placeholderBold`, `placeholderItalic`, `containerCornerRadius`, `paddingTop`, `paddingBottom`, `paddingLeft`, `paddingRight` |
| `filterOperator` | Operator dropdown styling (24 properties) |
| `applyButton` | Apply button styling (15 properties) |
| `dropdown` | Operator dropdown visibility (1 property) |
| `slicerSettings` | Slicer-level settings (1 property) |

## Theme Example

```json
{
  "name": "My Theme",
  "visualStyles": {
    "textSlicer": {
      "*": {
        "inputText": [
          {
            "fontSize": 11,
            "fontFamily": "Segoe UI",
            "fontColor": { "solid": { "color": "#252423" } },
            "placeholder": "Search...",
            "backShow": true,
            "backColor": { "solid": { "color": "#FFFFFF" } },
            "borderShow": true,
            "borderColor": { "solid": { "color": "#D1D1D1" } },
            "borderWidth": 1
          }
        ],
        "inputTextBox": [
          {
            "backShow": true,
            "backColor": { "solid": { "color": "#F5F5F5" } },
            "borderShow": true,
            "borderColor": { "solid": { "color": "#D1D1D1" } },
            "containerCornerRadius": 4,
            "placeholderFontFamily": "Segoe UI",
            "placeholderFontSize": 11,
            "placeholderFontColor": { "solid": { "color": "#A0A0A0" } }
          }
        ]
      }
    }
  }
}
```

## Notes

- `inputText` controls the text the user types (active input text), while `inputTextBox` controls the container/box that wraps it including placeholder text styling.
- `dismissColor` and `dismissSize` in `inputText` style the clear/dismiss icon that appears inside the text field.
- Use `filterOperator` to style the operator dropdown (e.g. "Contains", "Starts with") and `applyButton` for the apply/confirm button when `slicerSettings` requires manual apply.
