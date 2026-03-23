# page.json

Page configuration including dimensions, display option, background, and visual interactions.

## Location

`Report.Report/definition/pages/[PageName]/page.json`

## Structure

```json
{
  "$schema": "https://developer.microsoft.com/json-schemas/fabric/item/report/definition/page/2.1.0/schema.json",
  "name": "77e770be04c64c0c6938",
  "displayName": "Overview",
  "displayOption": "FitToPage",
  "height": 720,
  "width": 1280,
  "objects": {},
  "visualInteractions": []
}
```

## Key Properties

### displayOption

| Value | Description |
|-------|-------------|
| `"FitToPage"` | Scale to fit viewport (default) |
| `"FitToWidth"` | Scale to viewport width |
| `"ActualSize"` | No scaling |

### Common Sizes

| Type | Width | Height |
|------|-------|--------|
| Default | 1280 | 720 |
| Large | 1920 | 1080 |
| Tooltip | 320 | 240 |
| Letter | 816 | 1056 |

### objects

Page-level formatting (background and wallpaper):

```json
"objects": {
  "background": [{
    "properties": {
      "color": {"solid": {"color": {"expr": {"Literal": {"Value": "'#FFFFFF'"}}}}},
      "transparency": {"expr": {"Literal": {"Value": "0D"}}}
    }
  }],
  "wallpaper": [{
    "properties": {
      "color": {"solid": {"color": {"expr": {"ThemeDataColor": {"ColorId": 0, "Percent": 0}}}}}
    }
  }]
}
```

- `background` -- page canvas color (the area visuals sit on)
- `wallpaper` -- area outside canvas (visible when page is smaller than viewport)

### visualInteractions

Override default cross-filtering between visuals:

```json
"visualInteractions": [
  {
    "source": "slicer_visual_name",
    "target": "chart_visual_name",
    "type": "NoFilter"
  }
]
```

Interaction types: `"NoFilter"` (disable cross-filtering between source and target).

## pages.json

Page ordering file at `Report.Report/definition/pages/pages.json`:

```json
{
  "$schema": "https://developer.microsoft.com/json-schemas/fabric/item/report/definition/pagesMetadata/1.0.0/schema.json",
  "activePageName": "77e770be04c64c0c6938",
  "pageOrder": [
    "77e770be04c64c0c6938",
    "Overview",
    "Details"
  ]
}
```

Page IDs in `pageOrder` can be hex strings or human-readable folder names.
