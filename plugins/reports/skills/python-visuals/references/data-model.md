# Python Visual Data Model

Behavior of `dataset` and the row cap; traps that cause silent wrong input.

## Distinct-row grouping

The 150,000-row cap applies to the **deduplicated set**, not the raw fact table. Power BI groups the `dataset` exactly like a table visual before handing it to the script: identical rows across all bound `Values` columns collapse to one. A script bound to `Region, Category` over a million-row fact table receives at most as many rows as there are distinct `Region + Category` combinations.

This is a property of the field bindings, not the script. Consequences:

- Per-transaction charts (jitter, strip, raw scatter, ECDF) silently receive aggregated input if no unique key is bound
- Scripts expecting row-level variation (e.g. bootstrapping, individual observations) produce wrong output without error
- The cap is hit much faster when a unique key is included; pre-filter at the visual or page level first

To force per-row input, bind a guaranteed-unique column to the `Values` role alongside your other fields:

```bash
pbir visuals bind Page/StripPlot -t Column -d "Values:Sales.Region"
pbir visuals bind Page/StripPlot -t Column -d "Values:Sales.Amount"
pbir visuals bind Page/StripPlot -t Column -d "Values:Sales.TransactionKey"
```

Do not use a measure as the unique key; a measure changes the projection kind and does not produce distinct-row expansion. If the model has no natural key, add an index column in Power Query or accept grouped input by design. Verify the effective row count with `print(len(dataset))` during development.

Two byte caps the skill header omits:

- Input is capped at 250 MB regardless of row count (Desktop and Service)
- Any single string value over 32,766 chars is silently truncated; validate with `dataset.apply(lambda c: c.str.len().max())` before parsing a long bound string

`dataset` arrives in arbitrary order; sort inside the script, never rely on positional joins.
