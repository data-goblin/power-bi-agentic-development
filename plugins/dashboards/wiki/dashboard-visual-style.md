---
title: Dashboard visual style cheat sheet
summary: Few, Tufte and Shneiderman rules applied to a one-screen dashboard, plus the generic looks to avoid and a do-next block.
kind: decision
status: current
sources:
  - url: https://www.edwardtufte.com/book/the-visual-display-of-quantitative-information/
  - url: https://www.perceptualedge.com/articles/Whitepapers/Dashboard_Design.pdf
last_updated: 2026-11-23
last_verified: 2026-11-23
review_cadence_days: 180
skills: [dashboards/creating-good-dashboards]
---

# Dashboard visual style

Sources: Edward Tufte, The Visual Display of Quantitative Information (maximise data ink); Stephen Few, dashboards for monitoring at a glance; Ben Shneiderman's information-seeking mantra (overview first, zoom and filter, details on demand). Quoted rules below are summaries, not quotations.

```yaml
one screen:    the whole answer fits one view; a headline sentence states it
hierarchy:     most important number top left, then trends, breakdowns, detail
data ink:      no 3D, shadows, gradients or heavy borders; light gridlines or none
colour:        grey for context, one accent for attention; red and green only for status
labels:        label lines and bars directly; drop legends where a direct label works
charts:        bars and lines over pies, gauges and donuts; bullet graphs for value against target; small multiples over one cluttered chart. Reuse a gauge only when the user's other reports already use it
scales:        bar axes start at zero; same scale across small multiples; no dual axes
numbers:       round to what the reader needs; right-align; use the model's formats
titles:        say what the chart shows ("Late penalties by territory, 2025 YTD")
```

## Overview, zoom, details

```yaml
overview: headline, KPI row and one picture of the whole history; every inspectable mark visible at rest
zoom:     period chips (7, 30, 90, 365 or the business's grain) that re-query every KPI and dim what falls outside the window
filter:   clicking a mark filters; the active filter is shown once with a way to clear it
details:  a panel or tooltip shows the selected item next to the typical value; nothing important lives only in a tooltip
```

## Do-next block

Give two or three ranked actions, each with the expected effect, the evidence and the sample size ("Orders shipped within 2 days: +18% repeat rate, 340 customers"). Derive them from a lever the reader controls (time of day, channel, account) and never state advice the data does not support. Put the action next to the KPI it moves.

## Generic looks to avoid unless asked

Warm cream with a serif display and terracotta accent; near-black with one acid-green or vermilion pop; purple-to-blue gradient heroes; everything centred; numbered 01/02/03 markers on content that is not a sequence; the same rounded corner and shadow on every block; accent bars on cards; emoji as icons; taglines that repeat the title.
