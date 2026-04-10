# Accessibility Audit

File-level checks that can be run from the terminal, plus a short residue pass that requires a live report. Keep the two sets separate; never assert "passes accessibility" from a file scan alone.

## Alignment and Gutter Consistency

A pure-geometry audit from the PBIR position blocks; run before any screenshot.

```bash
pbir visuals properties "Sales.Report/Overview.Page/*" -s position --json
```

Build four sorted lists from the output: left `x`, right `x+width`, top `y`, bottom `y+height`. Any cluster of near-but-not-identical values is a misalignment candidate; snap to the modal value. Compute gutters as gaps between a row's right edges and the next left edge; flag rows where the spread exceeds a couple of pixels. Verify that distinct x-edges on row 1 match row 2 (continuous vertical lines).

Round survivors to the grid unit with `pbir set "<path>.position.x" --value <value>`, then
re-validate.

Notes:
- `basicShape`, decorative `image`/`textbox`, and `actionButton` participate in the grid for alignment checks but should be excluded from visual-density counts
- A `visualGroup` child's `position` is relative to the group, which has its own `position` + `ScaleMode`; resolve group offsets before comparing or you get phantom misalignment
- Geometry alignment is necessary but not sufficient; pair with the tab-order check below

## Tab Order vs Reading Pattern

Spatial reading order (F/Z) and `tabOrder` (keyboard-tab and screen-reader announce sequence) are set independently; Power BI does not derive one from the other. A flawless Z-pattern can still ship a scrambled announced order.

```bash
pbir visuals properties "Sales.Report/Overview.Page/*" -s tabOrder --json
```

Reconstruct intended order from geometry: sort by `(y_band, x)` where `y_band` buckets visuals into rows. Where a visual's `tabOrder` rank diverges from its geometric rank, the announced order fights the layout; flag it.

Key conventions:
- A negative `tabOrder` (e.g. `-1`) removes an item from the tab sequence; Desktop writes this via the Selection pane. A meaningful visual with a negative value becomes unreachable by keyboard; flag unexpected negatives
- Decorative visuals should be removed from the tab sequence (`tabOrder = -1`); a decorative item still in sequence is a 1.3.2 risk
- Zero `tabOrder` set on every visual means the author never made the order intentional; that is a 1.3.2 risk, not a hard failure
- `position.z` (stacking order) is unrelated to `tabOrder`; never use z to fix the reading sequence
- Grouped visuals announce within their group

## Static Accessibility Pass

The following checks produce findings from `visual.json` alone:

- **Missing alt text:** each data visual (exclude `basicShape`, decorative `image`/`textbox`, `actionButton`) must have non-empty `general.altText`; find gaps with `pbir visuals format "MyPage/*" -p general.altText`
- **Decorative items in tab sequence:** any `basicShape`, brand `image`, or divider with `tabOrder >= 0` should be `-1`
- **Tab-order coherence:** dump `(name, visualType, x, y, tabOrder)`; flag where ascending `tabOrder` does not track top-to-bottom, left-to-right
- **Color-only encoding:** a series/CF color with no paired data label, icon, or marker shape (WCAG 1.4.1)
- **Unreachable meaningful visual:** any data visual with a negative `tabOrder`

Tag each finding `[Accessibility]` with its WCAG SC: 1.1.1 alt, 1.3.2/2.4.3 reading/focus, 1.4.1 color-only, 2.1.1 keyboard.

## SVG-Driven Visuals

Detect SVG measures by grepping `reportExtensions.json` expressions for `image/svg+xml`. Three checks not covered by the standard accessibility pass:

- Each table/matrix/card/image whose bound measure returns an svg+xml URI must have non-empty `general.altText` (static or measure-driven) AND the SVG-encoded numbers must also appear as a readable adjacent column. Severity high for primary KPIs, medium for decorative micro-charts
- Flag SVG measures whose only context-varying element is a `fill`/`stroke` color with no accompanying shape, glyph, or text run (color-only encoding inside the SVG)
- Flag SVG measures that recompute base aggregations inside the string-builder (CONCATENATEX over fact rows rather than pre-aggregated values), and matrix value-axis SVGs lacking a `HASONEVALUE`/`ISINSCOPE` total guard (these are both an accessibility concern and a performance one)

The Desktop Bridge screenshot does not confirm accessibility; alt text is invisible in a screenshot.

## Script Visuals (Python/R)

`pythonVisual` and `scriptVisual` have additional accessibility exposure because they render a
static PNG with no data table fallback and no per-cell alt text slot. List all visuals, filter the
JSON result by `visualType`, then inspect each matching visual:

```bash
pbir ls "Report.Report" --all visuals --json
pbir visuals query "Report.Report/Page.Page/Script.Visual" --json
```

For each script visual found:
- Confirm the host visual has non-empty `general.altText`
- Flag the `Publish to web` distribution path: Python/R visuals render empty there; this is a blocking finding for public embeds
- Flag the `app-owns-data` embed path: R/Python visuals do not render in app-owns-data scenarios (not a future risk; broken now)
- Note the "Show visuals as tables" fallback (`Ctrl+Shift+F11`) does not include script visuals; the PNG is the only output

Also audit the script literal:
```bash
pbir get "Report.Report/Page.Page/MyScriptVisual.Visual.script" --json
```
An unreviewed third-party script is a security finding.

## Mobile Readiness

A page can be flawless on web and unusable in portrait. These are entirely file-based signals:

- **Has a phone layout:** count `mobile.json` files under the page's `visuals/`; zero means the page falls back to rotated landscape on phones. Flag consumption-intended pages with none
- **Coverage vs over-stuffing:** ratio of mobile-placed to total visuals; near-zero on a key page is a gap, near-1.0 is the over-faithful-miniature anti-pattern
- **Stale placement:** a `visual.json` edited long after its `mobile.json` (heuristic; flag for manual review)
- **Orphan records:** a `mobile.json` whose sibling `visual.json` is gone (a blocking state; `pbir validate` catches it)
- **Mobile-only override sprawl:** large `objects` blocks in `mobile.json` that duplicate rather than delta desktop formatting

Tie severity to intent: a back-of-house detail page with no phone layout is fine; a headline KPI page visible in an org app is high severity. Mobile-optimized views render only in the native iOS/Android apps; a browser always shows the landscape layout, so you cannot verify portrait by browser screenshot.

## Must-Render Residue

These cannot be confirmed from files; state them as not-file-verifiable:
- Tab/Shift+Tab focus traversal between regions (`Ctrl+F6`)
- Screen-reader readout via "Show data" (`Alt+Shift+F11`) and "Show visuals as tables" (`Ctrl+Shift+F11`)
- `card`/`slicer`/smart-narrative/Q&A/Key-Influencers/paginated are excluded from "Show visuals as tables"; the table fallback does not cover them

Screenshots do not capture focus; the only check for traversal is a live keyboard pass.
