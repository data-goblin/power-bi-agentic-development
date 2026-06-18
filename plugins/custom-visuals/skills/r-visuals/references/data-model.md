# R Visual Data Model

Behavior of `dataset` and the row cap; traps that cause silent wrong input.

## Distinct-row grouping

The 150,000-row cap applies to the **deduplicated set**, not the raw fact table. Power BI groups the `dataset` exactly like a table visual before handing it to the script: identical rows across all bound `Values` columns collapse to one. A script bound to `Region, Category` over a million-row fact table receives at most as many rows as there are distinct `Region + Category` combinations.

This is a property of the field bindings, not the script. Consequences:

- Per-observation charts (jitter, strip, raw scatter, ECDF) silently receive aggregated input if no unique key is bound
- Scripts expecting row-level variation (bootstrapping, individual observations) produce wrong output without error
- The cap is hit much faster when a unique key is included; pre-filter at the visual or page level first

To force per-row input, bind a guaranteed-unique column to the `Values` role alongside your other fields:

```bash
pbir visuals bind Page/StripPlot -t Column -d "Values:Sales.Region"
pbir visuals bind Page/StripPlot -t Column -d "Values:Sales.Amount"
pbir visuals bind Page/StripPlot -t Column -d "Values:Sales.TransactionKey"
```

Do not use a measure as the unique key; a measure changes the projection kind and does not produce distinct-row expansion. If the model has no natural key, add an index column in Power Query or accept grouped input by design. Verify the effective row count with `nrow(dataset)` during development.

Two byte caps the skill header omits:

- Input is capped at 250 MB regardless of row count (Desktop and Service)
- Output is additionally capped at 2 MB on Desktop; a dense ggplot (many `ggrepel` labels, fine `geom_tile`) can blow it silently; reduce mark density first
- Any single string value over 32,766 chars is silently truncated

`dataset` arrives in arbitrary order; sort inside the script (`reorder()`, `factor(levels=...)`) and never rely on positional joins.

## R-specific traps (no Python equivalent)

### Time data type unsupported

A `Time` column (not `Date/Time`) errors the visual. Cast or model the field as `Date/Time` before binding; this is a model fix, not a script fix.

### Text rendering in Service

R text-based output requires `powerbi_rEnableShowText = 1` set as the first line of the script in Service. Desktop silently ignores it; Service silently drops text without it. This is the most common Desktop-passes / Service-fails trap for R visuals.

### CJK fonts in Service

CJK characters render blank in Service unless the script sets `powerbi_rEnableShowTextForCJKLanguages = 1` and loads `showtext`. Both flags must appear before any `library()` call:

```r
powerbi_rEnableShowText = 1
powerbi_rEnableShowTextForCJKLanguages = 1
if (!requireNamespace("showtext", quietly = TRUE)) install.packages("showtext")
library(showtext)
showtext_auto()
library(ggplot2)
```

`showtext` is on the approved CRAN list; the `install.packages()` call works in Service. Placing either flag after `library()` or inside a function makes it a no-op.
