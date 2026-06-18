---
name: semantic-model
version: 26.25
description: This skill should be used whenever the user mentions a "semantic model", "data model", or "dataset", or asks to "build", "model", "design", "optimize", "review", or "audit" one, or to "add a measure", "add a relationship", "create a role" / "set up RLS", "add a calculation group", "set up incremental refresh", "fix a star schema", "reduce model size", "prepare a model for Copilot / AI", or "check model quality". Covers the full lifecycle (design, build, refresh, review) and drives every operation through the `te` CLI first, then TOM (connect-pbid) or a model MCP, then TMDL authoring (the tmdl skill). Not for report visuals (use pbir-cli) or isolated DAX query tuning (use the dax skill).
---

# Semantic models: design, build, refresh, review

Guidance for designing, building, refreshing, and reviewing Power BI / Analysis Services tabular models from the terminal. It consolidates model review with modeling best practices, and routes every change to the narrowest capable tool. Depth lives in `references/`; this file is the operating loop and the routing.

## When to use

- Designing or building a model: star schema, relationships, measures, calculation groups, roles, parameters, storage modes, incremental refresh
- Optimizing a model: size / VertiPaq, DAX correctness, Direct Lake, refresh cost
- Reviewing or auditing a model against quality, performance, and best-practice standards
- Preparing a model for Copilot / AI consumption

## When NOT to use

- Editing report visuals, pages, or formatting: use the `pbir-cli` skill (reports plugin)
- Isolated DAX query performance tuning: use the `dax` skill
- TMDL file syntax mechanics: use the `tmdl` skill (this skill routes to it for the file-edit fallback)
- The `te` command surface itself: the `te-cli` skill (tabular-editor plugin) is the command reference; this skill is the modeling judgment layered on top

## Tool cascade (the core operating rule)

Reach for the narrowest capable tool, in order. Most edits never leave step 1.

1. **`te` CLI first.** One verb per operation, staged in memory until `--save`, with a save-time DAX + referential-integrity gate. Covers add/set/rm/mv for measures, columns, relationships (`Sales[K]->Dim[K]` shorthand on `te add`), roles + RLS filters, calculation groups / items, incremental-refresh policy, `te format`, `te bpa`, `te vertipaq`, `te query`. Each Bash call is a fresh shell, so pass `-m <model>` (and `-s`/`-d` for remote) on every command, or set `TE_SESSION`. Read the real object's settable surface first with `te get <obj>` and `te set <obj> -q <prop>` (no value). The `te-cli` skill is the full command reference.
2. **TOM, or a model MCP, when `te` cannot reach a property.** Some properties are absent from `te set -q` (for example `alternateOf`, `securityFilteringBehavior`, `crossFilteringBehavior`, KPI sub-objects, linguistic-schema content, calendar objects). Drive these through a `te script` C# pass (in-process TOM), or the `connect-pbid` skill (PowerShell + TOM/ADOMD against a live local Desktop instance, and the only route to traces: `EVALUATEANDLOG`, aggregation-hit events, storage DMVs). The Power BI Modeling MCP server is also available if you prefer an MCP. The local Desktop proxy cannot reach Direct Lake; use a remote XMLA endpoint there.
3. **`fab` + direct TMDL last, with the `tmdl` skill.** Service- and file-shape operations with no model-edit verb: assigning Entra principals to roles (workspace-side, not in `.tmdl`), report-to-model binding, Copilot-folder features (AI instructions, AI data schema, verified answers), Lakehouse / Delta reshaping behind Direct Lake, and bulk structural surgery that is cleaner as one TMDL diff than N `te` calls. Author the TMDL with the `tmdl` skill, then run `te validate`.

Ordering gate: add relationships before any measure that uses `RELATED()` or a cross-table `CALCULATE()`, or the save gate fails with `DAX0002` (no relationship in context).

## Lifecycle

### Design
Model dimensionally: a star of fact plus conformed dimensions beats snowflakes and fact-to-fact joins. Decide storage mode and refresh strategy before building; both are near one-way doors once published. See `references/dimensional-modeling.md`, `references/storage-modes.md`, `references/composite-models.md`, and `references/direct-lake.md`.

### Build
Make each change through the cascade above. Author measures with full metadata (DisplayFolder, FormatString, Description) in one pass. Validate after every mutation (`te validate`) and gate on BPA (`te bpa run --fail-on error`). Renaming or moving any object can silently break downstream reports and models; run the lineage check first, then propagate with `pbir-cli` / `fabric-cli` (see `references/refactoring-renaming.md`). Deep guidance per area: `references/relationships.md`, `references/time-intelligence.md`, `references/calculation-groups.md`, `references/parameters.md`, `references/security.md`, `references/dax-authoring.md`.

### Refresh
Configure incremental refresh from the terminal (`te incremental-refresh`); for Direct Lake, the refresh is the framing. See `references/incremental-refresh.md`, and the `refresh-semantic-model` skill for monitoring and troubleshooting.

### Review
Audit against the categories below and produce prioritized findings with file locations. Gather context first with `scripts/get_model_info.py` (storage mode, size, connected reports, endorsement, data sources, refresh schedule). Full checklist in `references/review-checklist.md`; performance method in `references/performance.md`.

## Review categories (by severity)

- **Critical**: bidirectional ambiguity, circular dependencies, missing data types, orphaned tables, fail-open RLS, limited relationships that silently drop rows
- **Memory & size**: high-cardinality dictionaries, auto attribute hierarchies (`isAvailableInMDX` on hidden / high-cardinality columns), unsplit DateTime, auto date/time tables, wrong data types, calc columns that should be measures, unused objects
- **Data reduction**: unfiltered fact history (no incremental refresh), unnecessary columns, detail grain not needed for reporting, logic better pushed upstream
- **DAX correctness**: filtering tables not columns in CALCULATE, unguarded division, context-blind calc columns, variable time-shift bugs (`references/dax-authoring.md`; for query tuning use the `dax` skill)
- **Measure hygiene**: implicit measures, report-scoped measures that belong in the model, ambiguous duplicates
- **Documentation & AI**: missing descriptions (Copilot truncates after 200 characters), missing display folders, missing synonyms, inconsistent naming (use `standardize-naming-conventions`)
- **Design**: star-schema violations, mis-marked date table, many-to-many without a bridge, dead inactive relationships
- **Direct Lake**: non-unique one-side keys (queries fail at runtime), DirectQuery fallback, calc columns on Direct Lake, Delta guardrail breaches

## Related skills

- `tmdl`: TMDL file authoring (the cascade's step-3 fallback)
- `dax`: DAX query performance optimization
- `connect-pbid`: TOM / ADOMD via PowerShell against a live Desktop instance; traces; the TOM / MCP tier
- `te-cli`: the `te` command reference
- `c-sharp-scripting`: TOM C# scripts and macros (`te script`) for properties `te` cannot reach
- `standardize-naming-conventions`: naming audit and remediation
- `refresh-semantic-model`: refresh monitoring and troubleshooting
- `lineage-analysis`: artifact lineage (downstream reports and models that consume this model, across workspaces); distinct from intra-model object dependencies
- `bpa-rules` (tabular-editor): authoring BPA rules; `fabric-cli`: service / workspace operations

## Reference map

```yaml
references/dimensional-modeling.md:    star schema, SCD2, junk / degenerate dimensions, header-detail, bridges
references/relationships.md:           cardinality, limited relationships, ambiguity, active / inactive, USERELATIONSHIP
references/time-intelligence.md:       classic vs calendar TI, mark-as-date traps, week-based / 4-4-5
references/calculation-groups.md:      precedence, sideways recursion, selection expressions, the variant trap
references/parameters.md:              field parameters, what-if parameters, dynamic titles
references/security.md:                RLS validation + defensive filters, bidirectional + RLS, OLS restrictions
references/query-semantic-model.md:    querying a model with DAX, INFO functions, output formats, probing
references/storage-modes.md:           Import / DirectQuery / Dual / Hybrid decision matrix
references/composite-models.md:        source groups, regular vs limited, Direct-Lake-plus-Import
references/aggregations.md:            user-defined aggregations, grain, te-script AlternateOf
references/direct-lake.md:             OneLake vs SQL, framing, DirectQuery fallback, guardrails
references/incremental-refresh.md:     IR policy, detect data changes, hybrid / real-time, refresh strategy
references/vertipaq-optimization.md:   VPA metrics, value vs hash encoding, splitting high-cardinality keys
references/dax-authoring.md:           variable semantics, DIVIDE, measure vs calc column (gaps vs the dax skill)
references/ai-copilot-readiness.md:    the Copilot grounding contract, synonyms / linguistic schema, descriptions, Q&A retirement
references/metadata-and-organization.md: descriptions, display folders, naming, measure tables, perspectives
references/hierarchies-cultures.md:    user hierarchies, parent-child, KPIs, perspectives, cultures / translations
references/documentation-and-bpa.md:    data dictionary, BPA documentation gate, metadata diffs, intra-model impact analysis (artifact lineage = the lineage-analysis skill)
references/refactoring-renaming.md:    safe rename workflow (lineage check first, then propagate via pbir-cli / fabric-cli)
references/review-checklist.md:        full audit checklist with remediation
references/performance.md:             performance testing, unused-column detection, memory analysis
scripts/get_model_info.py:             model metadata overview (mode, size, reports, endorsement, sources, refresh)
```

## What this skill deliberately leaves out

- GUI-tool walkthroughs and the old review skill's "use whatever tool is available" framing: superseded by the te-cli-first cascade
- Hand-authored Q&A phrasings: Q&A is being retired and Copilot does not read phrasings; invest in synonyms and descriptions
- Perspectives or display folders presented as security: both are queryable by anyone with model access; use RLS / OLS
- The PBIT format: out of scope
