# pythonVisual (Python Visual)

Renders output from a Python script (e.g. matplotlib, seaborn) as a static image inside a Power BI visual container.

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
    "pythonVisual": {
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

- The `script` container holds `provider` (e.g. `"PBI_CV_..."`) and `source` (the Python code string); neither is meaningful to theme — they are set per-visual.
- The rendered plot image fills the visual container; no data-layer formatting (axes, colors, fonts inside the plot) is controlled by Power BI themes — style those inside the Python script itself.
- Use the `python-visuals` skill when authoring or editing the Python script.
