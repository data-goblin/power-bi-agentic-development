---
title: Accessibility audit of a PBIR report from files
summary: Which accessibility checks run from PBIR files, which need a live report, and the tab-order, SVG and script-visual traps.
kind: recipe
status: current
sources:
  - url: https://learn.microsoft.com/en-us/power-bi/create-reports/desktop-accessibility-creating-reports
tools:
  pbir: 0.9.33
last_updated: 2026-11-23
last_verified: 2026-11-23
review_cadence_days: 90
verified_by:
  - pbir visuals properties --help
  - pbir bpa run --help
skills: [reports/review-report]
---

# Accessibility audit of a PBIR report from files

[Learn: create accessible reports](https://learn.microsoft.com/en-us/power-bi/create-reports/desktop-accessibility-creating-reports) is the checklist. Keep two sets apart: what files prove, and what needs a live report. Never state "passes accessibility" from a file scan.

## Run these first

```bash
pbir bpa run "R.Report" --rule PBIR_NO_ALT_TEXT
pbir validate "R.Report" --qa --contrast-against effective
```

`PBIR_NO_ALT_TEXT` lists data visuals without alt text; QA reports `LOW_TEXT_CONTRAST` and `LOW_FILL_CONTRAST` for static colours below 3:1.

## Geometry and tab order

```bash
pbir visuals properties "R.Report/P.Page/*" -s position --json
pbir visuals properties "R.Report/P.Page/*" -s tabOrder --json
```

- Alignment: sort left x, right edge, top y and bottom edge; clusters of near-but-not-identical values are misalignments. A `visualGroup` child's position is relative to the group, so resolve group offsets first. Shapes, decorative images, text boxes and buttons join the grid check but not density counts
- Spatial reading order and `tabOrder` (keyboard and screen-reader order) are independent; Power BI derives neither from the other. Rank visuals by `(row band, x)` and flag where `tabOrder` rank diverges
- A negative `tabOrder` removes an item from the tab sequence: right for decorative items (WCAG 1.3.2), a defect on a meaningful visual (unreachable by keyboard). All-zero `tabOrder` means the order was never set. `position.z` is stacking, unrelated to tab order

## Static pass

- Alt text: `general.altText` non-empty on every data visual (`pbir visuals format "P.Page/*" -p general.altText`)
- Colour-only encoding (WCAG 1.4.1): a series or conditional colour with no label, icon or marker shape
- Contrast: 4.5:1 for text, 3:1 for large text and UI components (WCAG 2.1 AA)
- Tag findings with the success criterion: 1.1.1 alt text, 1.3.2 and 2.4.3 order, 1.4.1 colour, 2.1.1 keyboard

## SVG measures

Find them by searching extension measures for `image/svg+xml`. Also check:

- the host visual has alt text and the SVG's numbers appear in an adjacent readable column
- the SVG is not colour-only (a fill or stroke change with no shape or glyph)
- no aggregation is recomputed inside the string builder, and matrix SVGs have a `HASONEVALUE` or `ISINSCOPE` total guard

## Script visuals

R and Python visuals retire in May 2027 ([Learn](https://learn.microsoft.com/en-us/power-bi/connect-data/service-python-packages-support)): the finding is "replace", not "improve". Until then they are a static image with no data-table fallback, they do not render in publish to web or app-owns-data embedding, and "show visuals as tables" skips them. Find them with `pbir ls "R.Report" --all visuals --json` and filter `pythonVisual` and `scriptVisual`; treat an unreviewed third-party script as a security finding.

## Phone readiness

Count `mobile.json` files per page: none on a page meant for phones means rotated landscape; near-all of a page's visuals is the over-faithful miniature. See [phone layout](report-mobile-layout.md).

## Needs a live report

Focus traversal (`Ctrl+F6` between regions), screen-reader readout through "Show data" (`Alt+Shift+F11`) and "Show visuals as tables" (`Ctrl+Shift+F11`; cards, slicers, smart narratives, Q&A, key influencers and paginated visuals are excluded). Screenshots show neither focus nor alt text.
