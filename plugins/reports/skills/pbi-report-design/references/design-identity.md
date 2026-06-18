# Design Identity

Before any layout work, lock two decisions that propagate to every page and every visual: a **tone** and a **signature**. Recording them once turns vague asks like "use muted colors" into a concrete decision the rest of the report has to obey. A report without a locked identity drifts into N independently styled pages that happen to share a file.

Lock these first, then make every later formatting choice cite them rather than picking per visual.

- If the brief does not name a tone or signature, infer them from the audience and purpose, state the pick, and confirm with the user before locking; this is the same "ask when it is not given" stance the KPI guidance takes for targets.
- Record the locked identity where later work will read it: the design brief (the `create-pbi-report` skill) when one exists, otherwise a note in the scratchpad and a comment in the theme. Identity that lives only in one agent's head does not survive a fresh context or a second page.
- Every later page inherits the locked identity. Do not re-decide tone or signature per page; re-deciding is the drift the design gate exists to catch.

## Tone: the ink budget

Pick exactly one tone. Tone is a budget commitment, not a mood word; it fixes how much ink the report spends, how saturated accents get, how many accent colors are in play, and how aggressively pages are annotated. It draws on the spirit of established practice: Few on data:ink, IBCS on disciplined standards, the FT Visual Vocabulary on explanatory framing.

```yaml
restrained:
  for: execs who want the number, not the chrome
  ink: low; generous whitespace; near-monochrome
  accents: one hue, low saturation; everything else neutral grey
  annotation: minimal; let the headline number carry the page
  leans toward: summary and monitoring shapes

corporate:
  for: recurring standard reporting, brand-disciplined audiences
  ink: predictable; consistent conventions across pages
  accents: brand palette, applied to encode (variance, standards), not decorate
  annotation: convention-driven (IBCS-style variance/sign markers)
  leans toward: comparison and monitoring shapes

editorial:
  for: a finding you are walking someone through
  ink: moderate, concentrated on one focal point per page
  accents: one highlight hue against neutral context
  annotation: forward; labels, callouts, and reference lines explain the point
  leans toward: narrative and comparison shapes

technical:
  for: analysts who want density and want to dig
  ink: high information:ink; tables and small multiples dominate
  accents: sparse; reserved for the one series under inspection
  annotation: terse; precision over framing
  leans toward: exploration and comparison shapes
```

Map the chosen tone to the knobs the skill already controls:

```yaml
accent count:        restrained 1, editorial 1, corporate 2, technical 1-2
gridline weight:     lighter for restrained/editorial; visible for technical tables
label density:       sparse for restrained; forward for editorial; terse-dense for technical
accent saturation:   low for restrained; mid for editorial/corporate; reserved for technical
```

## Signature: the recurring element

Pick one signature (two at most). A signature is a single element repeated identically on every page so the report reads as one designed artifact. It is the thing that makes "use muted colors" a propagating decision instead of a one-page whim.

```yaml
header band:         title + filter context + refresh stamp, same place every page
single-accent rule:  exactly one hue carries emphasis; everything else neutral grey
fixed nav rail:      left rail or top rail; pick one convention and never alternate
kpi silhouette:      one card shape, size, and label arrangement reused for every KPI
callout style:       one annotation treatment (same font, weight, leader-line style)
target-line rule:    targets always rendered the same way (e.g. dashed grey reference line)
```

The signature is a contract: once chosen, every page honors it. A header band on three pages and absent on the fourth is a broken signature, and the design gate will flag it.

## Serialize the identity into the theme

The identity belongs in the theme, not in per-visual overrides. A tone expressed as fifty inline hex values is not propagated; it is duplicated, and it will not survive a re-theme. Route execution through the **`modifying-theme-json`** skill:

- the single-accent rule becomes the theme's `dataColors` ordering (accent first, neutrals after) so emphasis is one decision
- gridline weight, label density, and accent saturation become theme wildcards (`visualStyles["*"]["*"]`) or visual-type overrides, not per-visual edits
- semantic sentiment colors (`good` / `bad` / `neutral`) live in the theme so callouts and CF cite tokens, never literals

When a later choice needs a color or a formatting value, it cites the locked identity ("accent hue per the single-accent rule") and reads it from the theme. If a choice cannot cite the identity, the identity is incomplete; fix the identity, not the visual.

## Route each page to a shape

Tone and signature set the look; **page shapes** set the structure. After locking identity, route every page to exactly one shape by the question it answers. See `references/page-shapes.md`. Shapes sit above the per-visual chart-selection guidance; they decide what belongs on a page before chart selection decides how each value is drawn.

## Pitfalls

- Picking a tone word ("clean", "modern") that maps to no knob; if it does not change accent count, ink, or annotation, it is decoration, not a tone
- More than one signature competing for attention; one designed element repeated beats three half-applied ones
- Declaring an identity then choosing colors per visual anyway; the citation rule exists precisely to catch this
- Saturation creep: a "restrained" tone whose accents brighten page by page has lost the budget
