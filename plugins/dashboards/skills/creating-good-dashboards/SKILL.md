---
name: creating-good-dashboards
description: >
  Design and revise Claude Dashboards that people trust and can read at a glance, and handle the comments people
  leave on them. Use this skill whenever you create, restyle or change a dashboard, answer or act on a dashboard
  comment (including @Claude mentions in a comment thread), or the user asks for a dashboard to look better,
  cleaner or more professional. Covers comment etiquette (never resolve comments yourself, reply in short
  bullets), visual style following Stephen Few and Edward Tufte, Shneiderman's overview-zoom-details layout,
  actionable "do next" guidance, and avoiding generic AI-generated design.
---

# Creating good dashboards

A dashboard is read in seconds and shared with people who did not build it. Two things decide whether it
works: the people commenting on it stay in control of the conversation, and every pixel helps someone see the
answer.

## Comments

Comments are how people review a dashboard together. The person who raised a comment decides when it is done.

- **Never resolve a comment yourself**, even after you made the change it asked for, and even where other
  instructions (such as the Dashboard type's own) say to reply and resolve. Reply, and leave it open for its
  author to check and resolve. A thread you resolve disappears from their view before they have seen whether
  the change is right
- **Reply in a few short bullets**: what you changed, where, and anything you could not do. No preamble, no
  restating the request, no sign-off
- **Ask in the thread** when a comment is ambiguous, instead of guessing and rewriting the dashboard
- **One change per comment**: do what the comment asks; propose other improvements in a reply rather than
  slipping them in

```text
- Added a dotted grey line for August 2021 to the monthly chart
- Same-days comparison now matches the KPI card (Jan 1 to Aug 19)
- Could not split by region: the model has no region on order lines
```

## Visual style

Follow Stephen Few (dashboards for monitoring at a glance) and Edward Tufte (maximise the data, minimise
everything else).

```yaml
one screen:      the whole answer fits one view without scrolling; a headline sentence states it
hierarchy:       most important number top left; KPIs first, then trends, then breakdowns, then detail
kpis:            each KPI shows its value, a target and a trend (sparkline), and says the period and unit
data-ink:        no 3D, no shadows, no gradients, no heavy borders or boxes; light gridlines or none
colour:          greys for context, one accent colour for what needs attention; red and green only for status,
                 and never as the only signal (colour blindness)
labels:          label lines and bars directly; drop legends where a direct label works
charts:          bars and lines over pies, gauges and donuts; bullet graphs over gauges for value against target;
                 sorted bars for rankings; small multiples over one cluttered chart; a calendar heatmap for a
                 daily measure over a year. Exception: when the user's existing reports or apps already use a
                 gauge or dial for this metric, reuse that exact visual so the two stay recognisable
scales:          bar axes start at zero; same scale across small multiples; no dual axes
numbers:         round to what the reader needs (2.3M, not 2,312,947.21); align right; use the model's formats
text:            plain titles that say what the chart shows ("Late penalties by territory, 2025 YTD")
interaction:     every visual crossfilters the others; show active filters and a way to clear them
honesty:         mark partial periods, state missing targets, and say when a number is a dashboard-only
                 calculation rather than a model measure
```

## Overview first, zoom and filter, details on demand

Lay the dashboard out along Ben Shneiderman's information-seeking mantra, top to bottom, so the reader moves
from "how am I doing" to "why" to "this one case" without leaving the page.

```yaml
overview:   the headline, the KPI row and one picture of the whole history (a year heatmap or a long trend);
            every mark the reader may want to inspect is visible here at rest
zoom:       a small set of period chips (7, 30, 90, 365 periods, or the business's own grain) that re-query every
            KPI and dim what falls outside the window in the overview, instead of a date picker
filter:     clicking a mark (a bar, a heatmap cell, a row) filters or selects; the active filter is shown in one
            place with a way to clear it
details:    a detail panel or tooltip shows the selected item's own values next to the typical value for the
            current window ("8h 16m, +1h 17m vs median"); nothing important lives only in a tooltip
```

## Actionability

A dashboard earns its place when the reader knows what to do next. Monitoring alone is not enough.

- Give it a "do next" block: two or three ranked actions, each with the expected effect and the evidence behind
  it ("Orders shipped within 2 days: +18% repeat rate, 340 customers"). Rank by the size of the effect in the data
- Derive actions from drivers the data shows: compare the KPI across a lever the reader controls (time of day,
  day of week, channel, account) and state the difference; never give generic advice the data does not support
- Show the sample size behind every driver, and say when it is a dashboard-only calculation
- Status words and colours ("on track", "short") need a stated target from the model or the user; without one,
  compare to a prior period and say so
- Put the action next to the KPI it moves, not in a separate notes section

## Avoid AI-generated design

Generated dashboards drift to a few recognisable looks. Do not use them unless the user asks for them:

```yaml
palettes:   warm cream with a serif display and a terracotta accent; near-black with one acid-green or
            vermilion pop; purple-to-blue gradient heroes
layout:     everything centred; broadsheet hairline rules with dense columns; numbered 01/02/03 markers on
            content that is not a sequence; big-number tiles that are not the point of the page
components: rounded-lg and the same shadow on every block; an accent bar down the side of rounded cards;
            emoji as section markers or icons
type:       Inter or Space Grotesk picked as the safe default
copy:       subtitles, taglines, eyebrows and helper text that repeat the title; every word must help the
            reader act
```

What to do instead:

- **The user's direction wins**, including when they ask for one of these looks
- **Reuse the user's existing visual system first**: their other dashboards, apps, themes or design tokens,
  down to the exact colours, fonts and chart components. A dashboard that matches what they already use reads
  as theirs; a fresh template reads as generated
- **Otherwise derive the look from the subject**: its units, scales and conventions (durations and times of day
  for scheduling, fiscal periods for finance), with deliberately chosen neutrals and one accent
- **Design both light and dark** from one token set unless the user commits to one; check contrast in both
- **Style every native control** (selects, scrollbars, focus rings, buttons) to match; browser defaults look
  unfinished

Before sharing, look at the dashboard as its reader would: can they say in five seconds whether things are on
track, what to do next, and where to look for detail? If not, remove something before adding anything.
