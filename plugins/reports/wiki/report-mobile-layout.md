---
title: "Phone layout: mobile.json is a curated subset"
summary: How the portrait layout is stored per visual, how to set it with pbir, and why a browser screenshot cannot verify it.
kind: gotcha
status: current
sources:
  - url: https://learn.microsoft.com/en-us/power-bi/create-reports/desktop-create-phone-report
tools:
  pbir: 0.9.33
last_updated: 2026-11-23
last_verified: 2026-11-23
review_cadence_days: 90
verified_by:
  - pbir visuals mobile --help
skills: [reports/pbi-report-design]
---

# Phone layout

[Learn: mobile-optimized reports](https://learn.microsoft.com/en-us/power-bi/create-reports/desktop-create-phone-report). A mobile-optimized view shows only in the Power BI mobile apps for iOS and Android; a web browser always shows the standard view, so a browser or Playwright screenshot cannot verify the portrait layout.

## Storage

The layout is per visual: a `mobile.json` beside `visual.json`, with `$schema` and `position`. A page "has a phone layout" when at least one visual has a `mobile.json`. A page with none falls back to the rotated landscape view. Do not write the file by hand.

```bash
pbir visuals mobile "R.Report/P.Page/V.Visual" --show
pbir visuals mobile "R.Report/P.Page/V.Visual" --x 5 --y 5 --width 90 --height 20 --tab-order 1
pbir visuals mobile "R.Report/P.Page/V.Visual" --remove
```

Mobile coordinates are percentages (0 to 100) of the phone canvas and are independent of the desktop position; `pbir visuals position` sets the desktop one. `pbir rm` on a visual removes its mobile state with it. If a mobile-only formatting operation is not exposed by pbir, report the gap.

## Choosing the subset

- Place the visuals that answer the headline question: the KPI cards, one primary chart, the key slicer; usually four to eight in one column (a working range, not a Microsoft rule)
- Wide tables, scatter charts and dense matrices rarely survive the narrow grid
- Lay slicers and navigation horizontally so they take one short band
- Build the phone layout while building the desktop page; placing every visual produces a page that scrolls forever
- Severity follows intent: a headline KPI page without a phone layout is a real finding, a back-office detail page is not
