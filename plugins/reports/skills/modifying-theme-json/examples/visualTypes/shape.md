# shape (Shape)

A decorative geometric shape (rectangle, circle, line, arrow, etc.) used for visual layout and framing on the report canvas.

## Containers

| Container | Key Properties |
|-----------|---------------|
| `shape` | `tileShape`, `rectangleRoundedCurve`, `roundEdge` |
| `fill` | `show`, `fillColor`, `transparency` |
| `outline` | `show`, `lineColor`, `weight`, `transparency` |
| `rotation` | (angle, not typically themed) |
| `title` | `show` |
| `background` | `show`, `color`, `transparency` |
| `border` | `show` |
| `dropShadow` | `show` |

## Theme Example

```json
{
  "name": "My Theme",
  "visualStyles": {
    "shape": {
      "*": {
        "fill": [{ "show": true, "transparency": 0 }],
        "outline": [{ "show": false }],
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

- `fill.fillColor` and `outline.lineColor` are color objects — not plain strings. Use `{"solid": {"color": "#DDDDDD"}}`.
- `shape.tileShape` controls the geometry (e.g. `"rectangle"`, `"oval"`, `"line"`, `"arrow"`); this is typically set per-visual, not in the theme.
- The `shape` type has no `visualHeader` container — there is no hover action bar for decorative shapes.
