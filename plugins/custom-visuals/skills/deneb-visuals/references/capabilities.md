# Deneb Capabilities and Template Format

## Visual Capabilities

### Data Roles

Single data role -- all columns and measures go into one "Values" well:

```json
{
  "dataRoles": [{"displayName": "Values", "name": "dataset", "kind": "GroupingOrMeasure"}],
  "dataViewMappings": [{
    "categorical": {
      "categories": {"select": [{"bind": {"to": "dataset"}}], "dataReductionAlgorithm": {"window": {"count": 10000}}},
      "values": {"select": [{"bind": {"to": "dataset"}}]}
    }
  }]
}
```

### Supported Features

| Feature | Value |
|---------|-------|
| Landing page | Yes |
| Multi-visual selection | Yes |
| Empty data view | No |
| Cross-highlighting | Yes |
| Default title | Suppressed |
| Advanced edit mode | Level 2 |
| Enhanced tooltips | Yes (default + canvas) |

### Object Properties Reference

#### `vega` object (core)

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `jsonSpec` | text | -- | Vega/Vega-Lite specification JSON |
| `jsonConfig` | text | -- | Vega/Vega-Lite config JSON |
| `provider` | `vegaLite` / `vega` | `vegaLite` | Language provider |
| `version` | text | -- | Provider version string |
| `logLevel` | 0-4 | 3 | none/error/warn/info/debug |
| `renderMode` | `svg` / `canvas` | `svg` | Rendering engine |
| `enableTooltips` | bool | true | Power BI tooltips |
| `enableContextMenu` | bool | true | Right-click context menu |
| `enableHighlight` | bool | false | Cross-highlighting |
| `enableSelection` | bool | false | Cross-filtering |
| `selectionMode` | `simple` / `advanced` | `simple` | Selection management |
| `selectionMaxDataPoints` | 1-250 | 50 | Max selectable points (UI slider cap; advanced mode supports up to 2500) |
| `tooltipDelay` | numeric | -- | Tooltip display delay (ms) |

#### `editor` object

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `theme` | `dark` / `light` | `light` | Editor color theme |
| `fontSize` | fontSize | 8 | Editor font size |
| `wordWrap` | bool | true | Enable word wrap |
| `showLineNumbers` | bool | -- | Show line numbers |
| `position` | `left` / `right` | -- | Editor pane position |
| `debouncePeriod` | numeric | -- | Auto-apply debounce (ms) |

#### `display` object

| Property | Type | Description |
|----------|------|-------------|
| `scrollbarColor` | solid color | Scrollbar fill color |
| `scrollbarOpacity` | integer | Scrollbar opacity |
| `scrollbarRadius` | integer | Scrollbar border radius |

#### `dataLimit` object

| Property | Type | Description |
|----------|------|-------------|
| `override` | bool | Override default 10K row limit |
| `showCustomVisualNotes` | bool | Show custom visual notes |

#### `stateManagement` object (auto-managed)

| Property | Type | Description |
|----------|------|-------------|
| `viewportHeight` | numeric | Current viewport height |
| `viewportWidth` | numeric | Current viewport width |

#### `developer` object (internal)

| Property | Type | Description |
|----------|------|-------------|
| `version` | text | Deneb visual version |
| `locale` | enum | Locale (en-US, en-GB, de-DE, fr-FR) |

## Template Format (v1)

Templates are valid Vega/Vega-Lite JSON files with a `usermeta` object. Schema: `https://deneb.guide/schema/deneb-template-usermeta-v1.json`

### Structure

```json
{
  "$schema": "https://vega.github.io/schema/vega-lite/v5.json",
  "usermeta": {
    "deneb": {
      "build": "1.9.0.0",
      "metaVersion": 1,
      "provider": "vegaLite",
      "providerVersion": "6.4.1"
    },
    "information": {
      "name": "Chart Name",
      "description": "Description",
      "author": "Author Name",
      "uuid": "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx",
      "generated": "2024-01-01T00:00:00.000Z"
    },
    "dataset": [
      {"key": "__category__", "name": "Category", "kind": "column", "type": "text"},
      {"key": "__measure__", "name": "Measure", "kind": "measure", "type": "numeric"}
    ],
    "interactivity": {
      "tooltip": true,
      "contextMenu": true,
      "selection": false,
      "highlight": false,
      "dataPointLimit": 50
    }
  },
  "data": {"name": "dataset"},
  "mark": "bar",
  "encoding": {
    "x": {"field": "__category__", "type": "nominal"},
    "y": {"field": "__measure__", "type": "quantitative"}
  }
}
```

### `usermeta.deneb` (required)

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `build` | string | Yes | Semantic version of the Deneb visual |
| `metaVersion` | number | Yes | Must be `1` |
| `provider` | enum | Yes | `"vega"` or `"vegaLite"` |
| `providerVersion` | string | Yes | Vega/Vega-Lite version |

### `usermeta.information` (required)

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `name` | string (max 100) | Yes | Template display name |
| `author` | string (max 100) | Yes | Creator identifier |
| `description` | string (max 300) | No | Detailed description |
| `uuid` | UUID v4 | Yes | Unique template ID |
| `generated` | date-time | Yes | UTC timestamp |
| `supportUri` | URI | No | Documentation link |
| `previewImageBase64PNG` | string | No | Base64 preview (max 150x150px) |

### `usermeta.dataset` (required, array)

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `key` | string `^__[a-zA-Z0-9]+__$` (max 30) | Yes | Placeholder key in spec |
| `name` | string (max 30) | Yes | Display name |
| `kind` | `any` / `column` / `measure` | Yes | Field type |
| `type` | `bool` / `dateTime` / `numeric` / `other` / `text` | Yes | Data type |
| `description` | string (max 300) | No | Usage description |

### `usermeta.interactivity` (optional)

| Property | Type | Description |
|----------|------|-------------|
| `tooltip` | bool | Enable tooltips |
| `contextMenu` | bool | Enable context menu |
| `selection` | bool | Enable cross-filtering |
| `highlight` | bool | Enable cross-highlighting |
| `dataPointLimit` | 1-250 | Max selectable data points |

## Special Fields

Deneb adds these fields to the dataset at runtime:

| Field | Purpose |
|-------|---------|
| `__row__` | Zero-based row index. Use for cross-filtering row context. Replaces `__identity__` (removed in 1.9) |
| `__selected__` | Selection state: `"on"`, `"off"`, or `"neutral"` |
| `<field>__highlight` | Cross-highlight value for each measure (the highlighted number) |
| `<field>__highlightStatus` | Highlight state per measure: `"on"`, `"off"`, or `"neutral"` |
| `<field>__highlightComparator` | Pre-computed comparison: `"eq"`, `"lt"`, `"gt"`, `"neq"` (highlight vs original) |
| `<field>__formatted` | Pre-formatted string value using the Power BI format string for that measure |
| `<field>__format` | The Power BI format string for the measure (e.g. `"$#,0.00"`) |

> **Breaking change in 1.9:** `__identity__` and `__key__` were removed. Any spec using `datum.__identity__` must be updated to `datum.__row__`.

## Community Resources

| Resource | URL |
|----------|-----|
| Deneb documentation | https://deneb.guide |
| Deneb GitHub | https://github.com/deneb-viz/deneb |
| Kerry Kolosko templates | https://kerrykolosko.com/portfolio/ |
| PBI-David/Deneb-Showcase | https://github.com/PBI-David/Deneb-Showcase |
| PBIQueryous/Deneb | https://github.com/PBIQueryous/Deneb |
| avatorl/Deneb-Vega-Templates | https://github.com/avatorl/Deneb-Vega-Templates |
| Vega-Lite docs | https://vega.github.io/vega-lite/ |
