---
title: page.json type, pageBinding and display options
summary: Page type enum (Drillthrough or Tooltip), pageBinding shape, display options and a validated tooltip page
kind: schema
status: current
sources:
  - url: https://github.com/microsoft/json-schemas/blob/main/fabric/item/report/definition/page/2.1.0/schema.json
  - url: https://learn.microsoft.com/en-us/power-bi/developer/projects/projects-report
tools:
  pbir: 0.9.33
last_updated: 2026-11-23
last_verified: 2026-11-23
review_cadence_days: 60
verified_by:
  - pbir validate plugins/pbip/wiki/examples/bikes/Bikes.Report --fields --strict
skills: [pbip/pbir-format]
---

# page.json type, pageBinding and display options

Schema `page/2.1.0`. Required: `$schema`, `name`, `displayName`, `displayOption`.

```yaml
type: Drillthrough | Tooltip, and nothing else; omit type on a normal page ("Default" is not valid here)
pageBinding: drillthrough and tooltip metadata; name (unique per report) and type (Default | Drillthrough | Tooltip) are required; also referenceScope Default | CrossReport, parameters[], acceptsFilterContext Default | None
displayOption: FitToPage | FitToWidth | ActualSize | DeprecatedDynamic | ActualSizeTopLeft; a 16:9 ratio comes from width and height, not displayOption
visibility: HiddenInViewMode hides a tooltip or drillthrough page from the tab strip
```

`pageBinding` is not for Q&A parameters, as an older copy of this skill said.

## A tooltip page

[RevenueTooltip/page.json](examples/bikes/Bikes.Report/definition/pages/RevenueTooltip/page.json) passes `pbir validate --fields --strict`. Create one with `pbir pages set-tooltip` rather than by hand; it also sets the binding. A visual shows the tooltip page when its `visualContainerObjects.visualTooltip` has `show` true, `type` `'ReportPage'` and `section` set to the tooltip page's `name`.

## Names and order

`pages/pages.json` (`pagesMetadata/1.1.0`): `pageOrder` entries with no page are ignored; pages missing from it are appended in display-name order; `activePageName` that does not exist is a non-blocking error Desktop repairs; `landingPageName` makes every user open on that page and wins over `activePageName`.
