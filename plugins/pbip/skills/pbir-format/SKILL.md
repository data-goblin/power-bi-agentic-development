---
name: pbir-format
description: Read-only reference for the PBIR report format (visual.json, page.json, report.json, themes, filters, bookmarks, report extensions). Use to understand or diagnose PBIR files, schema versions, expression literals, ComparisonKind and filter enums, or why a page or visual does not show in Desktop. All changes go through pbir, never by editing the JSON.
---

# PBIR format

Learn: [PBIR report folder](https://learn.microsoft.com/en-us/power-bi/developer/projects/projects-report). Schemas: [microsoft/json-schemas](https://github.com/microsoft/json-schemas/tree/main/fabric/item/report/definition).

## Rules

- Change a report only through `pbir` (pbir-cli skill). Do not hand-edit, text-replace or script writes to PBIR JSON. If `pbir` has no command for a change, say so instead of writing raw JSON
- Discover instead of remembering: `pbir schema describe <visual type> [object]` lists objects, properties and allowed values; `pbir schema roles <type>` the data roles; `pbir cat` prints a file. Enum codes and property lists in a skill go stale; the schema does not
- Real, Desktop-written visual.json files for every common visual type are in `examples/visuals/` (index: `examples/visuals/__index.md`), and a whole report in `examples/K201-MonthSlicer.Report`. Copy a property's shape from there
- PBIR is the default and generally available format. `report.json` at the report root (and `mobileState.json`) is PBIR-Legacy: Desktop converts it when it saves; do not convert by script
- Valid JSON is not rendering JSON. A visual can pass `pbir validate` and still show nothing (field missing in the model, container too small, query timeout). Check rendering in Desktop or the service, or ask
- Names: page, visual and bookmark folder names and `name` values are letters, digits, underscore or hyphen, at most 50 characters. Anything else is silently ignored by Desktop (see the pbip skill)
- `$schema` URLs: keep one report's schemas as a matched set; versions move together ([schema map](../../wiki/pbir-schema-map.md)). Do not upgrade one file by hand

## Surprises worth knowing

- Every property value is `{"expr": {...}}`. A `Literal.Value` is a string that carries its type: `"'text'"`, `"50D"`, `"8L"`, `"true"`, `"null"`, `"'#1971c2'"`. The D versus L suffix is property specific, so copy it from a real file ([literals](../../wiki/pbir-expression-values.md))
- `objects` formats a visual's content; `visualContainerObjects` formats the container (title, background, border, tooltip, altText). Unknown names in `visualContainerObjects` are ignored without an error; `pbir validate --semantic` checks them
- Formatting cascade, weakest to strongest: defaults, theme wildcards, theme visual-type entries, `visual.json` ([cascade](../../wiki/pbir-theme-cascade.md)). Put shared formatting in the theme
- `pages.json`: `pageOrder` entries without a page are ignored; `landingPageName` beats `activePageName`
- `definition.pbir` is `byPath` (local model folder) or `byConnection` (Fabric-hosted model only); see [entry files](../../wiki/pbip-entry-files.md)
- Phone layout is per visual in `mobile.json` under PBIR; `mobileState.json` is Legacy only
- Extension measures and visual calculations live in `reportExtensions.json` (schema `reportExtension` 1.0.0); a report-level measure is not in the model, so `te` will not see it

## Layout

```dirtree
Report.Report/
  definition.pbir               model binding
  definition/
    version.json, report.json, reportExtensions.json
    pages/pages.json, pages/<name>/page.json, pages/<name>/visuals/<name>/visual.json (+ mobile.json)
    bookmarks/bookmarks.json, bookmarks/<id>.bookmark.json
  StaticResources/RegisteredResources/   custom themes and images
  StaticResources/SharedResources/BaseThemes/
```

## Validate

```bash
pbir validate <Name>.Report --fields --strict
pbir validate <Name>.Report --semantic
```

The pbip hooks run `pbir validate` after each edit when `pbir` is installed and block on errors in the edited file. Design review (layout, colour, accessibility) is the `pbi-report-design` skill.

## Wiki

- [Schema map and limits](../../wiki/pbir-schema-map.md)
- [Literals and enum codes](../../wiki/pbir-expression-values.md)
- [Filters](../../wiki/pbir-filters.md)
- [page.json](../../wiki/pbir-page-json.md)
- [Theme cascade](../../wiki/pbir-theme-cascade.md)
