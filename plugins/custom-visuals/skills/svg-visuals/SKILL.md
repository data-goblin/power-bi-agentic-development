---
name: svg-visuals
description: Writes DAX measures that return SVG for table or matrix cells, image visuals, new cards and button slicers in PBIR reports (SVG measure, ImageUrl data category, DAX sparkline, data bar, bullet, progress bar, status pill in a cell). Use when the graphic is small, static and lives inside another visual. Not for interactive charts (Deneb) or reusable visuals (pbiviz).
---

# SVG measures (PBIR)

## Rules

- The measure returns `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' ...>...</svg>` and has data category `ImageUrl` and type Text. Without the category the cell shows the markup as text
- Inside the DAX string: single-quoted SVG attributes, colours as `#RRGGBB` (never `%23`, never named colours), no `<script>` and no event attributes (stripped); the image is static
- Store it as an extension (report-level) measure with `pbir dax measures add`; it does not belong in the semantic model
- Guard the total rows: a matrix evaluates the measure at subtotals and grand total. Use `ISINSCOPE` or `HASONEVALUE`, and scale bars against the maximum at the same hierarchy level or subtotals dwarf detail rows
- Use `viewBox`, integer coordinates, and one `<polyline>` built with `CONCATENATEX` for sparklines instead of one element per point
- The string a cell returns has a ceiling (community reports 32K characters per cell; Unverified); a 60 month sparkline is the usual victim, so shorten the window and check `LEN` of the worst member
- Prefer a UDF library to hand-written DAX when one has the chart: [DaxLib.SVG](https://daxlib.org/package/DaxLib.SVG/), [PowerofBI.IBCS](https://daxlib.org/package/PowerofBI.IBCS/). Install them into the model with `te` or the connect-pbid skill; this skill's examples are the fallback
- Host wiring (table, matrix, image, new card, button slicer) and limits: [wiring by host](../../wiki/svg-measure-wiring-by-visual.md), [limits and gotchas](../../wiki/svg-measure-gotchas.md)
- Accessibility: bind the numbers the SVG encodes as plain adjacent columns and set alt text on the host with `pbir visuals general <visual> --altText "..."`; colour alone must not carry status (pair it with a shape or label)

## Workflow (pbir 0.9.33)

1. Query the model for real values (`te query` or DAX Studio) and draw a static SVG first; render it (`xmllint --noout file.svg`, then any rasteriser) before turning it into DAX
2. Add the measure (`$EXPRESSION` is the DAX after the `=` of a file in `examples/`), then bind it and set the image size:

```bash
pbir dax measures add "R.Report" -t Sales -n "Bullet SVG" -e "$EXPRESSION" -d Text --data-category ImageUrl
pbir visuals bind "R.Report/P.Page/Matrix.Visual" --add "Values:Sales.Bullet SVG" --type Measure
pbir visuals table-density "R.Report/P.Page/Matrix.Visual" --image-height 24 --image-width 110
pbir validate "R.Report" --all
```

3. For an image visual, `pbir add visual image "R.Report/P.Page" --name Gauge --image "Sales.Gauge SVG"` writes `general.imageUrl`; the wiring that was rendered in the service uses `objects.image` with `sourceType` `imageData` (see the wiring page). Render the result before shipping
4. The plugin's PostToolUse hook lints every `*.dax` file that contains `data:image/svg+xml` for the prefix, `%23`, double-quoted attributes and scripts. The `svg-reviewer` agent ships with the reports plugin, not this one

## Examples (checked by the hook)

- [sparkline](examples/sparkline-measure.dax), [bullet](examples/bullet-chart-measure.dax), [progress bar](examples/progress-bar-measure.dax), [status pill](examples/status-pill-measure.dax), [waterfall](examples/waterfall-measure.dax)
- Background: [Creating custom visuals in Power BI with DAX](https://www.sqlbi.com/articles/creating-custom-visuals-in-power-bi-with-dax/)
