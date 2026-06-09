# Mobile Layout: Phone View as a Curated Subset

Power BI does not reflow a desktop page onto a phone. The portrait view is a hand-picked subset re-placed on a fixed narrow portrait grid. A visual appears in portrait only if it has a `mobile.json` alongside its `visual.json`. This inverts the desktop default: on the web every visual renders; on a phone nothing renders until explicitly opted in.

A page with no mobile-placed visuals falls back to rotated landscape, which is usually unreadable on a phone held in portrait.

## Design Principles

Pick the few visuals that answer the headline question for a mobile reader: KPI cards, the one primary chart, the key slicer. Wide tables, scatter charts, and dense matrices rarely survive the narrow portrait grid. Stack vertically with the answer at the top. Lay slicers and navigation buttons horizontally so they consume one short band rather than stacking tall.

**Build the phone layout alongside the desktop page** so a page copy duplicates placements from the start rather than being retrofitted.

## File Mechanics

The phone layout is stored per-visual, not per-page. Each visual folder may hold a `mobile.json` beside its `visual.json` (validated by the `visualContainerMobileState` schema). Required keys are `$schema` and `position`; the `position` block uses the same field names as desktop (`x, y, z, height, width, tabOrder, angle`) but in the phone-canvas coordinate space, which is independent of the desktop canvas.

"The page has a phone layout" is emergent: it is true if at least one visual has a `mobile.json`.

Inspect and set via the CLI:
```bash
pbir visuals mobile "Report.Report/Page.Page/Visual.Visual"
```

When hand-writing a `mobile.json`, copy the `$schema` URL from another `mobile.json` in the same report; a stale schema version is the most common validation failure.

## What to Include and Exclude

Rank visuals by their value for the mobile reader's primary question, then place the top 4-8 in a single column. Record which visuals you intentionally excluded. The over-faithful miniature anti-pattern (placing everything) produces a portrait page that scrolls forever and is harder to read than the rotated landscape fallback.

Strip non-essential chrome for the mobile copy via mobile-only formatting overrides in `mobile.json`: smaller axis titles, drop legends, remove gridlines. These overrides are deltas; list only properties that must differ from the desktop visual. The theme-first cascade still applies: a formatting change that should apply on all surfaces belongs in the theme, not in `mobile.json`.

## Pitfalls

- A page that looks mobile-ready in the editor but has zero `mobile.json` files silently falls back to rotated landscape
- Mobile-optimized views render only in native iOS/Android apps; a browser (Service, Playwright, Chrome) always shows the landscape layout, so you cannot verify the portrait layout by browser screenshot
- Editing `visual.json` position does nothing to the phone layout and vice versa; they are independent coordinate records
- Deleting a visual's folder must also drop its `mobile.json`
- Absence of `mobile.json` is not automatically a defect; tie severity to intent (a headline KPI page with no mobile layout is high severity; a back-of-house detail page is usually fine)
