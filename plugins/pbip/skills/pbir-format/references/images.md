# Images in PBIR Reports

Images in Power BI reports come from three sources: static files in RegisteredResources, base64-encoded data URIs in themes, and measure-driven dynamic content (SVGs).

## Static Images (RegisteredResources)

Physical image files stored alongside the report. Used for backgrounds, wallpapers, and image visuals.

### File location

```
Report.Report/
  StaticResources/
    RegisteredResources/
      my-logo15640660799959338.png      # Image file (name includes unique suffix)
      SqlbiDataGoblinTheme.json          # Themes live here too
```

### Registration in report.json

Every image must be registered in `resourcePackages` to be referenced:

```json
"resourcePackages": [
  {
    "name": "RegisteredResources",
    "type": "RegisteredResources",
    "items": [
      {
        "name": "my-logo15640660799959338.png",
        "path": "my-logo15640660799959338.png",
        "type": "Image"
      },
      {
        "name": "CustomTheme.json",
        "path": "CustomTheme.json",
        "type": "CustomTheme"
      }
    ]
  }
]
```

Item types: `"Image"`, `"CustomTheme"`, `"BaseTheme"`.

### Referencing in page.json or visual.json

Use `ResourcePackageItem` expression to reference registered images:

```json
"image": {
  "image": {
    "name": {
      "expr": {"Literal": {"Value": "'my-logo.png'"}}
    },
    "url": {
      "expr": {
        "ResourcePackageItem": {
          "PackageName": "RegisteredResources",
          "PackageType": 1,
          "ItemName": "my-logo15640660799959338.png"
        }
      }
    },
    "scaling": {
      "expr": {"Literal": {"Value": "'Fit'"}}
    }
  }
}
```

- `name` -- display name (can be anything)
- `ItemName` -- must match the registered name in `resourcePackages` exactly
- `PackageName` -- always `"RegisteredResources"` for user images
- `PackageType` -- always `1` for RegisteredResources
- `scaling` -- `'Fit'`, `'Fill'`, `'Tile'`, `'Normal'`

### Naming convention

Power BI Desktop appends a unique numeric suffix to image file names:

```
descriptive_name + unique_numeric_id + .extension
DG-Background15640660799959338.png
space_tiles006469569899665184.png
```

When adding images programmatically, generate a similar suffix (e.g. using a timestamp or random digits).

### Where images can be used

| Location | Object | Property path |
|----------|--------|---------------|
| Page background | `page.json` -> `objects.background` | `image.image.url` |
| Page wallpaper | `page.json` -> `objects.outspace` | `image.image.url` |
| Image visual | `visual.json` (visualType: `"image"` — **verify against your PBI Desktop export**) | `objects.general.image` |
| Theme background | Theme JSON -> `visualStyles.page."*".background` | `image` (data URI) |

## Base64 Images in Themes

Themes can embed images directly as data URIs. This is how theme-level background images work -- they apply to all pages without separate image files.

```json
{
  "visualStyles": {
    "page": {
      "*": {
        "background": [{
          "image": {
            "image": {
              "url": "data:image/png;base64,iVBORw0KGgoAAAANSUhEU...",
              "scaling": "Fill"
            }
          }
        }]
      }
    }
  }
}
```

**Theme JSON uses bare values** (no expr wrappers): `"scaling": "Fill"` not `{"expr": {"Literal": {"Value": "'Fill'"}}}`.

Keep base64 images small -- they bloat the theme file. For large images, use RegisteredResources instead.

## Measure-Driven Images (SVGs)

DAX measures can return SVG markup as strings, rendered inline in visuals. This enables sparklines, bullet charts, progress bars, and custom KPI indicators.

### How it works

1. Create a DAX measure that returns SVG markup
2. Set `dataCategory: "ImageUrl"` on the measure (in model or reportExtensions.json)
3. Add the measure to a supported visual

### Extension measure with SVG

```json
{
  "name": "Bullet Chart",
  "dataType": "Text",
  "dataCategory": "ImageUrl",
  "expression": "\"data:image/svg+xml;utf8,\" & \"<svg xmlns='http://www.w3.org/2000/svg' width='200' height='20'>\" & \"<rect width='\" & FORMAT([Actual] / [Target] * 200, \"0\") & \"' height='20' fill='#118DFF'/>\" & \"<line x1='\" & FORMAT([Target] / [Max] * 200, \"0\") & \"' y1='0' x2='\" & FORMAT([Target] / [Max] * 200, \"0\") & \"' y2='20' stroke='#D64550' stroke-width='2'/>\" & \"</svg>\"",
  "references": {
    "measures": [
      {"entity": "Sales", "name": "Actual"},
      {"entity": "Sales", "name": "Target"},
      {"entity": "Sales", "name": "Max"}
    ]
  }
}
```

The measure returns a data URI: `data:image/svg+xml;utf8,<svg>...</svg>`

### Supported visuals for SVG measures

- **tableEx** -- column values with `grid.imageHeight` / `grid.imageWidth`
- **pivotTable** -- same as table
- **cardVisual** (new card) -- image callouts
- **advancedSlicerVisual** -- header images and custom items
- **scatterChart** -- background images

Classic `card` does NOT support SVG. Use `cardVisual` instead.

### Visual configuration for SVG columns

In a table visual, configure image sizing:

```json
"grid": [{
  "properties": {
    "imageHeight": {"expr": {"Literal": {"Value": "20D"}}},
    "imageWidth": {"expr": {"Literal": {"Value": "200D"}}}
  }
}]
```

See [how-to/svg-in-visuals.md](./how-to/svg-in-visuals.md) for comprehensive SVG patterns and examples.

## Related

- [wallpaper.md](./wallpaper.md) -- Wallpaper images (outspace)
- [page.md](./page.md) -- Page background images
- [theme.md](./theme.md) -- Theme-level image embedding
- [how-to/svg-in-visuals.md](./how-to/svg-in-visuals.md) -- SVG measure patterns
- [report-extensions.md](./report-extensions.md) -- Extension measures with dataCategory
