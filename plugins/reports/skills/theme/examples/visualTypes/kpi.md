# kpi (KPI)

A KPI visual that shows a primary indicator value against a goal, with an optional trend sparkline and status colouring.

## Containers

| Container | Key Properties |
|-----------|---------------|
| `indicator` | `fontColor`, `fontFamily`, `fontSize`, `bold`, `horizontalAlignment`, `showIcon`, `iconSize` |
| `trendline` | `show`, `transparency` |
| `goals` | `showGoal`, `showDistance`, `direction`, `goalFontFamily`, `distanceFontFamily`, `fontSize` |
| `status` | `direction`, `goodColor`, `neutralColor`, `badColor` |
| `title` | `show`, `text`, `fontColor`, `fontFamily`, `fontSize` |
| `background` | `show`, `color`, `transparency` |
| `border` | `show`, `color`, `width`, `radius` |
| `dropShadow` | `show` |

## Theme Example

```json
{
  "name": "My Theme",
  "visualStyles": {
    "kpi": {
      "*": {
        "indicator": [{
          "fontFamily": "Segoe UI Semibold",
          "fontSize": 28,
          "horizontalAlignment": "center",
          "showIcon": true
        }],
        "trendline": [{ "show": true, "transparency": 0 }],
        "goals": [{ "showGoal": true, "showDistance": true, "direction": "High is good" }],
        "status": [{ "direction": "Positive" }],
        "title": [{ "show": true }],
        "background": [{ "show": false }],
        "border": [{ "show": false }],
        "dropShadow": [{ "show": false }]
      }
    }
  }
}
```

## Notes

- The container is `trendline` (lowercase L) — a common typo is `trendLine`; the wrong casing will silently be ignored.
- `status.direction` controls whether positive variance is good (`"Positive"`) or bad (`"Negative"`); it defaults to `"Positive"` but must be set explicitly in the theme if your KPIs measure costs.
- `goals.direction` and `status.direction` are independent settings: `goals.direction` labels the distance metric, `status.direction` determines the colour logic.
