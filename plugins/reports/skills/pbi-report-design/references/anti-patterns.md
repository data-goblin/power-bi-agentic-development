# Anti-Patterns: Defaults to Refuse

These are the choices a model reaches for because they look plausible, not because they are right; attractor states that satisfy the literal request while defeating the reader. This list is cross-cutting and whole-report. It does not replace the per-visual anti-pattern tables in `references/cards-and-kpis.md` and `references/tables-and-matrices.md`; it sits alongside them.

When a user asks for one of these, do not silently comply. Refuse and redirect: name the better option in the skill's voice, explain the cost in one line, and offer the repair. The user can still override; the point is that they choose it knowingly.

Each entry: the attractor, why it loses (tied to a canon principle), and the repair with the `pbir` move where one exists.

## gauge-as-KPI

A gauge spends a large area encoding one value on a curved scale that the eye reads worse than a straight one (Cleveland-McGill: position on a common scale beats angle). Repair: a `kpi` or `card` with a target and an explicit gap. Swap the type and bind the target role; see `references/chart-selection.md` for the value-vs-target routing.

## monochrome categorical bars

One hue across unordered categories spends the color channel and returns nothing; hue carries no information when every bar is the same. Repair: sort by value descending and let bar length do the comparing, then reserve one accent hue for the single bar you want highlighted. This is the single-accent rule from `references/design-identity.md` applied to a bar chart.

```bash
pbir visuals sort "Page/Visual.Visual" -f "<Table.Measure>" -d Descending
```

## missing sort

Categorical bars left in load or alphabetical order defeat the length comparison that is the chart's only reason to exist; the reader cannot rank what is not ranked. Repair: sort by the measure descending unless the axis is genuinely time-ordered. Sorting is discussed further in `references/chart-selection.md`.

```bash
pbir visuals sort "Page/Visual.Visual" -f "<Table.Measure>" -d Descending
```

## too many cards

A wall of bare cards is data without a question; ten numbers with no hierarchy ask the reader to find the point themselves. Repair: cap the card row to the few that drive a decision (the "20% change test" in `references/cards-and-kpis.md`), and demote the rest into one table or chart. This is also a page-shape signal: a card wall usually means a summary page that never decided what it summarizes.

## raw field names as titles

`Sum of SalesAmount` as a visual title narrates the query, not the question. A title should state what the visual answers so the reader knows why it is there. Repair: rewrite the visual title to the question ("Sales vs target, by region"); leave the underlying model field name untouched, the title is a report-side string.

```bash
pbir set "Page/Visual.Visual.title.text" --value "Sales vs target, by region"
```

## inline hex instead of theme references

A literal hex value in `visual.json` pins a color to one visual; the identity stops propagating and a re-theme leaves it stranded. Repair: use a `ThemeDataColor` or a semantic token so the color cites the identity and re-themes cleanly. The theme-vs-hex decision and the conversion path live in `references/visual-colors.md`.

```bash
pbir visuals cf "Page/Visual.Visual" --theme-colors "dataPoint.fill"    # convert existing hex assignments to tokens
```

## off-grid drift

Positions that are not on the grid unit, and gaps that are close but not equal, read as sloppy even at a 4-8px difference; the eye catches the misalignment before it reads the data. Repair: snap every position to the grid unit and recompute gaps arithmetically from margin, gap, and canvas size. The arithmetic and the continuous-gutter rule are in `references/layout-guidelines.md`.

## dual y-axis abuse

Two unrelated measures on two independent scales invite a false reading: the lines cross or diverge by axis choice, not by the data. Repair: use a second axis only when two genuinely different units share one category axis. Otherwise split into two visuals, or index both measures to a common base so one axis serves both.

## 3D anything

Perspective distorts the length and area the reader is trying to compare; a 3D bar is taller or shorter by viewing angle, not by value. Repair: flat 2D, always. There is no analytical task a 3D chart does better than its flat version.

## pie beyond a few slices

A pie forces angle and area, the weakest channels, and past roughly four parts the slices stop being distinguishable. Repair: a sorted bar chart with the long tail grouped into "Other". The slice-count threshold and the Top-N-plus-Other pattern are in `references/chart-selection.md`.

```bash
pbir set "Page/Visual.Visual.visualType" --value "clusteredBarChart"   # swapping the type may need fields rebound to the new roles
```
