# textbox (Text Box)

A free-form rich text container used for labels, headings, and annotations on a report canvas.

## Containers

| Container | Key Properties |
|-----------|---------------|
| `text` | `color`, `fontFamily`, `fontSize` |
| `title` | `show`, `text`, `fontColor`, `fontFamily`, `fontSize` |
| `subTitle` | `show` |
| `background` | `show`, `color`, `transparency` |
| `border` | `show`, `color`, `width`, `radius` |
| `dropShadow` | `show` |
| `divider` | `show` |
| `visualHeader` | `show` |

## Theme Example

```json
{
  "name": "My Theme",
  "visualStyles": {
    "textbox": {
      "*": {
        "text": [{ "fontFamily": "Segoe UI", "fontSize": 12 }],
        "title": [{ "show": false }],
        "subTitle": [{ "show": false }],
        "background": [{ "show": false }],
        "border": [{ "show": false }],
        "dropShadow": [{ "show": false }],
        "divider": [{ "show": false }],
        "visualHeader": [{ "show": false }]
      }
    }
  }
}
```

## Notes

- `text.color` is an object (use `{"solid": {"color": "#333333"}}`), not a plain string.
- The `visualHeader` container has a `show` property — setting it to `false` removes the hover toolbar entirely, which is the standard approach for decorative text boxes.
- Textbox content itself is stored in the visual's `config` JSON, not in the theme; the theme only controls default typography and chrome suppression.
