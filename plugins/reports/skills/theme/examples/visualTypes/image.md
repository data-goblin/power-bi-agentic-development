# image (Image)

A static image container that displays a URL, embedded binary, or data-bound image field on the report canvas.

## Containers

| Container | Key Properties |
|-----------|---------------|
| `image` | `fit`, `transparency`, `cornerRadius`, `sourceType`, `sourceUrl` |
| `lockAspect` | `show` |
| `title` | `show` |
| `border` | `show`, `color`, `width`, `radius` |
| `dropShadow` | `show` |
| `background` | `show`, `color`, `transparency` |

## Theme Example

```json
{
  "name": "My Theme",
  "visualStyles": {
    "image": {
      "*": {
        "image": [{ "fit": "Fit", "transparency": 0 }],
        "lockAspect": [{ "show": true }],
        "title": [{ "show": false }],
        "border": [{ "show": false }],
        "dropShadow": [{ "show": false }]
      }
    }
  }
}
```

## Notes

- `fit` accepts `"Fit"`, `"Stretch"`, `"Fill"`, or `"Normal"` — `"Fit"` is the safest default for logos and icons.
- `lockAspect.show` locks the width/height ratio during resize; enable it in the theme to prevent accidental distortion.
- The image source (`sourceType`, `sourceUrl`, `sourceFile`, `sourceField`) is stored per-visual in the report definition, not in the theme; only presentational properties like `fit` and `transparency` are meaningful at theme level.
