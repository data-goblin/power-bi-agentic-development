---
name: dax
version: 0.22.3
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
- **[`references/model-optimization.md`](./references/model-optimization.md)** — Tier 3 model patterns (MDL001–MDL010) + Tier 4 Direct Lake (DL001–DL002)

Trace capture and performance profiling:

- **Local models (Power BI Desktop):** Use the [`connect-pbid` skill](../../../pbi-desktop/skills/connect-pbid/) — specifically `performance-profiling.md` for FE/SE timing and `evaluateandlog-debugging.md` for intermediate result inspection.
- **Remote models (Fabric Service / XMLA):** Use the [`powerbi-modeling-mcp`](https://marketplace.visualstudio.com/items?itemName=analysis-services.powerbi-modeling-mcp) VS Code extension for trace and query operations. Install: `code --install-extension analysis-services.powerbi-modeling-mcp`

## Related Skills

- [`review-semantic-model`](../review-semantic-model/) — Model auditing including DAX anti-patterns and best practices
- [`connect-pbid` (pbi-desktop plugin)](../../../pbi-desktop/skills/connect-pbid/) — Trace capture, performance profiling, EVALUATEANDLOG debugging
- [`lineage-analysis`](../lineage-analysis/) — Impact analysis before model changes
