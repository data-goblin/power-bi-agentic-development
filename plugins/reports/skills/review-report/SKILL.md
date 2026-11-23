---
name: review-report
description: Use when the user asks to review, audit or health-check an existing Power BI report, decide whether a report is used or should be retired, or assess its structure, performance, accessibility, governance or distribution ("review this report", "is this report being used", "who has access", "find unused reports", "report health check"). Runs pbir validation, BPA, usage and access first and interprets the output. Not for building reports (create-pbi-report) or reviewing semantic models.
---

# Reviewing a Power BI report

The output is a prioritised list of findings with concrete fixes. Run the deterministic checks first; your job is to interpret them, not to re-derive what a rule already reports. Command rules are in `pbir-cli`, design judgement in `pbi-report-design`.

## Rules

1. **Branch on lifecycle stage before choosing dimensions.** Ask (or infer from a local-only folder): development, testing or production. Development: structure, bindings, performance, accessibility. Testing: add whether testers are actually viewing. Production: add usage, distribution and exports. Usage data exists only for published reports; if the report is local-only, ask where the published copy is.
2. **Run first, then judge**, from the report folder:

   ```bash
   pbir validate "R.Report" --all
   pbir bpa run "R.Report" --fail-on warning -o json
   pbir ls "R.Report" --tree -v
   pbir usage "R.Report"
   pbir access "R.Report"
   ```

   `bpa` already covers overlaps, off-canvas visuals, missing alt text, hard-coded colours, default theme and page names, hidden visuals, visual-level filters, too many pages and non-standard fonts; do not hand-check those. `usage` and `access` need `az login` and a published report.
3. **You cannot see the canvas.** Say that aesthetics, cognitive load and effectiveness are unverified until a screenshot is looked at ([render verification](../../wiki/pbir-render-verification.md)).
4. **Usage is the only objective signal of value, and it is easy to misread.** Views are not subscriptions, page views are a floor, the window is 30 days, and non-consumers (developers, service principals, IT) inflate reach: [interpreting usage](../../wiki/report-usage-interpretation.md). Never recommend retiring from one 30-day "no views" signal, and require the owner to confirm.
5. **No fixed thresholds** for "healthy" usage, load time or visual count. They depend on audience and purpose; Learn publishes none. Visual count is a proxy for query cost ([performance audit](../../wiki/report-performance-audit.md)).
6. **Ask before `pbir usage --model`**: it generates a hidden model in the workspace and needs Contributor.
7. **R and Python visuals retire in May 2027** (they stop working in published reports). Report every one found as "replace", never as something to improve; see [custom visual choice](../../wiki/report-custom-visual-choice.md).

## Dimensions

```yaml
usage and adoption:  pbir usage; wiki report-usage-sources, report-usage-interpretation
design and layout:   bpa and validate --qa first; judgement from pbi-report-design
model binding:       validate --fields; thin report vs thick; extension measures used sparingly
performance:         pbir visuals test and visuals query; wiki report-performance-audit
governance:          pbir access; endorsement, label, pipeline, publish to web: wiki report-governance-audit
accessibility:       bpa PBIR_NO_ALT_TEXT, validate --qa; wiki report-accessibility-audit
documentation:       purpose, audience, atypical features, support contact (handover reports)
```

Scope to what the user needs; not every review covers every dimension. If the model is in scope, review it with the `semantic-models` skills in parallel: many report symptoms (slow visuals, blanks, missing fields) start there.

## Findings format

```
REPORT REVIEW: <name>   stage: development | testing | production
USAGE SIGNAL            views 30d, viewers (consumers only), rank, top pages, load P50 / P90 (or "not assessable: <why>")
CRITICAL                broken functionality, security exposure, unused report consuming capacity
HIGH                    performance that hurts users, missing bindings, major design violations
MEDIUM                  inconsistencies, partial accessibility gaps
LOW                     polish
```

Give each finding a path (page and visual) and a command or pattern to fix it. Lead with the most impactful ones.

## Related skills

- `pbir-cli`, `pbi-report-design`, `modifying-theme-json`
- `custom-visuals` plugin: review criteria for Deneb and SVG visuals (`claude plugin install custom-visuals@power-bi-agentic-development`)
