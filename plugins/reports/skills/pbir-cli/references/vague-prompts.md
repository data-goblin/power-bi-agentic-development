# Handling Vague or Underspecified Prompts

Users naturally describe reports in vague, subjective terms; "make me a nice dashboard" or "create something with KPIs and charts." This is expected. Natural language is how people think about dataviz, and the gap between intent and specification is the whole reason agents are useful.

But vague prompts produce generic reports. A dashboard built from "make it look good" will look like every other default Power BI report; it won't answer the questions the user actually cares about or reflect the decisions they need to make. The agent's job is to close that gap before building anything.

## When to use this reference

Route here when the user's prompt lacks **two or more** of:

- Specific measures or KPIs to show
- A target audience or decision context ("for the CFO", "for weekly ops review")
- Structural preferences (page count, visual types, layout)
- Formatting direction (colors, style, brand)

Prompts like "create a sales dashboard", "build me a report with some KPIs", or "make a fancy executive dashboard" all qualify.

## What to do

### 1. Acknowledge and reframe

Do not lecture the user or refuse to work. Instead, explain briefly that a few specifics will dramatically improve the result, then ask targeted questions. Frame it as collaboration, not gatekeeping.

Example:

> "I can build this; a few details will make it much better. What decisions should this report help someone make? And which 2-3 numbers matter most?"

### 2. Ask the minimum viable questions

Do not overwhelm with a long questionnaire. Three questions are enough to start:

1. **What decisions does this report support?** This reveals the audience, the KPIs that matter, and the appropriate level of detail. "Weekly ops review" implies trend lines and variance; "board presentation" implies summary KPIs and minimal detail.
2. **Which 2-3 measures matter most?** If the user can't name them, explore the semantic model together with `pbir model "Report.Report" -d` and propose candidates.
3. **Any style or brand preferences?** Colors, fonts, existing reports to match. If none, state that the sqlbi theme will be applied as a professional default.

If the user still deflects ("just make it look good"), proceed with sensible defaults (below) but flag that the result is a starting point to iterate on; not a finished product.

### 3. Apply sensible defaults

When specifics are missing, fall back to these rather than guessing:

| Decision | Default | Rationale |
|----------|---------|-----------|
| Theme | Check if a theme is applied; if not, apply the **sqlbi** theme | Professional colors and typography out of the box |
| Layout | Executive dashboard pattern (KPI row, trend chart, breakdown, detail table) | Most broadly useful; follows 3-30-300 |
| Page size | 1280x720 | Standard 16:9 |
| KPI selection | Top measures by business importance from the model | Explore with `pbir model -d`; propose before building |
| Time granularity | Monthly if yearly filter context; weekly/daily if monthly | Match the grain to the decision cadence |
| Conditional formatting | Gap/variance columns only; theme sentiment colors ("good"/"bad") | Formatting everything means formatting nothing |

### 4. Propose before building

Always present a concrete proposal via `AskUserQuestion` before executing. The proposal should be specific enough that the user can say "yes" or "change X." Include:

- Which KPI cards and what measures they display
- What chart types and what dimensions they break down
- What detail table or matrix columns to include
- How filters should scope the data
- The theme and color approach

Revising a plan is cheap; rebuilding visuals is expensive.

## What not to do

- Do not refuse to work because the prompt is vague
- Do not generate a 10-question interview; three targeted questions are enough
- Do not build a generic report and call it done; iterate toward specifics
- Do not assume the user's reluctance means they don't care; they likely care but don't know how to articulate it in report-design terms
