---
title: SVG measure limits and traps
summary: String length, cost, colour and naming traps for DAX SVG measures, with what is verified and what is community lore.
kind: gotcha
status: current
sources:
  - url: https://www.sqlbi.com/articles/creating-custom-visuals-in-power-bi-with-dax/
last_updated: 2026-11-23
last_verified: 2026-11-23
review_cadence_days: 90
skills: [custom-visuals/svg-visuals]
---

# SVG measure limits and traps

```yaml
colours: plain #RRGGBB; the service encodes the data URI itself, so %23 breaks every colour (earlier render check in this repository, not repeated)
measure_names: unique across the model, case-insensitively ("Turnover vs budget color" clashes with "Turnover vs Budget color")
future_months: a measure-only chart with blank future months drops them even with "show items with no data"; return 0 and use a format with an empty zero section (#,##0;-#,##0;"")
sentiment_colours: green and red only for good and bad
string_ceiling: Unverified. Community threads quote 32K characters per rendered cell and say the cell then shows blank text; measure LEN of the worst member (a DAX query through `te query`) before relying on it
sort_key: Unverified. Community practice embeds <desc>000000012345</desc> so the image column sorts by value; not documented by Microsoft
cost: the measure runs once per visible cell in the formula engine; push aggregations into model measures and let the SVG only map numbers to coordinates
polyline: one CONCATENATEX into <polyline points='...'> is one iteration; N <circle> or <line> elements are N iterations
volatile_inputs: NOW(), TODAY() and RAND() defeat the result cache; derive jitter from a key column
image_size: large grid.imageWidth adds paint cost, not formula cost; wide images with auto-size columns cause horizontal scroll
```
