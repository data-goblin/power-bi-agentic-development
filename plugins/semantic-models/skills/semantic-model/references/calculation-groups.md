# Calculation groups

Companion to the `semantic-model` skill (SKILL.md). Original guidance; each section cites its sources.

**Working with `te`:** `te add calculationGroup "Time Intelligence" --save`, then `te add calculationItem ...`. Read / set group precedence with `te set <group> -q precedence`; selection expressions, `selectionExpressionBehavior`, and variant guards that `te set` does not expose go through `te script` (TOM).

## Calculation group precedence: how items actually combine

When two calc groups have an item in filter context at once, the engine nests them: each item's `SELECTEDMEASURE()` token is textually replaced by the next-lower-precedence item's DAX, down to the base measure. The group with the **highest** `precedence` integer is the **outermost** wrapper. The output is order-dependent and rarely commutative ; a high-precedence `SELECTEDMEASURE()*2` over a lower `SELECTEDMEASURE()+2` on measure=10 gives `((10)+2)*2 = 24`, not 14. When a higher-precedence item uses `CALCULATE`/context transition, it rewrites the filter context the inner item sees (Time Intelligence at higher precedence makes YTD wrap both numerator and day-count denominator of an average). Precedence also decides whose dynamic format string wins (only the highest group's applies; a measure's own dynamic format is always lower than any calc group).

Precedence lives on the **group** (not per-item `ordinal`, which is only within-group sort order ; do not confuse them). Inspect with `te set <group> -q precedence` before setting; assign distinct integers when groups co-occur in one visual, or apply order is undefined. If `te set` cannot reach it, fall to a `te script` C# pass (`CalculationGroupPrecedence`) or edit the `precedence:` line in TMDL last. A calc item only modifies an expression containing a measure reference; with no `SELECTEDMEASURE()` in scope it is a no-op.

Sources: learn.microsoft.com calculation-groups (precedence); repo SpaceParts Z04CG1 Time Intelligence.tmdl; repo te-cli semantic-modeling-practices

## Calculation groups: sideways recursion (the only supported recursion)

A calc item can reference another item in the same group by overriding that group's column inside `CALCULATE` ; the one recursion form the engine permits. `YOY%` is built from the `YOY` and `PY` items (`DIVIDE(CALCULATE(SELECTEDMEASURE(), 'Time Intelligence'[Time Calculation]="YOY"), CALCULATE(SELECTEDMEASURE(), ...="PY"))`) rather than re-deriving them; a `PY YTD` item layers PY on top of the already-defined YTD item. This is composition for calc items: define `YTD`/`PY`/`YOY` once, then build derived items from them, and changing the base propagates. Each `DIVIDE` branch is a separate `CALCULATE` that re-enters the group cleanly.

Use the column's quoted full name inside the item DAX with the item name as a string literal ; this is the one place the literal is unavoidable, and the rename-safe `ISSELECTEDMEASURE` guidance does not apply (it is about measure references). So renaming a base item still requires a find-replace across dependent items. Only sideways recursion works; an item recursing into itself, or applying the same group twice in one `CALCULATE`, errors or is silently ignored (one item per group in filter context at a time). Nesting two overrides of the same group column in one `CALCULATE` collapses to the last filter.

Sources: learn.microsoft.com calculation-groups (sideways recursion, single-item-in-filter-context)

## Calculation groups: selection expressions and selectionExpressionBehavior

Two optional group-level DAX properties handle non-clean selections: `multipleOrEmptySelectionExpression` fires on multi-select, a nonexistent item, or a conflict; `noSelectionExpression` fires when the group is unfiltered. Each carries its own `formatStringDefinition`. Default when undefined: the group does not filter (base measure passes through); a single valid selection never triggers either. A model-level `selectionExpressionBehavior` (`Automatic` = today's `nonvisual`, or `visual`) tunes the default; above a future compat level `Automatic` resolves to `visual`.

Without `multipleOrEmptySelectionExpression`, a user multi-selecting calc-group items gets the unfiltered base measure with no signal ; a common "why is the number wrong" ticket. Define it to return a deliberate value (`BLANK()` with a `--`-style format) or block ambiguous selections; `noSelectionExpression` makes a "Current" default. These are group properties (confirm casing first); if `te set` does not expose them, use `te script` (`MultipleOrEmptySelectionExpression`, `SelectionExpressionBehavior`) or TMDL. Never put normal logic in these (they never fire on a single valid selection); each needs its own `formatStringDefinition` or it inherits a mismatching default (returning `BLANK()` but inheriting currency shows a stray symbol); `selectionExpressionBehavior=visual` changes existing report numbers, so baseline key measures before and after.

Sources: learn.microsoft.com calculation-groups (selection expressions)

## Calculation groups: hard limitations and the variant-data-type trap

Adding any calc group flips a model-wide switch. Unsupported alongside calc groups: OLS on the calc-group table; RLS on the calc group itself (use the data tables); Detail Rows Expressions; Smart Narrative; implicit column aggregations (the sigma options appear but cannot apply unless `discourageImplicitMeasures=true`, which removes them cleanly). In Live Connection, dynamic format strings are not applied to report-level measures.

The variant trap: the moment a calc group exists, Power BI treats **every** measure as the variant type. This silently breaks any dynamic format string that reuses another measure's value, and breaks visuals when an item runs arithmetic on a non-numeric measure (dynamic titles, text measures): `Cannot convert value ... of type Text to type Numeric`. Removing all calc groups reverts measures to their real types. This is the most surprising side effect in a review because the failure surfaces in report visuals, not the model. Two fixes, in order: guard arithmetic items with `IF(ISNUMERIC(SELECTEDMEASURE()), ...)`, or coerce a reused format-string measure with `FORMAT([Dynamic format string], "")`; the preferred long-term fix moves shared format-string logic into a DAX UDF, sidestepping the coercion (dovetailing with the UDF-over-calc-group guidance). When reviewing a model with calc groups, proactively check text/title measures and measure-reusing dynamic format strings.

Sources: learn.microsoft.com calculation-groups (limitations, considerations); learn.microsoft.com desktop-dynamic-format-strings; repo te-cli semantic-modeling-practices
