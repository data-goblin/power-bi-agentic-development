# Power BI PBIR Schemas

**Schemas update frequently** -- Microsoft updates PBIR schemas roughly monthly. Always match the `$schema` URL in existing report files. Do not upgrade schema versions unless intentional.

Source repository: `https://github.com/microsoft/json-schemas`

## Schema URL Patterns

Two URL shapes depending on file type:

**Most PBIR files** (inside `definition/`):
```
https://developer.microsoft.com/json-schemas/fabric/item/report/definition/{type}/{version}/schema.json
```

**Root-level files** (`definition.pbir`, `localSettings.json`):
```
https://developer.microsoft.com/json-schemas/fabric/item/report/{type}/{version}/schema.json
```

**Other:**
- Platform: `.../fabric/gitIntegration/platformProperties/2.0.0/schema.json`
- PBIP project: `.../fabric/pbip/pbipProperties/1.0.0/schema.json`
- Semantic model: `.../fabric/item/semanticModel/{type}/{version}/schema.json`

## Current Schema Versions

Versions below are from the K201 example (mid-2024). Microsoft updates PBIR schemas roughly monthly — newer reports may use higher versions. **Always use the `$schema` URL from your existing project files** rather than the latest version.

| Schema Type | Version | File |
|-------------|---------|------|
| visualContainer | 2.4.0 | visual.json |
| report | 3.0.0 | report.json |
| page | 2.0.0 | page.json |
| semanticQuery | 1.4.0 | (embedded in visual.json query) |
| formattingObjectDefinitions | 1.5.0 | (embedded in visual.json objects) |
| reportExtension | 1.0.0 | reportExtensions.json |
| versionMetadata | 1.0.0 | version.json |
| pagesMetadata | 1.0.0 | pages.json |
| bookmark | 1.4.0 | [id].bookmark.json |
| bookmarksMetadata | 1.0.0 | bookmarks.json |
| filterConfiguration | 1.3.0 | (embedded in report.json / visual.json) |
| visualConfiguration | 2.3.0 | (embedded in visual.json) |
| visualContainerMobileState | 2.3.0 | mobile.json |
| definitionProperties | 2.0.0 | definition.pbir |

**Note:** `reportVersionAtImport` format depends on the report schema version:
- Report schema 2.x: `"reportVersionAtImport": "5.51"` (string)
- Report schema 3.x: `"reportVersionAtImport": {"visual": "2.4.0", "report": "3.0.0", "page": "2.3.0"}` (object)

## Key Schema Definitions

### Expression Types (from semanticQuery schema)

All valid `expr` wrapper types:

- `Literal` -- fixed values with type suffixes (D, L, M, inner single quotes)
- `ThemeDataColor` -- theme color references (ColorId + Percent)
- `Measure` -- DAX measure references
- `Column` -- table column references
- `Aggregation` -- aggregated expressions (Function codes 0-5)
- `HierarchyLevel` -- hierarchy level references
- `FillRule` -- gradient color scales (linearGradient2, linearGradient3)
- `Conditional` -- rule-based conditions (ComparisonKind 0-4)
- `Arithmetic` -- math operations
- `Comparison` -- comparisons
- `And` / `Or` / `Not` -- logical operations
- `SparklineData` -- inline sparklines in tables

### dataViewWildcard.matchingOption (from formattingObjectDefinitions schema)

| Value | Name | Description |
|-------|------|-------------|
| 0 | Default | Match identities and totals |
| 1 | Instances | Match instances with identities only (per-point formatting) |
| 2 | Totals | Match totals only |

### Selector Types (from formattingObjectDefinitions schema)

| Selector | Purpose | Example |
|----------|---------|---------|
| (none) | Applies to all | No `selector` key on the property object |
| `metadata` | Specific column/measure | `"selector": {"metadata": "Orders.Order Lines"}` |
| `id` | Named instance | `"selector": {"id": "default"}` |
| `dataViewWildcard` | Pattern matching | `"selector": {"data": [{"dataViewWildcard": {"matchingOption": 1}}]}` |
| `scopeId` | Specific data point value | `"selector": {"data": [{"scopeId": {"Comparison": {...}}}]}` |

Selectors can be combined: `metadata` + `data` + `id` + `order` on the same selector object.

## Schema Exploration

```bash
# List all schema versions for a type
gh api repos/microsoft/json-schemas/contents/fabric/item/report/definition/visualContainer

# Find all expression types in a schema
curl -s https://developer.microsoft.com/json-schemas/fabric/item/report/definition/semanticQuery/1.4.0/schema.json | \
  jq -r '.definitions.QueryExpressionContainer.properties | keys[]'

# Find all selector properties
curl -s https://developer.microsoft.com/json-schemas/fabric/item/report/definition/formattingObjectDefinitions/1.5.0/schema.json | \
  jq -r '.definitions.Selector.properties | keys[]'
```
