---
name: review-semantic-model
version: 0.22.3
description: Review, audit, and validate Power BI semantic models against quality, performance, and best practice standards. Automatically invoke when the user asks to "review a semantic model", "audit a semantic model", "check model quality", "optimize my model", "validate model design", "check AI readiness", "prepare model for Copilot", or mentions model validation or quality assessment.
---

Warning: This skill is incomplete and still in progress, but may provide value already as-is -- Kurt

# Reviewing Semantic Models

Structured evaluation of Power BI semantic models against quality, performance, and best practice standards. Produces actionable findings with prioritized recommendations.

## Review Workflow

### Step 0: Gather Context

Before analyzing TMDL, collect metadata and understand the business context.

**Run the model info script:**

```bash
python3 scripts/get_model_info.py -w <workspace-id> -m <model-id>
```

This returns: storage mode, model size, connected reports, deployment pipeline, endorsement status, sensitivity label, data sources, refresh schedule, last refresh, and capacity SKU.

**Ask the user:**

- What business process does this model represent?
- Who are the primary consumers? (report developers, analysts, executives, AI/Copilot users?)
- Are they the developer of both the model and its reports, or only one?
- Is the model in development, testing, or production?
- Where should findings be documented? (scratchpad, agent-docs, wiki, etc.)

Understanding the business context is critical. A model for 3 analysts has different requirements than one consumed by Copilot across the organization. The audit categories and their severity shift based on this context.

### Step 1: Analyze Model Structure

Inspect the model definition to evaluate its structure. The approach depends on available tooling -- use whatever is available to read the model's tables, columns, measures, relationships, and expressions. Do not prescribe a specific tool; common options include Tabular Editor, the `te-cli`, `fab export` to TMDL, or programmatic access via APIs.

### Step 2: Audit Categories

Evaluate findings across categories, ordered by severity:

**Critical**
- Bidirectional relationships (ambiguity risk)
- Circular dependencies between tables
- Missing data types on columns
- Tables without relationships (orphaned)

**Memory and Size**
- High-cardinality columns with large dictionaries (GUIDs, transaction IDs, composite keys)
- IsAvailableInMdx enabled on hidden or high-cardinality columns (wastes memory on attribute hierarchies unused by DAX; disable for columns not consumed via Analyze in Excel / MDX)
- Unsplit DateTime columns (near-unique precision creating massive dictionaries)
- Auto Date/Time tables (hidden LocalDateTable_* bloating memory)
- Inappropriate data types (Double for currency, String for numeric)
- Calculated columns that could be measures
- Unused columns or tables (no references in measures or visuals or other downstream items)

**Data Reduction**
- Unfiltered history in fact tables (no date-range filter or incremental refresh)
- Columns that aren't necessary for reporting or calculations or consumption
- Pre-summarization opportunities (detail grain not needed for reporting)
- Columns better handled upstream (i.e. calculations not done in calc columns or PQ)

**DAX Anti-Patterns** (for systematic DAX query optimization, use the [`dax` skill](../dax/))
- Filtering tables instead of columns in CALCULATE (causes both correctness and performance issues)
- Unhandled division by zero (use DIVIDE() or explicit zero-check; note: plain `/` is fine when the denominator is guaranteed non-zero and can be faster)
- Iterators with callbacks or nested iterators over large tables (use aggregators like SUM/AVERAGE when possible; iterators over large tables are fine if the expression is Storage Engine-pushable)
- Missing KEEPFILTERS around non-equality filter predicates in CALCULATE

**Measure Hygiene**
- Implicit measures used where explicit measures should exist
- Report-scoped extension measures that should be model-level
- Duplicate or overlapping measures with ambiguous names

**Documentation**
- Tables or columns missing descriptions
- Missing display folders for measures
- Inconsistent naming conventions (use the `standardize-naming-conventions` skill)

**Design**
- Star schema violations (direct fact-to-fact relationships, snowflake patterns)
- Missing or misconfigured date table: must be marked (`dataCategory: Time` in TMDL, with a key Date column), have continuous daily dates (no gaps), span the full range of fact data, and relate to fact tables via a single-column relationship. Missing any of these causes time intelligence functions (DATEADD, SAMEPERIODLASTYEAR, TOTALYTD) to return BLANK
- Excessive columns per table (>30 suggests denormalization issues)
- Many-to-many relationships without bridging tables
- Multiple fact tables relating to the same dimension via different keys without a shared conformed dimension (causes slicers on one fact to not filter the other)
- Inactive relationships without corresponding USERELATIONSHIP in measures (orphaned relationships that suggest incomplete modeling)

**Direct Lake (if applicable)**
- Delta table health (parquet file count, V-Order, row group sizes)
- DirectQuery fallback risk (RLS definitions, SQL endpoint views)

**AI and Copilot Readiness** (see `references/ai-readiness.md`)
- Duplicate field names across tables (confuses Copilot/data agents)
- Missing AI instructions
- Missing or inadequate descriptions for AI consumption
- Complex patterns (disconnected tables, many-to-many, inactive relationships) are valid model design but AI may struggle with them

### Step 3: Performance Analysis

For performance-specific analysis, see `references/performance.md`.

### Step 4: Report Findings

Produce a structured markdown report with:

- Summary table of finding counts by severity
- Detailed findings with file locations and line numbers where possible
- Specific remediation recommendations for each finding
- Prioritized action list (critical first)

## Using the Semantic Model Reviewer Agent

Dispatch the `semantic-model-auditor` agent to perform the structural audit. The agent handles export, analysis, and reporting autonomously.

## Notes

- The structural audit analyzes model metadata -- it does not execute DAX queries or check data quality
- For DAX query performance testing, see `references/performance.md`
- For DAX optimization, use the [`dax` skill](../dax/)
- For companion report review, use the `review-report` skill in the reports plugin

## References

- **`references/ai-readiness.md`** -- Copilot/Data Agent preparation: AI instructions, descriptions, schema, verified answers
- **`references/performance.md`** -- Performance testing methodology, unused column detection, memory analysis
- **`scripts/get_model_info.py`** -- Quick model metadata overview (storage mode, size, reports, pipeline, endorsement, data sources)

## Related Skills

- **[`dax`](../dax/)** -- DAX performance optimization
- **`review-report`** (reports plugin) -- Companion skill for report-level review
- **`standardize-naming-conventions`** -- Naming audit and remediation
- **`lineage-analysis`** -- Downstream report discovery
- **`refreshing-semantic-model`** -- Refresh monitoring and troubleshooting
