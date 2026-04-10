# Field and what-if parameters

Companion to the `semantic-model` skill (SKILL.md). Original guidance; each section cites its sources.

**Working with `te`:** build field parameters with the `c-sharp-scripting` macro via `te script` (do not hand-author the DAX + annotations through `te add`). A what-if is `te add table` with a `GENERATESERIES` partition plus a `SELECTEDVALUE` measure. Verify with `te get "<FP>" --output-format tmdl`.

## Field parameter structure, ordering, and the sort column

A field parameter is a calculated table whose import partition is a DAX constructor of 3-tuples `("Label", NAMEOF([Measure or Column]), <sortIndex>)`, projected into three columns with the second tagged `extendedProperty ParameterMetadata = { "version": 3, "kind": 2 }`. Three things break silently if wrong:
- The label column (`Value1`) must carry `sortByColumn` pointing at the order column (`Value3`), or the slicer sorts labels alphabetically instead of business order
- `ParameterMetadata` goes on the hidden `NAMEOF` column (`Value2`), not the label or table; omit it and the slicer's field-swap never activates
- `relatedColumnDetails/groupByColumn` on the label binds it back to the hidden column so a selection swaps the field; lose it and the slicer filters rows without swapping

Ordering has two independent mechanisms that fight: the `Value3` index controls slicer order, but the order fields appear **inside** the target visual is driven by selection order at runtime (regular slicer) or hierarchy order (hierarchy slicer). So `Value3` is a slicer-presentation concern only; do not assume it controls matrix column order.

Do not hand-author the DAX + annotations through `te add`/`te set` (the repo's te-cli workflow flags it as error-prone). Run the field-parameter macro from `c-sharp-scripting` via `te script`, which builds the table, constructor, extended property, and sort binding in one pass; verify with `te get 'FP - MTD' --output-format tmdl` that `ParameterMetadata` sits on the hidden column and `sortByColumn` on the label. Fall back to `create-field-parameter.ps1` (connect-pbid) for a live local instance, then mirror the `FP - MTD.tmdl` example as a last resort. Review findings: a field parameter references only explicit measures/columns by `NAMEOF` (no implicit aggregation); it is not valid as a drillthrough/tooltip linked field (link the underlying fields); selecting zero items equals selecting all (no empty state); it needs a local model on live-connect (composite); it is unsupported in Q&A/AI visuals; keep `Value3` a dense integer (0,1,2,...) or order is nondeterministic.

Sources: learn.microsoft.com power-bi-field-parameters; repo SpaceParts FP - MTD.tmdl; repo te-cli workflows; repo create-field-parameter.ps1

## What-if (numeric range) parameters

A what-if parameter produces two objects from one Desktop dialog: a calculated table of evenly spaced values via `GENERATESERIES(min, max, increment)`, and a measure `SELECTEDVALUE([col], default)` returning the picked value. It is a scenario input (discount rate, FX, threshold), distinct from a field parameter (swaps fields) and a dynamic M query parameter (folds a value into the source). The decision rule: swap which measure/dimension a visual shows means field parameter; let the user feed a scalar into a calculation means what-if; push a value into the source query for server-side folding means dynamic M query parameter (they are not interchangeable). A downstream measure consumes the Value measure, not the table.

There is no special metadata flag, so standard `te` object commands fully build it: a calculated table with the `GENERATESERIES` source plus the value measure; set `formatString` (e.g. `0%`) and `summarizeBy: none` on the column so it stays a slicer dimension. Validate the series row count is `(max-min)/increment + 1`. Review findings: the table holds at most **1,000 unique values** ; beyond that Power BI evenly samples and silently drops granularity, so pick an increment keeping cardinality at or under 1,000, and flag any `GENERATESERIES` over it. Use the value in a measure, not a dimension/row-context calculation (the selection is not in scope there ; a `SELECTEDVALUE`-of-parameter inside a calculated column or grouping is a red flag). Always set a meaningful default (the `SELECTEDVALUE` second arg fires on multi-select and no-select; an omitted default blanks dependent measures when the slicer clears). `GENERATESERIES` is unsupported in DirectQuery for calculated columns/RLS; the what-if table is an Import calculated table (fine for Import/composite, materialized, non-foldable).

Sources: learn.microsoft.com desktop-what-if; learn.microsoft.com generateseries-function-dax; learn.microsoft.com power-bi-visualization-troubleshoot; learn.microsoft.com desktop-slicer-numeric-range

## Dynamic visual titles tied to a parameter (model-side measure)

Field and what-if parameters pair with an expression-based title: a measure reflecting the current selection so the visual header narrates what is on screen. The model piece is a `SELECTEDVALUE`-based measure; the report binds it to the title via conditional formatting. The value of a parameter usually surfaces to the user through this title, and the fix lives in the model (a measure), reusable across pages, so it belongs in the semantic-model skill even though the binding is a report step.

Add a measure that reads the parameter's visible label column (`"Showing: " & SELECTEDVALUE('FP - MTD'[FP - MTD], "All metrics")`), or for what-if surfaces the scalar (`"Discount: " & FORMAT([Discount percentage Value], "0%")`), then validate the string with `te query`. `SELECTEDVALUE` returns the default on both multi-select and no-select, so pick a default reading correctly in both ("All metrics", not ""). Reference the visible label column, not the hidden `NAMEOF` column. Keep the measure model-level (not a report-scoped extension measure) so every report reusing the model gets it. `USERCULTURE()` returns the user's culture only inside a measure (in a calculated column/table it returns the model default at load time), so keep dynamic-title logic in measures.

Sources: learn.microsoft.com desktop-conditional-format-visual-titles; learn.microsoft.com power-bi-field-parameters
