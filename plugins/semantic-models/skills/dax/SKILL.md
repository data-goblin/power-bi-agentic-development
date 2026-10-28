---
name: dax
description: DAX performance optimization for semantic models. Automatically invoke when the user asks to "optimize DAX", "fix slow DAX", "DAX performance", "tune a measure", "debug a measure", "DAX anti-patterns", or mentions slow queries, server timings, or DAX authoring.
---

# DAX

Skills and references for writing, debugging, and optimizing DAX in semantic models.

## Object references

Write column references as `'Table'[Column]`: the table name is always present and always in single quotes. Write measure references as `[Measure]`, never prefixed with a table. This applies everywhere DAX or model metadata names an object: measure, calculated column and calculation item expressions, RLS filters, format string expressions, DAX queries (`te query`, `pbir model -q`), and descriptions or annotations that mention an object.

Why: a measure belongs to the model rather than to its home table, so moving it between tables must not change any expression that uses it; a bare `[Measure]` also tells the reader at a glance that it is a measure and not a column. An unqualified column is ambiguous as soon as two tables share a column name, and quoting every table name keeps one consistent form whether or not the name needs quotes.

## Optimization

For systematic DAX query performance optimization, read the workflow reference first:

**[`references/dax-performance-optimization.md`](./references/dax-performance-optimization.md)** — Tiered framework (4 tiers), phased workflow, decision guide, and error handling.

Detailed reference files (progressive disclosure — consult as directed by the workflow):

- **[`references/engine-internals.md`](./references/engine-internals.md)** — FE/SE architecture, xmSQL, compression/segments, SE fusion, trace diagnostics
- **[`references/dax-patterns.md`](./references/dax-patterns.md)** — Tier 1 DAX patterns (DAX001–DAX021) + Tier 2 query structure (QRY001–QRY004)
- **[`references/model-optimization.md`](./references/model-optimization.md)** — Tier 3 model patterns (MDL001–MDL009) + Tier 4 Direct Lake (DL001–DL002)

Trace capture and performance profiling:

- **Local models (Power BI Desktop):** Use the Tabular Editor CLI `te query` (see the [`te-cli` skill](../../../tabular-editor/skills/te-cli/)) first; as an alternative, the [`connect-pbid` skill](../../../pbi-desktop/skills/connect-pbid/) covers FE/SE timing (`performance-profiling.md`) and intermediate result inspection (`evaluateandlog-debugging.md`).
- **Remote models (Fabric Service / XMLA):** Run DAX with the Tabular Editor CLI `te query` (`-s <workspace> -d <model>`) against the workspace XMLA endpoint; see the [`te-cli` skill](../../../tabular-editor/skills/te-cli/) (tabular-editor plugin).
- **Power BI Modeling MCP:** also available for trace and query if you prefer an MCP tool; reach for it after the options above.

## User-defined functions

- **[`references/udf-authoring.md`](./references/udf-authoring.md)** — UDF signatures, the parameter type system, VAL versus EXPR evaluation, type checks, patterns and testing

## Related Skills

- [`semantic-model`](../semantic-model/) — Model design, build, and auditing including DAX anti-patterns and best practices
- [`connect-pbid` (pbi-desktop plugin)](../../../pbi-desktop/skills/connect-pbid/) — Trace capture, performance profiling, EVALUATEANDLOG debugging
- [`lineage-analysis`](../lineage-analysis/) — Impact analysis before model changes
