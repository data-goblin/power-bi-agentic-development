# card (Card)

The legacy single-value card visual that displays one measure value with an optional category label below it.

## Containers

| Container | Key Properties |
|-----------|---------------|
| `labels` | `color`, `fontFamily`, `fontSize`, `bold`, `labelDisplayUnits`, `labelPrecision` |
| `categoryLabels` | `show`, `color`, `fontFamily`, `fontSize`, `bold` |
| `title` | `show`, `text`, `fontColor`, `fontFamily`, `fontSize` |
| `background` | `show`, `color`, `transparency` |
| `border` | `show`, `color`, `width`, `radius` |
| `dropShadow` | `show` |

## Theme Example

```json
{
  "name": "My Theme",
  "visualStyles": {
    "card": {
      "*": {
        "labels": [{
          "fontFamily": "Segoe UI Semibold",
          "fontSize": 28,
          "labelDisplayUnits": 0
        }],
        "categoryLabels": [{
          "show": true,
          "fontFamily": "Segoe UI",
          "fontSize": 11
        }],
        "title": [{ "show": false }],
        "background": [{ "show": false }],
        "border": [{ "show": false }],
        "dropShadow": [{ "show": false }]
      }
    }
  }
}
```

## Notes

- Both `labels.color` and `categoryLabels.color` are named `color`, **not** `fontColor` — this differs from most other visual containers.
- `labels.labelDisplayUnits` accepts integer values: `0` = Auto, `1` = None, `1000` = Thousands, `1000000` = Millions, etc.
- `card` is the legacy visual; the modern replacement is `cardVisual`. They do not share container names or property conventions.
