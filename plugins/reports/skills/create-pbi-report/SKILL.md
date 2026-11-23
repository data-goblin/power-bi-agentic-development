---
name: create-pbi-report
description: Use when the user asks to build a new Power BI report, dashboard or report page from a published semantic model with pbir ("create a report", "make a dashboard", "executive dashboard with KPIs", "add pages and visuals to a new report"). Owns the new-report workflow end to end. Not for editing or reviewing an existing report (use pbir-cli or review-report) and not for semantic-model changes.
---

# Creating a Power BI report

This skill owns the new-report flow; `pbir-cli` holds command rules, `pbi-report-design` holds design judgement. Load both. Install pbir with `uv tool install pbir-cli`.

## Rules

1. A report needs a **published semantic model** in Fabric or Power BI. A model that exists only in Desktop must be published first.
2. A new report already carries the **sqlbi theme** and a **Page 1 with a title textbox** (x 20, y 20, 1240x90, page 1280x720). Rename the page with `pbir pages rename ... --to ... -f`; do not add a second page or textbox for the title; do not run `pbir theme apply-template` unless the user asks for another theme. Start content at **y 120**. A page added with `pbir add page` gets its own 480x120 title textbox, so start at y 140 there, or pass `--no-title`.
3. **Never guess fields.** `pbir model "R.Report" -d` for the schema and `pbir model "R.Report" -q "EVALUATE VALUES('T'[C])"` for values; role names per visual type from `pbir schema roles <type>`.
4. **Theme first** for static formatting; extension measures returning theme tokens for conditional formatting ([conditional formatting](../../wiki/pbir-conditional-formatting.md)).
5. **Visuals must not overlap and must stay on the canvas**: `pbir add visual` refuses both unless `-f`; confirm with `pbir validate --qa`.
6. **Extension measures** need `-d` and a `-t` table that already exists in the model ([extension measures](../../wiki/pbir-extension-measures.md)).
7. Create the report inside its own project folder, validate after each coherent batch, and **ask before publishing**, to a sandbox workspace first.

## Workflow

1. **Inputs.** Workspace and model from the user. If the request is vague ("make me a dashboard"), propose a concrete default from the model (KPIs, one trend, one breakdown, one detail table, filters) and ask the user to approve or change it; revising a plan is cheaper than rebuilding visuals.
2. **Brief.** Write down audience, the two to five decisions the report supports, one stated intent per page, the targets or baselines each KPI needs, and the delivery target. A KPI without a target needs the user's choice (prior year, budget, rolling average); add the missing measure to the model rather than faking it in the report. Route design choices (identity, layout, colour) to `pbi-report-design`.
3. **Create.**

   ```bash
   mkdir -p sales-dashboard && cd sales-dashboard
   pbir new report "Sales.Report" -c "Workspace/Model.SemanticModel"
   pbir pages rename "Sales.Report/Page 1.Page" --to "Overview" -f
   pbir add page "Sales.Report/Detail.Page" -n "Detail"
   pbir pages active-page "Sales.Report" "Overview"
   ```

4. **Place visuals** from `pbir get "Sales.Report/Overview.Page.width"` and the page height, not from memory. On a 1280x720 page with a 20 px margin and a 16 px gap this layout passes `pbir validate --qa` (no overlap, no undersized visual):

   ```yaml
   row 1 (headline numbers): y 120, h 140; four cardVisual, w 298, x 20 / 334 / 648 / 962
   row 2 (trend, split):     y 276, h 200; line chart x 20 w 734; bar chart x 770 w 490
   row 3 (detail):           y 492, h 208; table or matrix x 20 w 1240
   ```

   QA flags `kpi` below 290x200 and `cardVisual` below 290x140, so a KPI with goal and trend line needs a taller row than the numbers above.

   ```bash
   pbir add visual cardVisual "Sales.Report/Overview.Page" --title "Revenue" \
     -d "Data:Sales.Revenue" --x 20 --y 120 --width 298 --height 140
   pbir visuals sort "Sales.Report/Overview.Page/Chart.Visual" -f "Sales.Revenue" -d Descending
   ```

   Set the sort explicitly after binding. Page title names the subject, visual titles name the differentiator; hide redundant subtitles (`pbir visuals subtitle ... --no-show`). A tooltip page is `pbir pages set-tooltip "Sales.Report/Tip.Page"`.
5. **Interactivity.** Apply query reduction when the page has slicers or heavy visuals, wire cross-filter exceptions, prefer a `pageNavigator` visual, build a reset button from a Data-scoped bookmark, collapse near-duplicate visuals with field parameters: [interactivity](../../wiki/report-interactivity.md).
6. **Filters and slicers.** `pbir add filter Date Year -r "Sales.Report" --values 2025`; page and visual scope with `-p` and `-v`.
7. **Dynamic titles and conditional colour** are extension measures: `SELECTEDVALUE` with a fallback, text and colour measures kept separate, literal title cleared first.
8. **Validate and look.** `pbir validate "Sales.Report" --all`, `pbir bpa run "Sales.Report" --fail-on error`, then render ([render verification](../../wiki/pbir-render-verification.md)): `pbir open "Sales.Report"` for Desktop on Windows, else publish to a sandbox with `pbir publish "Sales.Report" "Sandbox.Workspace/Sales.Report" -o`.

## Tell the user what pbir cannot do

- It works on report metadata only; it cannot drive Power BI Desktop off Windows
- Legacy single-file reports (`report.json`) must be upgraded to PBIR in Desktop first
- It cannot add an AppSource visual without its id; offer a native visual, Deneb or an SVG measure (`custom-visuals` plugin). Do not offer R or Python visuals: they retire in May 2027

## Related skills

- `pbir-cli`, `pbi-report-design`, `modifying-theme-json`
- `custom-visuals` plugin: `deneb-visuals`, `svg-visuals`
- Scoring an agent's report with a gate and a 0-2 rubric in `claude plugin eval`: [wiki/report-eval-gate-and-rubric.md](../../wiki/report-eval-gate-and-rubric.md)
