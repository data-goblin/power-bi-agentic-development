# scriptVisual (R Script Visual)

Renders output from an R script (e.g. ggplot2, base R graphics) as a static image inside a Power BI visual container.

## Containers

| Container    | Key properties                                                   |
|--------------|------------------------------------------------------------------|
| `title`      | `show`, `text`, `fontFamily`, `fontSize`, `fontColor`, `bold`   |
| `background` | `show`, `color`, `transparency`                                  |
| `border`     | `show`, `color`, `width`, `radius`                               |
| `dropShadow` | `show`, `preset`, `color`, `shadowBlur`, `transparency`          |
| `padding`    | `top`, `right`, `bottom`, `left`                                 |
| `script`     | `provider`, `source`                                             |

## Theme Example

```json
{
  "name": "My Theme",
  "visualStyles": {
    "scriptVisual": {
      "*": {
        "title": [{ "fontFamily": "Segoe UI", "fontSize": 12, "bold": false }],
        "background": [{ "show": true, "color": { "solid": { "color": "#F5F5F5" } }, "transparency": 0 }],
        "border": [{ "show": false }],
        "padding": [{ "top": 8, "right": 8, "bottom": 8, "left": 8 }]
      }
    }
  }
}
```

## Notes

- The `script` container holds `provider` and `source` (the R code string); neither property is meaningful to theme — they are set per-visual.
- The rendered plot image fills the container; axis colors, fonts, and chart styling inside the R plot are not controlled by Power BI themes — apply those via ggplot2 themes or base R `par()` in the script itself.
- Use the `r-visuals` skill when authoring or editing the R script.
