# Relationships and cardinality

Companion to the `semantic-model` skill (SKILL.md). Original guidance; each section cites its sources.

**Working with `te`:** enumerate with `te query -q "EVALUATE INFO.VIEW.RELATIONSHIPS()"` (`te ls` cannot list relationships). Create with `te add relationship "Sales[K]->Date[K]" --save`; set cross-filter / active / security behavior with `te set Relationships/<name> -q <prop>`, or `te script` (TOM) when the property is not exposed.

## Detecting limited relationships and the silent drops they cause

Regular vs limited is inferred at evaluation time, not set. A relationship is limited when its cardinality is many-to-many (even if both columns hold unique values) or it crosses a source group (import-to-DQ, or DQ-to-different-DQ). Everything else 1:M or 1:1 inside one source group is regular. Direct Lake + import composites keep regular relationships across the two modes, unlike classic import + DirectQuery.

The difference changes numbers silently:
- Regular 1:M joins LEFT OUTER and synthesizes a blank "unknown member" for unmatched many-side keys, so RI violations still appear in totals under (Blank)
- Limited joins INNER, adds no blank row, and drops unmatched rows entirely ; an orphan fact row just vanishes from every aggregate. No error, a quietly understated total
- `RELATED()` cannot traverse a limited relationship (it errors); table expansion never happens, so the join resolves per query in multiple passes and degrades fast above low-cardinality keys

From a terminal there is no diagram, so infer and probe. `INFO.VIEW.RELATIONSHIPS()` lists cardinality, cross-filter behavior, and active flag (`te ls` cannot enumerate relationships). Flag any many-to-many row as limited; for composites cross-check storage modes and treat any cross-mode relationship as limited. Probe orphans with an anti-join (`EXCEPT`/`NATURALLEFTOUTERJOIN` on the keys) ; a non-zero orphan count on a regular relationship lands under (Blank), on a limited one those rows are silently gone (the dangerous case). If the m2m was an accident (transient duplicates at create time), fix the cardinality once the one-side is genuinely unique; confirm the property name on a live object first or fall to `te script`. Do not force cardinality on a real cross-source-group limited relationship ; no cardinality change makes it regular, so reduce cost instead (Dual on the shared dimension, or pull it into the Vertipaq group).

Sources: learn.microsoft.com desktop-relationships-understand; learn.microsoft.com direct-lake-web-modeling (DL+import keep regular); SQLBI strong-and-weak-relationships; repo te-cli command-reference

## Cardinality and uniqueness go unvalidated in Direct Lake and web modeling

Import and DirectQuery profile columns when you create a relationship and auto-populate cardinality and direction. Direct Lake and web modeling do not. Direct Lake guesses the many side from a row-count DAX query, pre-sets single direction, and never checks one-side uniqueness; web modeling issues no validation queries at all, including for the marked date column.

The hard rule: a Direct Lake relationship's one-side column must be unique, and if duplicates exist the **query fails at runtime**, not at refresh or edit time. So an agent can author a structurally valid model, pass every static check, deploy it, and have every visual touching that relationship error the first time a user opens the report because the Delta table had a duplicate key. The row-count heuristic also picks the wrong many side whenever the dimension is larger than the fact (a wide SCD against a sparse fact), producing a backwards relationship.

Prove it yourself: `te query` `COUNTROWS(Product)` vs `DISTINCTCOUNT(Product[ProductKey])` (rows greater than distinct means duplicates ; de-dup upstream in the Delta table before the model is usable) and a non-zero blank-key count (a second uniqueness hazard). Confirm the heuristic assigned the right many side via `INFO.VIEW.RELATIONSHIPS()`; correct mis-assignment explicitly. After any Direct Lake relationship change, re-run a real visual-shaped `SUMMARIZECOLUMNS` query to actually exercise the join, since nothing else does until a user does. Direct Lake requires exact data-type match across the relationship (string vs int is rejected; Binary/GUID must be cast to string upstream), and Direct Lake on SQL needs an explicitly marked date table joined on a real date column ; no auto date-part leniency.

Sources: learn.microsoft.com direct-lake-edit-tables (no preview, row-count heuristic, no validation); learn.microsoft.com direct-lake-overview (one-side unique or queries fail; type match); learn.microsoft.com desktop-create-and-manage-relationships

## Resolving ambiguous filter paths deterministically (priority tiers and weight)

Ambiguity has two causes, only one being the expected bidirectional case: (1) a bidirectional cross-filter opening a second route, (2) a diamond schema with two paths to the same target and no bidirectional filter at all (two bridges reaching one dimension). Power BI resolves with a fixed priority-tier sequence, first matching tier wins: 1:M-only paths, then 1:M-or-M:M, then M:1, then 1:M-to-intermediate-then-M:1, then the same allowing M:M legs, then anything else. A relationship in every candidate path is dropped from consideration. Within one tier, path weight is the maximum weight of its relationships (count is irrelevant) and the higher-weight path wins; the engine never crosses tiers to chase weight. A same-tier same-weight tie is a hard ambiguous-path error, not a silent pick.

Two failure modes that look nothing alike: sometimes Desktop refuses a bidirectional change at edit time (safe), other times it accepts the topology and silently routes filters down the tier-1 path, so a measure returns plausible-but-wrong numbers. An agent that "just adds the relationship the measure needs" can flip the chosen path and change every cross-table total with no error. `USERELATIONSHIP` is the deliberate lever ; it raises a relationship's weight (innermost nested call gets the highest), activating an inactive relationship and breaking a same-tier weight tie toward the path you want.

Map the topology before and after any edit with `INFO.VIEW.RELATIONSHIPS()` plus `te deps`; any two tables reachable by more than one active path (including a bidirectional return route) are an ambiguity candidate. For a genuine diamond, keep one path active and others inactive, then select per measure with `USERELATIONSHIP` rather than leaving the engine to pick. If activating one path still raises ambiguity, nest a second `USERELATIONSHIP` to force ordering. Prefer the documented bidirectional alternatives (a visual-level "is not blank" filter, or `CROSSFILTER(..., BOTH)` scoped to one measure) over a model-level bidirectional flag, which is the usual source of accidental ambiguity. `USERELATIONSHIP` in a calculated column does nothing (row context) ; use `LOOKUPVALUE`.

Sources: learn.microsoft.com desktop-relationships-understand (resolve path ambiguity); SQLBI bidirectional-relationships-and-ambiguity-in-dax; tabulareditor.com ambiguous-paths-in-power-bi

## Active/inactive relationships and the dead-inactive-relationship defect

A model holds at most one active path between two tables; extras must be inactive. Inactive relationships still participate in table expansion (so a regular one still costs refresh-time index build) but propagate no filter until a calculation wraps the query in `USERELATIONSHIP`. The common real-world bug, confirmed by heavy forum traffic on inactive-relationship date filtering, is an inactive relationship that no measure ever activates: it sits there, the author wires a date or visual to it expecting filtering, and gets either an unfiltered result or the active relationship's behavior. Treat an inactive relationship with zero `USERELATIONSHIP` references as a defect, the inverse of "missing relationship."

Cross-reference in one pass: list inactive relationships with `FILTER(INFO.VIEW.RELATIONSHIPS(), NOT [IsActive])`, then `te find "USERELATIONSHIP" --in expressions --paths-only`. Any inactive relationship whose columns never appear in a `USERELATIONSHIP` call is dead weight or a latent bug ; either a measure is missing, the relationship should be deleted, or (role-playing case) the dimension should have been duplicated per role with its own active relationship. Duplicate the physical dimension per role unless simultaneous multi-role filtering is genuinely needed; the shared-table-plus-inactive pattern forces a `USERELATIONSHIP` wrapper into every measure and breaks Q&A/Copilot, which cannot inject one. `USERELATIONSHIP` on an RLS-bearing relationship is blocked; relocate the filter instead.

Sources: learn.microsoft.com desktop-relationships-understand (make-this-relationship-active); learn.microsoft.com relationships-active-inactive; local forums DB (inactive-relationship date-filter threads); repo te-cli semantic-modeling-practices
