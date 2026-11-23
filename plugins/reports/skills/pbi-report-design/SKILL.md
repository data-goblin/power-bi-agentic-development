---
name: pbi-report-design
description: Use for Power BI report design judgement before laying out, formatting or reviewing a report, including committing a design identity (tone and signature), routing each page to one intent, layout and spacing, colour and theme discipline, KPI and table design, filter pane, tooltips, phone layout, accessibility and which visual to pick. Load alongside create-pbi-report, pbir-cli, review-report or modifying-theme-json. Not for pbir command syntax and not for building custom visuals.
---

# Power BI report design

Judgement only; every report change goes through `pbir` (see `pbir-cli`). When a request contradicts these rules, say so, explain the better option and let the user decide. Aim for simplicity and answering a specific question, not looking impressive.

## Rules

1. **Commit an identity before layout**: one tone (restrained, corporate, editorial or technical) and one signature element repeated identically on every page ([design identity](references/design-identity.md)). If the brief names neither, infer from audience and purpose, state the pick and confirm it. Serialise it into the theme with `modifying-theme-json`, never into per-visual overrides.
2. **One intent per page**: summary, monitoring, exploration, comparison or narrative ([page shapes](references/page-shapes.md)). A page that answers two questions is two pages.
3. **Detail gradient**: the least detailed, most important content top-left (KPIs), the most detailed bottom-right (tables). Every page has a title (`pbir add title`); the page title names the subject, visual titles the differentiator.
4. **Equal gaps and equal margins.** Compute positions from page width and height, margin and gap; read the page size first (`pbir get "R.Report/P.Page.width"`; new pages are 1280x720). `pbir validate --qa` and `pbir bpa run` report overlap, off-canvas and undersized visuals, so do not eyeball them.
5. **Theme, not overrides.** Colours come from the theme (`PBIR_HARDCODED_COLORS` finds literals), fonts stay on portable Segoe UI faces, and static formatting that applies to a visual type goes in the theme. Muted colours steer attention; colour that carries meaning (red bad, green good) only for that meaning, with a colour-blind-safe pair and a second cue (icon, label).
6. **A KPI answers two questions**: is it good (a target and the gap, absolute and percentage) and is it improving (a trend). No target available means ask the user, not a bare number. Format the gap, not the value. Prefer `kpi` when a target exists ([KPI and cards](../../wiki/report-kpi-cards.md)).
7. **Visual count is not a design rule.** Query cost per visual is what matters, and Learn gives no threshold ([performance audit](../../wiki/report-performance-audit.md)). Keep headline cards few enough to read as a set and slicers few enough that the filter pane can take the rest.
8. **Accessibility**: alt text on data visuals (`PBIR_NO_ALT_TEXT`), contrast 4.5:1 for text and 3:1 for large text and UI components (WCAG 2.1 AA, which `pbir validate --qa` checks for static colours), never colour alone, minimal drop shadows. Checklist: [Learn](https://learn.microsoft.com/en-us/power-bi/create-reports/desktop-accessibility-creating-reports); file checks: [accessibility audit](../../wiki/report-accessibility-audit.md).
9. **Phone layout is a hand-picked subset** and nothing renders on a phone until `pbir visuals mobile` places it ([phone layout](../../wiki/report-mobile-layout.md)).
10. **R and Python visuals retire in May 2027.** Never recommend or build one; route to a native visual, Deneb or an SVG measure ([custom visual choice](../../wiki/report-custom-visual-choice.md)).
11. **You cannot see the canvas.** Say so, and check rendering with a screenshot ([render verification](../../wiki/pbir-render-verification.md)) before calling a design done.

## Defaults to refuse

These look plausible and defeat the reader; push back, name the better option, offer the repair:

```yaml
gauge as KPI:          use kpi or a card with target, gap and trend
unsorted or one-hue bars: sort by value descending (pbir visuals sort)
card wall:             cut to the numbers that drive a decision
raw field names as titles: state the question the visual answers
inline hex:            theme colours or sentiment tokens
off-grid drift:        snap to the margin and gap
second y-axis for unrelated measures: split into two visuals
3D charts, pies beyond a few slices: flat bar chart, long tail grouped as "Other"
```

## Where the details are

```yaml
KPIs and cards:        wiki report-kpi-cards
tables and matrices:   wiki report-tables-and-matrices
tooltips, annotations: wiki report-tooltips-and-annotations
filter pane:           wiki report-filter-pane
conditional formatting: wiki pbir-conditional-formatting
interactions, slicers: wiki report-interactivity
```

## Closing gate

Before calling a design done, check five things and report each as issue, location, severity (critical, warning, suggestion), fix: the identity appears on every page; every page has one nameable intent; gaps and margins are equal and on the grid; every callout is backed by the model (sample with `pbir model -q`); accessibility is met. A critical finding blocks "done"; a gate passed from JSON alone is provisional until the screenshots agree.

## Related skills

- `pbir-cli`, `create-pbi-report`, `review-report`, `modifying-theme-json`
- `custom-visuals` plugin: `deneb-visuals`, `svg-visuals`
- `pbip` plugin: `pbir-format`, `tmdl`; `tabular-editor` plugin for model changes
