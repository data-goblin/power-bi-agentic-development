---
name: dax
version: 0.21.0
description: Write, debug, and optimize DAX in semantic models. Automatically invoke when the user asks to "write DAX", "optimize DAX", "fix slow DAX", "DAX performance", "tune a measure", "debug a measure", "DAX anti-patterns", or mentions slow queries, server timings, or DAX authoring.
---

# DAX

Skills and references for writing, debugging, and optimizing DAX in semantic models.

## Optimization

For systematic DAX query performance optimization, read the full reference before starting:

**[`references/dax-performance-optimization.md`](./references/dax-performance-optimization.md)** — Tiered framework (4 tiers), phased workflow, engine internals (FE/SE, xmSQL, fusion), trace diagnostics, and pattern catalog (DAX001–DL002).

For trace capture and performance profiling, use the [`connect-pbid` skill](../../pbi-desktop/skills/connect-pbid/) — specifically `performance-profiling.md` for FE/SE timing and `evaluateandlog-debugging.md` for intermediate result inspection.

## Related Skills

- [`review-semantic-model`](../review-semantic-model/) — Model auditing including DAX anti-patterns and best practices
- [`connect-pbid` (pbi-desktop plugin)](../../pbi-desktop/skills/connect-pbid/) — Trace capture, performance profiling, EVALUATEANDLOG debugging
- [`lineage-analysis`](../lineage-analysis/) — Impact analysis before model changes
