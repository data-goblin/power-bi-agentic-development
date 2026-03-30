# multiRowCard (Multi-Row Card)

A legacy multi-row card visual that displays multiple fields per record in a repeating card layout with an optional left accent bar.

## Containers

| Container | Key Properties |
|-----------|---------------|
| `cardTitle` | `color`, `fontFamily`, `fontSize`, `bold`, `italic`, `underline` |
| `dataLabels` | `color`, `fontFamily`, `fontSize`, `bold`, `italic`, `underline` |
| `card` | `barShow`, `barColor`, `barWeight`, `cardBackground`, `outlineColor`, `outlineWeight` |
| `categoryLabels` | `show` |
| `title` | `show`, `text`, `fontColor`, `fontFamily`, `fontSize` |
| `background` | `show`, `color`, `transparency` |
| `border` | `show`, `color`, `width`, `radius` |
| `dropShadow` | `show` |

## Theme Example

```json
{
  "name": "My Theme",
  "visualStyles": {
    "multiRowCard": {
      "*": {
        "cardTitle": [{
          "fontFamily": "Segoe UI Semibold",
          "fontSize": 12
        }],
        "dataLabels": [{
          "fontFamily": "Segoe UI",
          "fontSize": 11
        }],
        "card": [{ "barShow": false }],
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

- `cardTitle.color` and `dataLabels.color` are named `color`, **not** `fontColor` — consistent with the legacy `card` visual and inconsistent with `cardVisual`.
- To hide the left accent bar, set `card.barShow` to `false` — there is no separate `bar` container; `barShow` lives inside the `card` container.
- `multiRowCard` is a distinct legacy visual type; the modern equivalent is `cardVisual` (the New Card), which has a completely different container structure.
