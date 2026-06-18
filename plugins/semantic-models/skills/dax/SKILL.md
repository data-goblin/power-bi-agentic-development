---
name: dax
version: 26.25
description: DAX performance optimization for semantic models. Automatically invoke when the user asks to "optimize DAX", "fix slow DAX", "DAX performance", "tune a measure", "debug a measure", "DAX anti-patterns", or mentions slow queries, server timings, or DAX authoring.
---

# DAX

Skills and references for writing, debugging, and optimizing DAX in semantic models.

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

## Related Skills

- [`semantic-model`](../semantic-model/) — Model design, build, and auditing including DAX anti-patterns and best practices
- [`connect-pbid` (pbi-desktop plugin)](../../../pbi-desktop/skills/connect-pbid/) — Trace capture, performance profiling, EVALUATEANDLOG debugging
- [`lineage-analysis`](../lineage-analysis/) — Impact analysis before model changes
