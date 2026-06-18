# Advanced Deneb Patterns

## Advanced Cross-Filtering (Vega only)

Simple selection mode (`selectionMode: simple`) auto-resolves `__selected__` per mark. Advanced mode is required for brush-select, lasso, region-click, or any selection that is not one-mark = one-row. It is **Vega only**; Vega-Lite cannot use it, so plan the provider from the start.

Two signal functions exposed in advanced mode:

- `pbiCrossFilterApply(event, filter?, options?)` -- filter the original dataset by the optional predicate and cross-filter on the result; `event` is required as the first arg
- `pbiCrossFilterClear()` -- clear, no args

Basic point-click pattern:

```json
"signals": [{
  "name": "pbiCrossFilterSelection",
  "value": [],
  "on": [
    {
      "events": {"source": "scope", "type": "mouseup", "markname": "data-point"},
      "update": "pbiCrossFilterApply(event)"
    },
    {
      "events": {
        "source": "view", "type": "mouseup",
        "filter": ["!event.item || event.item.mark.name != 'data-point'"]
      },
      "update": "pbiCrossFilterClear()"
    }
  ]
}]
```

For a brush, bind a Vega `interval` selection and pass its extent into the `filter` argument. The `options.limit` key (1-2500, default 50) overrides the simple-mode 250 cap because you control row resolution.

Enable via:

```bash
pbir set "<path>" objects.vega[0].properties.selectionMode '"advanced"'
```

Pitfalls:

- Switching a working simple-mode visual to advanced silently kills cross-filtering until the signals are authored
- After aggregated marks the resolved data is at a different granularity than the base `dataset`; aliased columns must match original names or rows resolve empty
- A community-reported failure pattern: the visual filters others but never reflects an external filter back into `__selected__`; flag in review, it is a known Deneb limitation in some versions

## Performance Engineering

A Deneb visual re-runs the whole Vega dataflow on every interaction. Cost scales row count x mark count x per-row field count, and Power BI widens every row with runtime fields. Apply levers cheapest-first:

1. **Aggregate in DAX, not Vega** -- bind a monthly measure so the model sends ~12 rows; a `transform aggregate` over 50K rows recomputes on every hover. Push grouping to the model or a visual-level Top N filter
2. **Prefer `renderMode: canvas` for many marks** -- SVG creates a DOM node per mark; canvas draws to a bitmap. Keep SVG only when marks are few or selectable text is needed
3. **Trim marks before raising limits** -- collapse decorative layers first
4. **Drop unused runtime field bloat** -- every bound measure ships `<measure>__formatted` and `<measure>__format`; bind only what the spec uses
5. **`dataLimit.override` as a last resort** -- paired with canvas; removes the soft 10K guard but the model's own row cap still applies and can truncate silently

```bash
pbir set "<path>" objects.vega[0].properties.renderMode '"canvas"'
pbir set "<path>" objects.dataLimit[0].properties.override true
```

Keep the cross-filter `limit` as low as the interaction allows (simple mode caps at 250 for this reason).

Pitfalls:

- `dataLimit.override` does not remove the model-side cap; verify the expected row count actually arrives
- Canvas mode breaks SVG-dependent tooltips and makes text non-selectable; confirm tooltips still fire after switching
- A spec fine in Desktop can stall in a specific browser (Edge has had known rendering issues with large canvas specs); check the audience's browser

## Template Round-Trip (Terminal Import)

The Deneb GUI prompts for placeholder mapping on import; from a terminal you substitute manually then inject. A template is a Vega/Vega-Lite spec whose field references are placeholders matching `^__[a-zA-Z0-9]+__$` (e.g. `__category__`), described in `usermeta.dataset`.

Steps:

1. Read `usermeta.dataset` for each `key` (placeholder), `kind` (`column` vs `measure`), `type`. Kind is load-bearing: wrong kind passes `pbir validate` but fails at runtime
2. Strip `usermeta` and `$schema` from the spec body (Deneb's object does not consume `usermeta`)
3. Replace each `__placeholder__` token in the spec text with the real field name, applying PBIR escaping (doubled single quotes inside `jsonSpec` for names with spaces/apostrophes); do this before injection
4. Add the visual, inject the rewritten spec into `jsonSpec`, create the `dataset` role bindings:

```bash
pbir visuals bind "<path>" -r dataset -d "Sales.OrderDate" -t Column
pbir visuals bind "<path>" -r dataset -d "Sales.Total"     -t Measure
```

5. Set `provider` to match (`vega` / `vegaLite`); if the template shipped a `config` block, inject it into `jsonConfig`, not `jsonSpec`; validate

Pitfalls:

- `usermeta.deneb.providerVersion` can lag the installed Deneb build; the most common break is a leftover `datum.__identity__` (removed in Deneb 1.9); rewrite to `datum.__row__`
- Leaving `usermeta` in `jsonSpec`, or leaving `"data": {"values": [...]}` sample rows, ships stale embedded data; the spec must read `{"name": "dataset"}`
- External `data.url` templates fail AppSource certification and break offline; replace with the `dataset` binding
- A wrong-`kind` binding (column where measure expected) passes validate but renders blank

For the `usermeta.dataset` schema see `references/capabilities.md`.
