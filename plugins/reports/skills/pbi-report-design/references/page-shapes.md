# Page Shapes by Intent

Route every page to exactly one **shape**, chosen by the question the page answers, not by a generic dashboard mold. A page is a unit of intent: it exists to answer one question for one reader. Naming the question first decides what belongs, what stays off, and how the page is laid out.

Shapes sit above the per-visual guidance in `references/chart-selection.md`: the shape decides what goes on the page, then chart selection decides how each value is drawn. Each shape reuses the detail-gradient and spacing-tier vocabulary in `references/layout-guidelines.md` rather than inventing new layout rules.

**Rule: one shape per page.** A page trying to answer two questions is two pages. If a page reads as both a summary and an exploration surface, split it.

## The five shapes

### summary

```yaml
question: where do we stand right now?
belongs:
  - a few framed KPIs top-left, each with a target and a trend
  - one supporting chart for context
keep off:
  - raw detail tables; drill belongs on its own page or a drillthrough
  - slicer walls; a summary states the position, it does not invite slicing
layout lean: high end of the detail gradient; KPI row in the top band, one chart below
```

### monitoring

```yaml
question: what needs attention today?
belongs:
  - status-first, exception-driven encoding (RAG / threshold)
  - a triage table sorted by severity, not by name
  - sparse cards for the few headline counts
keep off:
  - full history; monitoring is about now and what breached
  - decorative trend charts that bury the exceptions
layout lean: status signals top, triage table filling the lower band; sort by severity descending
```

### exploration

```yaml
question: let me slice this myself
belongs:
  - slicers and filters forward, placed by the signature's nav convention
  - a primary chart that responds to selection
  - room to breathe; fewer pre-baked conclusions
keep off:
  - asserted callouts; the reader draws the conclusion here, not the author
  - a crowded KPI row competing with the interactive area
layout lean: filter rail per the signature, large responsive chart as the focal area
```

### comparison

```yaml
question: how does A differ from B?
belongs:
  - paired or small-multiple layout with shared, synchronized axes
  - variance made explicit (a delta column, a difference series)
  - side-by-side placement, not stacked
keep off:
  - independent scales per panel; that hides the difference being compared
  - unrelated context that dilutes the A-vs-B focus
layout lean: equal-weight panels across one band; axes synchronized so length carries the comparison
```

### narrative

```yaml
question: here is the finding, and why
belongs:
  - one dominant focal visual
  - annotation forward; callouts and reference lines explain the point
  - subordinate supporting context around the focal visual
keep off:
  - co-equal visuals fighting for the focal role; a narrative has one lead
  - dense detail that competes with the story
layout lean: one large focal visual, smaller supporting visuals subordinate to it; editorial-tone-friendly
```

## Routing and tone

Tone (see `references/design-identity.md`) and shape reinforce each other but are independent decisions. A restrained tone leans toward summary and monitoring; an editorial tone leans toward narrative and comparison; a technical tone leans toward exploration and comparison. The lean is a prior, not a rule: a technical report can still have a summary page. Assign the shape by the page's question first, then let tone set its look.

## Pitfalls

- A page with no nameable question; if you cannot state the one question it answers, it has no shape and probably should not exist
- Two shapes on one page (a summary KPI band stapled to an exploration surface); split it
- Choosing a shape by what visuals are handy rather than by the reader's question; intent leads, inventory follows
- A monitoring page sorted alphabetically; severity ordering is the whole point of the shape
