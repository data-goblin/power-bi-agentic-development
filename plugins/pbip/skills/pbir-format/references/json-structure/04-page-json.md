# page.json

Page configuration including size, background, and display options.

## Location

`Report.Report/definition/pages/[PageName]/page.json`

## Structure

```json
{
  "$schema": "https://developer.microsoft.com/json-schemas/fabric/item/report/definition/page/1.0.0/schema.json",
  "name": "page-guid",
  "displayName": "Overview",
  "displayOption": 0,
  "width": 1280,
  "height": 720,
  "objects": {...}
}
```

## Key Properties

### displayOption

| Value | Size | Use Case |
|-------|------|----------|
| 0 | Custom (width/height) | Default |
| 1 | 4:3 | Presentations |
| 2 | 16:9 | Widescreen |
| 3 | Letter | Print |
| 4 | Tooltip | Tooltip pages |

### Common Sizes

| Type | Width | Height |
|------|-------|--------|
| Default | 1280 | 720 |
| Large | 1920 | 1080 |
| Tooltip | 320 | 240 |
| Letter | 816 | 1056 |

### objects

Page-level formatting:

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

- `background`: Page canvas color
- `wallpaper`: Area outside canvas (when page is smaller than viewport)

## pages.json

Page ordering file at `Report.Report/definition/pages/pages.json`:

```json
{
  "$schema": "https://developer.microsoft.com/json-schemas/fabric/item/report/definition/pages/1.0.0/schema.json",
  "activePageName": "page-guid",
  "pageOrder": [
    "page-guid-1",
    "page-guid-2"
  ]
}
```

## Search

```bash
# Find page dimensions
grep -E '"width"|"height"' Report.Report/definition/pages/*/page.json

# Find page display names
grep '"displayName"' Report.Report/definition/pages/*/page.json

# Find page order
cat Report.Report/definition/pages/pages.json
```
