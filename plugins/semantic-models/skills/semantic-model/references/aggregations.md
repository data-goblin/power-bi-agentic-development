# User-defined aggregations

Companion to the `semantic-model` skill (SKILL.md). Original guidance; each section cites its sources.

**Working with `te`:** build the agg table with `te`-native verbs (`te add table`, hide columns), then map `AlternateOf` via `te script` (TOM) since `te set -q` does not expose it. Audit the >= 10x grain ratio with `te query`; confirm cache hits via a trace (connect-pbid / DAX Studio), not `te query` alone.

## The cascade decision rule and the user-defined-aggregation example

A triage rule before any modeling edit, so the agent reaches for the narrowest capable tool instead of defaulting to TMDL text-editing (re-implementing what `te` does atomically and losing the save-time DAX/RI gate). The full mapping is the **Tool cascade** in SKILL.md; the operational anchors: most ops have one `te` verb; ops with no `te -q` (user-defined aggregations / `AlternateOf`, OLS `metadataPermission` if rejected, relationship `crossFilteringBehavior`/`securityFilteringBehavior`, KPI sub-objects, calendar objects, linguistic metadata) drop to `te script` TOM; service/file-shape ops (Entra role membership, report binding, Copilot folder, Lakehouse reshaping, bulk TMDL surgery) go to fab + TMDL.

User-defined aggregations are the textbook `te script` escape hatch: build the agg table and hide it with `te`-native verbs, then map columns via TOM (`new TOM.AlternateOf { Summarization = TOM.SummarizationType.Sum, BaseColumn = ... }`), then `te validate`. The agg is a hidden coarser-grain pre-aggregate of a large DQ detail table that the engine transparently rewrites qualifying subqueries to; keep it at least ~10x fewer rows than its detail or maintenance outweighs the speedup, and strip high-cardinality attributes from the GroupBy set. Relationship-based aggs (the agg relates to the same dimensions) make GroupBy entries optional except DISTINCTCOUNT, which needs an explicit GroupBy on the key; GroupBy-based aggs (denormalized, no relationships) require them or the agg never hits. RLS must filter both agg and detail or the engine refuses to answer from the agg; `detailTable` must be DirectQuery and must point at the real detail (chained aggregations are illegal); hybrid tables and Direct Lake (either flavor) do not support user-defined aggregations (pre-aggregate in the Lakehouse instead).

Sources: repo te-cli command-reference / gotchas / SKILL / semantic-modeling-practices; learn.microsoft.com aggregations-advanced / SummarizationType; learn.microsoft.com composite-model-guidance; learn.microsoft.com aggregations-auto
