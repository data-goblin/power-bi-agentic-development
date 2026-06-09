# Tooltips, Annotations, and Guided Analytics

## Tooltip Page Design

A report-page tooltip is a designed mini-canvas, not a bigger hover list. Three legitimate intents:

- Different perspective: same data pivoted (hover a monthly bar, see the full-year trend)
- Add detail: same grain, attributes the source visual omitted
- Add help: static explainer wired to the visual header icon, not data points

### When not to build one

- One or two extra numbers: use the Tooltip field well, not a report page
- Anything the user must interact with: use drillthrough, not a tooltip

### Design rules

Keep the page small and `ActualSize` (320x240 default; 240x180 for a single chart); design at final pixels since `ActualSize` does not scale. Strip chrome harder than a normal page:

```bash
pbir visuals format "TooltipPage/*" background --show false
```

Titles off, one focal visual plus at most a card or two. One tooltip page can serve many source visuals; reuse rather than clone.

### Pitfalls

- Tooltip pages count toward page/visual budgets even though hidden; consolidate near-duplicates
- A tooltip that restates the data point already visible adds a query per hover for zero insight; delete it
- Do not reach for a tooltip when the need is comparison or navigation; those want drillthrough or a page link
- Never place a page-level `filterConfig` on a tooltip page; the hover is the filter (see `pbir-cli` references for filter-compatibility grain checks)
- "Tooltip size affected by canvas size" autoscale is report-level, not settable per page from PBIR; design for actual pixels and flag for the owner

---

## Annotations and Guided Analytics

Annotation-as-design is the chrome that carries the analytical argument. This describes how to compose existing PBIR primitives into a storytelling layer.

### Building blocks

**Shaded "what happened here" band:** a reference line with `shade*` properties spanning a date range behind the hero series:
```bash
pbir reference-line add "Page/Hero.Visual" --type constant --value "2024-01-01" --shade-to "2024-03-31"
# reference-line adds are not idempotent; capture the returned id
```

**Target line stating the finding:** a reference line bound to a target measure with `dataLabel` on, label driven by the measure ("Plan: 11.0M").

**Highlight-and-grey:** hero series in a brand data color, others grey via per-series selectors (`series(col=val)`) or a measure-driven CF that returns grey for non-hero categories. The measure-driven approach is more robust; per-series selectors break if the series set changes.

**Callout with leader:** a chrome-off textbox (title/background/border/shadow all `show=false`) plus a thin shape as the leader line. Keep callouts as separate visuals so they are independently `cp`-able and themeable.

**Reveal pacing:** prefer a page sequence plus a page navigator over bookmarks for step-by-step story reveals. Bookmarks are fragile and capped; reserve them for in-page state toggles.

**Reading order / scent:** set `tabOrder` so traversal is headline -> hero visual -> callouts -> detail panel.

### Review checklist: flag weak narrative

These are not caught by `pbir bpa`:

- Headline textbox is a chart-type label ("Bar Chart: Revenue") rather than a finding
- Every series at full saturation with no grey context series
- A reference or target line exists but `dataLabel` is off
- Callouts present but `tabOrder` does not follow the story
- Story carried entirely by a Copilot Narrative visual with no deterministic fallback

### Pitfalls

- Reference-line and error-bar adds are not idempotent; always capture the returned id and use it for subsequent edits
- A wall of callouts harms accessibility; decorative chrome is budget-exempt but a screen reader still walks the `tabOrder` sequence
