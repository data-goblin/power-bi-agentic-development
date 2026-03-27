# actionButton (Action Button)

An interactive button visual that supports bookmark navigation, page navigation, Q&A, drill-through, and web URL actions.

## Containers

| Container | Key Properties |
|-----------|---------------|
| `fill` | `show`, `fillColor`, `transparency` |
| `text` | `show`, `text`, `fontColor`, `fontFamily`, `fontSize`, `bold`, `horizontalAlignment` |
| `outline` | `show`, `lineColor`, `weight` |
| `shape` | `tileShape`, `rectangleRoundedCurve` |
| `icon` | `show` |
| `title` | `show` |
| `background` | `show`, `color`, `transparency` |
| `border` | `show` |
| `dropShadow` | `show` |

## Theme Example

```json
{
  "name": "My Theme",
  "visualStyles": {
    "actionButton": {
      "*": {
        "fill": [{ "show": true, "transparency": 0 }],
        "text": [{
          "show": true,
          "fontFamily": "Segoe UI Semibold",
          "fontSize": 11,
          "horizontalAlignment": "center"
        }],
        "outline": [{ "show": false }],
        "title": [{ "show": false }],
        "background": [{ "show": false }],
        "border": [{ "show": false }],
        "dropShadow": [{ "show": false }]
      },
      "hover": {
        "fill": [{ "transparency": 20 }]
      },
      "press": {
        "fill": [{ "transparency": 40 }]
      },
      "selected": {
        "outline": [{ "show": true }]
      },
      "disabled": {
        "fill": [{ "transparency": 60 }],
        "text": [{ "show": false }]
      }
    }
  }
}
```

## Notes

- State keys are `*` (default), `hover`, `press`, `selected`, and `disabled` — only `*` is required; omitted states inherit from `*`.
- `fill.$id` and `text.$id` are internal identifiers returned by `pbir schema describe` but should not be included in theme JSON.
- `text.fontColor` is a color object (`{"solid": {"color": "#FFFFFF"}}`), not a plain string; `fill.fillColor` follows the same pattern.
