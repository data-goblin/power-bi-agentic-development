# PBIR Annotations

Custom name-value pair metadata that can be added to reports, pages, and visuals. Power BI Desktop ignores annotations entirely -- they exist for external tools, scripts, and deployment automation.

## When to Use Annotations

- **Deployment automation** -- tag a default page, environment, or version for CI/CD scripts to read
- **Documentation** -- attach descriptions, owners, or last-reviewed dates to visuals or pages
- **External tooling** -- store metadata consumed by custom scripts, linters, or validation agents
- **Cross-report coordination** -- tag visuals with stable identifiers that survive renames

Annotations are NOT for runtime behavior. They do not affect rendering, filtering, or interactivity.


## Structure

Annotations are an array of `{ "name": string, "value": string }` objects. Both `name` and `value` are always strings.

```json
"annotations": [
  {
    "name": "annotationKey",
    "value": "annotationValue"
  }
]
```


## Report-Level Annotations

**File:** `definition/report.json`

Add the `annotations` array at the top level of the report object:

```json
{
  "$schema": "https://developer.microsoft.com/json-schemas/fabric/item/report/definition/report/1.0.0/schema.json",
  "themeCollection": {
    "baseTheme": {
      "name": "CY24SU10",
      "reportVersionAtImport": "5.55",
      "type": "SharedResources"
    }
  },
  "settings": { ... },
  "annotations": [
    {
      "name": "defaultPage",
      "value": "c2d9b4b1487b2eb30e98"
    },
    {
      "name": "environment",
      "value": "production"
    },
    {
      "name": "version",
      "value": "2.1.0"
    }
  ]
}
```

**Common report-level annotations:**

| Name | Purpose | Example Value |
|------|---------|---------------|
| `defaultPage` | Landing page for deployment scripts | `"c2d9b4b1487b2eb30e98"` (page object name) |
| `version` | Report version for release tracking | `"2.1.0"` |
| `environment` | Target environment tag | `"production"`, `"staging"`, `"dev"` |
| `owner` | Report owner for governance | `"analytics-team"` |
| `lastReviewed` | Audit trail | `"2026-03-15"` |


## Page-Level Annotations

**File:** `definition/pages/[PageName]/page.json`

Add the `annotations` array at the top level of the page object:

```json
{
  "$schema": "https://developer.microsoft.com/json-schemas/fabric/item/report/definition/page/2.0.0/schema.json",
  "name": "sales_overview",
  "displayName": "Sales Overview",
  "displayOption": "FitToPage",
  "height": 720,
  "width": 1280,
  "annotations": [
    {
      "name": "section",
      "value": "executive-summary"
    },
    {
      "name": "dataOwner",
      "value": "finance-team"
    }
  ]
}
```

**Common page-level annotations:**

| Name | Purpose | Example Value |
|------|---------|---------------|
| `section` | Group pages by business area | `"executive-summary"`, `"detail"` |
| `dataOwner` | Team responsible for the data | `"finance-team"` |
| `refreshCadence` | Expected data refresh frequency | `"daily"`, `"hourly"` |
| `status` | Development status | `"draft"`, `"reviewed"`, `"approved"` |


## Visual-Level Annotations

**File:** `definition/pages/[PageName]/visuals/[VisualName]/visual.json`

Add the `annotations` array at the top level of the visual object:

```json
{
  "$schema": "https://developer.microsoft.com/json-schemas/fabric/item/report/definition/visualContainer/2.7.0/schema.json",
  "name": "revenue_kpi_card",
  "position": { "x": 0, "y": 0, "z": 1000, "width": 300, "height": 200, "tabOrder": 0 },
  "visual": {
    "visualType": "card",
    "query": { ... },
    "objects": { ... }
  },
  "annotations": [
    {
      "name": "businessMetric",
      "value": "total-revenue"
    },
    {
      "name": "verifiedAnswer",
      "value": "What is total revenue?"
    }
  ]
}
```

**Common visual-level annotations:**

| Name | Purpose | Example Value |
|------|---------|---------------|
| `businessMetric` | Stable identifier for the metric shown | `"total-revenue"` |
| `verifiedAnswer` | Copilot verified answer trigger phrase | `"What is total revenue?"` |
| `dataSource` | Source table or measure for traceability | `"Sales.Total Revenue"` |
| `designNote` | Author notes for future maintainers | `"Sparkline added per Q3 review"` |


## Rules and Best Practices

- **Names must be unique** within a single object's annotation array. Duplicate names cause undefined behavior.
- **Values are always strings.** Store JSON as an escaped string if structured data is needed:
  ```json
  {
    "name": "config",
    "value": "{\"threshold\": 0.95, \"color\": \"#4CAF50\"}"
  }
  ```
- **PBI Desktop preserves annotations.** Annotations added externally survive PBI Desktop save cycles -- they are not stripped on open/save.
- **Naming conventions:** Use lowercase with camelCase or kebab-case. Avoid `PBI_` prefixed names -- these are reserved for internal Power BI use (e.g., `PBI_ProTooling`).
- **Keep values concise.** Annotations are stored in every copy of the report metadata. Large values inflate file size.
- **Annotations are not secret.** Anyone with access to the report files can read them. Do not store credentials or sensitive data.


## Reading Annotations

### With jq

```bash
# Report-level annotations
jq '.annotations' definition/report.json

# All page annotations
jq '.annotations' definition/pages/*/page.json

# All visual annotations across all pages
jq '.annotations // empty' definition/pages/*/visuals/*/visual.json

# Find visuals with a specific annotation
jq 'select(.annotations[]?.name == "businessMetric") | .name' definition/pages/*/visuals/*/visual.json
```

### With grep

```bash
# Find all files with annotations
grep -rl '"annotations"' definition/

# Find a specific annotation key
grep -r '"name": "defaultPage"' definition/ --include="*.json"
```
