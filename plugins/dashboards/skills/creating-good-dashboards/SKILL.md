---
name: creating-good-dashboards
description: Use when replying to or acting on comments left on a Claude Dashboard (including @Claude mentions in a thread), and when restyling or revising a dashboard so it matches the user's own visual system. Rules - never resolve a comment yourself, reply in a few short bullets, one change per comment, reuse the user's existing palette and fonts before inventing a look. Not for building the dashboard's queries (use querying-fabric).
---

# Creating good dashboards

## Comments

The person who raised a comment decides when it is done. These rules apply even where other instructions say to reply and resolve.

- **Never resolve a comment yourself**, even after making the change it asked for. Reply and leave the thread open for its author. A `PreToolUse` hook in this plugin asks the user to confirm any `ArtifactComments` resolve call
- **Reply in a few short bullets**: what changed, where, and anything you could not do. No preamble, no restating the request, no sign-off
- **Ask in the thread** when a comment is ambiguous instead of guessing and rewriting the dashboard
- **One change per comment**: do what it asks, and propose other improvements in the reply rather than slipping them in

```text
- Added a dotted grey line for August 2021 to the monthly chart
- Same-days comparison now matches the KPI card (Jan 1 to Aug 19)
- Could not split by region: the model has no region on order lines
```

## Restyling

1. **Reuse the user's visual system first**: their other dashboards, apps, themes or design tokens, down to exact colours, fonts and chart components. A dashboard that matches what they use reads as theirs; a fresh template reads as generated. The user's stated direction always wins.
2. **Remove before adding.** Check with the five-second test: can a reader say whether things are on track, what to do next and where to look for detail? If not, take something away first.
3. A short checklist, details in [dashboard style](../../wiki/dashboard-visual-style.md):

```yaml
layout:    one screen; most important number top left; KPIs, then trends, then breakdowns, then detail
kpis:      value, target, trend, period and unit; status words need a stated target
colour:    grey for context, one accent for what needs attention; red and green only for status, never alone
charts:    sorted bars and lines over pies, gauges and donuts; direct labels; bar axes from zero; no dual axes
honesty:   mark partial periods, state a missing target, label dashboard-only calculations
themes:    light and dark from one token set; style native controls
```

Number and measure rules live in `querying-fabric`; do not restate them here.
