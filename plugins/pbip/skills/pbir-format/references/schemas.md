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

## K201 Example Schema Versions

Versions below match the K201 example project bundled with this skill. As of mid 2026, newer versions exist (e.g., `visualContainer/2.7.0`, `report/3.3.0`, `page/2.1.0`, `bookmark/2.1.0`). Microsoft updates schemas roughly monthly — **always use the `$schema` URL from your existing project files** rather than assuming these versions.

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

**Note:** `reportVersionAtImport` records the schema version **at the time the theme was imported** — it does not correspond to the report's current `$schema` URLs. Values vary per theme. The K201 example shows:
- baseTheme: `{"visual": "1.8.95", "report": "2.0.95", "page": "1.3.95"}`
- customTheme: `{"visual": "2.1.0", "report": "2.1.0", "page": "2.0.0"}`

Do not set this manually — Power BI Desktop manages it automatically.

## Key Schema Definitions

### Expression Types (from semanticQuery schema)

Common `expr` wrapper types (not exhaustive — the full schema defines 48+ types; see `QueryExpressionContainer` in the semanticQuery schema for the complete list):

- `Literal` -- fixed values with type suffixes (D, L, M, inner single quotes)
- `ThemeDataColor` -- theme color references (ColorId + Percent)
- `Measure` -- DAX measure references
- `Column` -- table column references
- `Aggregation` -- aggregated expressions (Function codes 0-8)
- `HierarchyLevel` -- hierarchy level references
- `FillRule` -- gradient color scales (linearGradient2, linearGradient3)
- `Conditional` -- IF-THEN-ELSE branching via Cases array (Condition/Value/DefaultValue)
- `Comparison` -- comparisons between two operands (ComparisonKind: 0=Equal, 1=GreaterThan, 2=GreaterThanOrEqual, 3=LessThanOrEqual, 4=LessThan)
- `Arithmetic` -- math operations
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

## Schema Coupling: Versions Move as a Set

Top-level schemas embed references to sub-schemas at fixed versions, and those versions advance together. Copying a fragment from a newer report into an older one can pass a naive JSON check yet fail at load time or silently drop properties.

Example couplings (verify against the CHANGELOG; these advance over time):
- `report/3.2.0` embeds `filterConfiguration/1.3.0` + `formattingObjectDefinitions/1.5.0`
- `report/2.1.0` embeds `filterConfiguration/1.2.0` + `formattingObjectDefinitions/1.4.0`
- `page/2.1.0` embeds `filterConfiguration/1.3.0` + `formattingObjectDefinitions/1.5.0` + `semanticQuery/1.4.0`

Treat a report's schema versions as one matched set. When copying a `visual.json` or filter fragment between reports, confirm compatible parent versions or regenerate in the target project. Check the CHANGELOG files for exact coupling:
```bash
gh api repos/microsoft/json-schemas/contents/fabric/item/report/definition/report --jq '.[].name'
```

Upgrade the whole matched set in one commit, then validate.

Pitfalls:
- `reportVersionAtImport` in theme metadata is engine-managed; it is not the report's schema version and must not be edited to "match"
- Schemas advance roughly monthly; pin tooling to the project's own `$schema` URLs, not a remembered version number

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
