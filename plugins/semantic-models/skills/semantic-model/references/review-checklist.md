# Review checklist

Companion to the `semantic-model` skill (SKILL.md). The full audit workflow and per-category checks. Drives inspection through the te-cli-first cascade; produces prioritized, actionable findings rather than a pass/fail.

**Working with `te`:** gather context with `scripts/get_model_info.py`; inspect with `te load`, `te ls Measures`, `te query -q "EVALUATE INFO.VIEW.RELATIONSHIPS()"`, and `te vertipaq --columns --detail`; gate findings with `te validate` and `te bpa run --fail-on error`.

## Workflow

### Step 0: gather context
Run `scripts/get_model_info.py -w <workspace-id> -m <model-id>` for storage mode, model size, connected reports, deployment pipeline, endorsement, sensitivity label, data sources, refresh schedule, last refresh, capacity SKU. Then ask the user: what business process the model serves; who consumes it (report developers, analysts, executives, Copilot/AI); whether they own the model, the reports, or both; whether it is in dev, test, or production; and where findings should be documented. Severity shifts with context: a model for three analysts is judged differently from one Copilot queries org-wide.

### Step 1: inspect structure
Read the model with the cascade. `te load ./model` for a summary, `te ls Measures` / `te ls Tables`, `te query -q "EVALUATE INFO.VIEW.RELATIONSHIPS()"` for relationships (`te ls` cannot enumerate them), `te vertipaq --columns --detail` for size. Drop to `connect-pbid` for traces and storage DMVs when the endpoint is unreachable from `te`.

### Step 2: audit by category
Walk the categories below; each links to the topic reference with the mechanics and the fix.

### Step 3: performance
Query-level timing, unused-column detection, and memory analysis in `performance.md`; model-size diagnosis in `vertipaq-optimization.md`.

### Step 4: report findings
Produce a markdown report: a count-by-severity summary, detailed findings with object paths and line numbers, a specific remediation per finding, and a prioritized action list (critical first).

## Categories

### Critical
- Bidirectional relationships creating ambiguous filter paths, and circular dependencies between tables (`relationships.md`)
- Missing data types on columns; orphaned tables with no relationship
- Fail-open RLS (`IF(..., TRUE())` fall-through) and limited relationships that silently drop unmatched rows (`security.md`, `relationships.md`)

### Memory and size (`vertipaq-optimization.md`)
- High-cardinality dictionaries (GUIDs, transaction IDs, composite keys); unsplit DateTime columns
- `isAvailableInMDX` left on hidden or high-cardinality columns (wasted attribute-hierarchy memory)
- Auto date/time tables (hidden `LocalDateTable_*`); wrong data types (Double for currency, String for numeric)
- Calculated columns that should be measures (`dax-authoring.md`); unused columns or tables

### Data reduction
- Fact history with no date-range filter or incremental refresh (`incremental-refresh.md`)
- Columns not needed for reporting or calculations; detail grain finer than any report needs; logic better done upstream

### DAX correctness (`dax-authoring.md`; for query tuning use the `dax` skill)
- Filtering whole tables instead of columns in CALCULATE; unguarded division (`DIVIDE` vs bare `/`)
- Context-blind calculated columns using CALCULATE; variable time-shift bugs

### Measure hygiene
- Implicit measures where explicit measures should exist; report-scoped extension measures that belong in the model; ambiguous duplicate measure names

### Documentation and AI (`ai-copilot-readiness.md`, `metadata-and-organization.md`)
- Tables/columns/measures missing descriptions (Copilot truncates after 200 characters; front-load keywords)
- Missing display folders; missing synonyms; inconsistent naming (use `standardize-naming-conventions`)

### Design (`dimensional-modeling.md`, `relationships.md`, `time-intelligence.md`)
- Star-schema violations (fact-to-fact joins, snowflakes); many-to-many without a bridge
- Date table not correctly marked for the relationship column type; dead inactive relationships (no `USERELATIONSHIP`)
- Multiple facts on the same dimension via different keys without a conformed dimension

### Direct Lake, if applicable (`direct-lake.md`)
- Non-unique one-side relationship keys (queries fail at runtime, not refresh); DirectQuery fallback risk (RLS, SQL views)
- Calculated columns on Direct Lake tables; Delta health (Parquet file count, V-Order, guardrails)

## Notes
- The structural audit reads metadata; it does not execute report DAX or check data quality
- For companion report review, use the `review-report` skill (reports plugin)
