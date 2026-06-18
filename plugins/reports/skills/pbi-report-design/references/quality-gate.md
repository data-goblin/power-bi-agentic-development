# The Design Gate

Final checks run before declaring a design done. This is a closing gate, not a planning-stage checklist: the planning-stage checks belong to the report-creation workflow and run before the build; the design gate runs after, against the finished artifact, and decides whether it ships.

Run all five checks. Report each finding in the same shape as the Evaluation Output in `SKILL.md`: **issue, location, severity (critical / warning / suggestion), fix.**

## The honesty caveat

An agent cannot see the canvas. It can read positions, types, colors, and bindings from JSON, but it cannot judge whether the rendered page looks balanced or whether a color reads as muted in context. Pair this gate with the screenshot-review loop in the **`pbir-cli`** skill: render the pages, look, and let the visual check confirm what the JSON check inferred. A gate passed on JSON alone is provisional until the screenshots agree.

## 1. Identity propagated

The locked tone and signature actually appear on every page.

- the signature element is in the same place on every page (header band, nav rail, KPI silhouette per `references/design-identity.md`); absent or moved on any page is a broken signature
- accents obey the single-accent rule: one hue carries emphasis, everything else is neutral
- colors live in the theme, not in per-visual overrides; inline hex that should be a token is a finding (see the inline-hex entry in `references/anti-patterns.md`)
- tone is consistent: a "restrained" report has not crept brighter or denser page by page

## 2. Every page has one intent

Each page resolves to exactly one shape from `references/page-shapes.md`.

- every page answers a nameable question; a page with no statable question is a finding
- no page is trying to be two shapes; a summary band stapled to an exploration surface is split into two pages

## 3. Spacing and margins equal

Gaps and margins are uniform and on the grid. Reuse the vocabulary in `references/layout-guidelines.md`; do not re-derive it here.

- every gap between adjacent visuals is the same value; every edge margin is the same value
- positions sit on the grid unit
- vertical gutters are continuous across rows: the column splits in row two line up with row one

## 4. Callouts backed by evidence

Every annotation, highlighted point, and written conclusion is verifiable against the model.

- sample the data with `pbir model -q` and confirm each asserted number, ranking, or trend actually holds
- no callout states a figure the data does not support; an annotation the model contradicts is a critical finding
- a highlighted "top" or "worst" point is the actual extreme, not an assumed one

## 5. Accessibility

- contrast ratios met (text 4.5:1, large text 3:1) per `references/visual-colors.md`
- color is never the only signal; status and sentiment pair with an icon, shape, or label
- fonts are readable at the rendered page size
- alt text is present on data visuals

## Output

```yaml
issue:    <what is wrong>
location: <page / visual>
severity: critical | warning | suggestion
fix:      <command or pattern>
```

Critical findings (identity not propagated, a page with two intents, a callout the data contradicts, a contrast failure) block "done". Warnings and suggestions are reported and can ship with the user's acknowledgement.
