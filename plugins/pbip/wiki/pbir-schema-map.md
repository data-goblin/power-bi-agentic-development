---
title: PBIR schema versions and which schema embeds which
summary: Current PBIR schema versions from microsoft/json-schemas, the schema coupling rule, URL shapes and Learn's PBIR limits
kind: schema
status: current
sources:
  - url: https://github.com/microsoft/json-schemas/tree/main/fabric/item/report/definition
  - url: https://learn.microsoft.com/en-us/power-bi/developer/projects/projects-report
tools:
  pbir: 0.9.33
last_updated: 2026-11-23
last_verified: 2026-11-23
review_cadence_days: 30
verified_by:
  - pbir validate plugins/pbip/wiki/examples/bikes/Bikes.Report --strict
skills: [pbip/pbir-format]
---

# PBIR schema versions and which schema embeds which

Latest versions in [microsoft/json-schemas](https://github.com/microsoft/json-schemas/tree/main/fabric/item/report/definition) on 2026-11-23. Microsoft ships new versions roughly monthly; list what exists with `gh api repos/microsoft/json-schemas/contents/fabric/item/report/definition/<type> --jq '.[].name'`.

```yaml
visualContainer: 2.13.0     visual.json
page: 2.1.0                 page.json
report: 3.3.0               report.json
bookmark: 2.1.0             <id>.bookmark.json
pagesMetadata: 1.1.0        pages.json
bookmarksMetadata: 1.0.0    bookmarks.json
versionMetadata: 1.0.0      version.json
reportExtension: 1.0.0      reportExtensions.json
visualContainerMobileState: 2.8.0   mobile.json (visualConfiguration 2.8.0 for the visual part)
definitionProperties: 2.0.0 definition.pbir (under item/report/, not item/report/definition/)
platformProperties: 2.1.0   .platform (under fabric/gitIntegration/)
```

URL shapes: `https://developer.microsoft.com/json-schemas/fabric/item/report/definition/<type>/<version>/schema.json` for everything in `definition/`, `.../fabric/item/report/<type>/<version>/schema.json` for `definition.pbir`.

## Schemas move as a set

`report` 3.3.0 embeds `filterConfiguration` 1.3.0 and `formattingObjectDefinitions` 1.5.0. `page` 2.1.0 embeds those two plus `semanticQuery` 1.4.0. Checked by reading the `$ref` URLs in the schema files. A fragment copied between reports with different parent versions can pass a JSON check and still lose properties at load, so keep one report's `$schema` URLs as a matched set and let `pbir validate --update-schemas` move them together. `reportVersionAtImport` in `themeCollection` records the schema versions when a theme was imported; Desktop manages it, do not edit it.

## Learn limits for PBIR

Per the Learn report-folder page: at most 1,000 pages per report, 1,000 visuals per page and 300 MB of definition files. Names (folder and `name`) are letters, digits, underscore or hyphen, at most 50 characters, in the schema for pages and visuals.

## Find a type or property

```bash
pbir schema describe --help
curl -sL https://developer.microsoft.com/json-schemas/fabric/item/report/definition/semanticQuery/1.4.0/schema.json | jq -r '.definitions.QueryExpressionContainer.properties | keys[]'
```

The real visual.json files under `plugins/pbip/skills/pbir-format/examples/visuals/` show how each visual type fills the schema.
