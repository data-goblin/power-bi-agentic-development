---
title: Conditional formatting with pbir
summary: Which pbir surface creates, reads, edits and removes conditional formatting, and the selector and renderer traps behind silent no-ops.
kind: gotcha
status: current
sources:
  - url: https://learn.microsoft.com/en-us/power-bi/create-reports/desktop-conditional-table-formatting
tools:
  pbir: 0.9.33
last_updated: 2026-11-23
last_verified: 2026-11-23
review_cadence_days: 90
verified_by:
  - pbir visuals cf --help
  - pbir schema describe barChart dataPoint
skills: [reports/pbir-cli]
---

# Conditional formatting with pbir

[Learn: conditional formatting](https://learn.microsoft.com/en-us/power-bi/create-reports/desktop-conditional-table-formatting) covers the UI. pbir splits the work in two:

- `pbir visuals cf` creates, copies and converts (structural)
- `pbir get` and `pbir set` read, edit and remove on a `.cf` path

## Ask what accepts it first

A wrong selector shape passes every schema check and renders nothing. `pbir schema describe barChart.dataPoint` prints a `Conditional formatting:` line naming the properties of that container that take a measure; a starred property was confirmed against a rendered report. CF reaches titles, subtitles, borders, axis bounds, reference-line values, dynamic label text, error-bar styling and grid colours, not only data points.

## Create, read, edit, remove

```bash
pbir visuals cf "R.Report/P.Page/V.Visual" --measure "labels.color _Fmt.StatusColor"
pbir visuals cf "R.Report/P.Page/V.Visual" --gradient --field "Sales.Margin" --min-color bad --max-color good
pbir visuals cf "R.Report/P.Page/V.Visual" --rules --field "Sales.Margin" --rule "gt 0 good" --rule "lte 0 bad"
pbir get "R.Report/P.Page/V.Visual.dataPoint.fill.cf"
pbir set "R.Report/P.Page/V.Visual.dataPoint.fill.cf.gradient.min.color" --value "bad"
pbir set "R.Report/P.Page/V.Visual.dataPoint.fill.cf" --remove
```

- `--measure` takes `"container.prop Table.Measure"`; colour properties are wrapped as a solid colour for you
- Rule format `"operator value colour_or_icon"`; operators `gt lt gte lte eq neq`
- Re-running a builder on the same property and scope replaces the entry, so changing kind is one command; `pbir set` on a leaf of another kind is a hard error and never converts
- `--remove` wipes CF at the addressed depth and keeps state overrides (`id: default`, `selection:selected`)
- `--theme-colors` swaps hex stops for theme tokens; `--to-measure` generates an extension measure approximating the built-in CF; `--copy-from` copies all CF between visuals; `pbir cp <source> <target> --format-only` copies all formatting except bindings

## Traps

- **Driver is not target.** `--field` is the field whose value decides the format. On containers Power BI addresses one field at a time (grid `values`, chart `error`, card `label`) also pass `--target-field` for the formatted field, otherwise the entry scopes to the driver and Desktop paints the wrong column. A combo chart with measures in Y and Y2 needs it too
- **Grids need the field projected first.** `pbir fields add` the column, then `pbir visuals cf`
- **Colour tokens.** `--min-color bad` and measures returning `"good"`, `"bad"`, `"neutral"` resolve against the theme sentiment colours (`pbir theme set-colors --good --bad --neutral`). Learn documents hex and named colours only: the token behaviour is pbir's own and unconfirmed by Microsoft
- **Category axis labels cannot be coloured per category**: the renderer evaluates `categoryAxis.labelColor` once at visual scope
- **Error bars can silently disable per-point `dataPoint.fill` CF** on the same visual; removing the `error` container restores it. Not every chart is affected
- **Verify in the reading view** on a fresh load; the edit canvas shows session state
- Measure data type: Text for colours, icons and titles, Double or Integer for numbers, or Power BI hides the measure from the CF picker. Details: [extension measures](pbir-extension-measures.md)

## Images and SVG measures

`pbir visuals cf --image --field "_SVG.Bullet"` fills a card's image slot from a measure. The measure must be Text, have data category `ImageUrl` (`pbir dax measures add --data-category ImageUrl`), and on grids the column must already be projected, because grids render images from a bound `ImageUrl` column with `grid.imageHeight` and `grid.imageWidth` and have no CF entry for it. The card entry carries an `imageType` discriminator pbir writes for you; keep it through copies.

## Static contrast checks

`pbir validate --qa` flags static text colours below 3:1 (`LOW_TEXT_CONTRAST`) and static fills below 3:1 (`LOW_FILL_CONTRAST`); `--contrast-against visual|page|effective` picks the background layer.
