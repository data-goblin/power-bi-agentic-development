---
name: create-pbi-report
version: 0.22.3
description: Step-by-step workflow for creating complete Power BI reports from scratch using pbir CLI. Covers model discovery, report creation, page layout, theme setup, visual placement, field binding, filtering, formatting, validation, and publishing. Automatically invoke when the user asks to "create a new report", "build a report from scratch", "make a dashboard", "set up a report with KPIs", "create an executive dashboard", "add pages and visuals to a new report".
---

# Creating Power BI Reports

Create and scaffold Power BI reports using `pbir` CLI. Install with `uv tool install pbir-cli` or `pip install pbir-cli`. Load the `pbir-cli` and `pbi-report-design` skills alongside this one.

## Vague or Underspecified Prompts

When the user's request lacks specific measures, audience context, structural preferences, or formatting direction (e.g., "make me a dashboard", "create something with KPIs"), consult **`references/vague-prompts.md`** before proceeding. Close the gap between intent and specification with targeted questions; then apply sensible defaults (sqlbi theme, executive dashboard pattern, model-driven KPI selection) for anything the user can't or won't specify.

## Rules

- Visuals must not overlap one another
- Favor theme changes over visual overrides for static formatting
- Favor extension measures with theme colors (like "bad") for conditional formatting
- Always create reports inside a named project folder (e.g., `sales-dashboard/Sales.Report`)
- Run `pbir validate` after every mutation
- New reports already include the **sqlbi** theme -- do NOT run `pbir theme apply-template` unless the user explicitly asks for a different theme
- New reports already include a default **Page 1** with a **textbox** visual for the page title at position (20,20) with height 90 -- do NOT add a new textbox; rename the existing page with `pbir pages rename` instead. **Place all visuals at y:120 or below** to avoid overlapping the title textbox.

## Quick Reference

1. Get the workspace and semantic model from the user. If the user wants to connect to Power BI Desktop or create a report with source data, explain that a published semantic model in Fabric or Power BI is required first.
2. Analyze the user's requirements. Consider missing information -- charts, filters, formatting, analyses. Use `AskUserQuestion` if something is unclear.
3. Consider missing semantic model objects -- not just what the user asks for, but targets (1 year prior), baselines (avg for period), or trend aggregations (14-day rolling) that enrich visuals.
4. Create a project folder and report (default format is PBIP):

    ```bash
    mkdir -p /path/to/report-name
    cd /path/to/report-name
    pbir new report "Name.Report" -c "Workspace/Model.SemanticModel"
    ```

5. Rename the default page (do NOT add a new page unless the report needs multiple pages): `pbir pages rename "Name.Report/Page 1.Page" "Overview"`
6. Only if the user requests a custom theme: `pbir theme apply-template "Name.Report" template-name` (the sqlbi theme is already included by default)
7. Discover model fields: `pbir model "Name.Report" -d`
8. Query field values for filters or formatting: `pbir model "Name.Report" -q "EVALUATE VALUES('Table'[Column])"`
9. Inspect field data types: `pbir model "Name.Report" -d -t Table`
10. Add visuals (the page already has a textbox for the title): `pbir add visual kpi "Name.Report/Overview.Page" --title "Revenue"`
11. Validate: `pbir validate "Name.Report"`
12. Publish: `pbir publish "Name.Report" "Workspace.Workspace/Name.Report"`
13. Open in Fabric after publish: `pbir publish "Name.Report" "Workspace.Workspace/Name.Report" -o`
14. Or open locally in Power BI Desktop: `pbir open "Name.Report"`

## Step-by-Step Process

### Step 1: Understand the Business Process

Before creating visuals, explore the semantic model to understand the domain. Use `pbir model "Report.Report" -d` to inspect tables, columns, measures, and hierarchies. Consider:

- What domain does this model cover? (sales, finance, operations, logistics, etc.)
- What KPIs and measures matter most?
- What dimensions and hierarchies exist for slicing data?
- What time granularity makes sense? (daily, weekly, monthly, quarterly)

Present a concrete proposal via `AskUserQuestion` before building anything. The proposal should include:

- Which KPI cards to show and what measures they display
- What trend chart(s) to include and at what time granularity
- Which categorical breakdowns are most insightful
- What detail table/matrix to provide and with what hierarchies
- How filters should scope the data

Iterate on the design before executing -- revising a plan is cheaper than rebuilding visuals.

### Step 2: Identify Location and Connection

Determine where to create the report and what model it connects to. Use `AskUserQuestion` to understand the report's purpose, audience, and what decisions it should support.

```bash
pbir model                                       # List all known reports/models
pbir connect MyWorkspace MyReport                # Set active connection
```

If the user provides a workspace location, create the report locally in a project folder, then publish.

### Step 3: Create the Report

Create a project folder first, then the report inside it. Default format is PBIP.

```bash
mkdir -p sales-dashboard && cd sales-dashboard
pbir new report "Sales.Report" -c "MyWorkspace/Sales.SemanticModel"
```

The resulting structure:

```
sales-dashboard/
  Sales.Report/
    definition/
      pages/
      report.json
    StaticResources/
    definition.pbir
  Sales.pbip
```

### Step 4: Rename Default Page and Add More Pages

The report comes with a default "Page 1" that already has a textbox for the page title. Rename it rather than creating a new page. Only add additional pages if needed.

```bash
pbir pages rename "Sales.Report/Page 1.Page" "Overview"          # Rename default page
pbir add page "Sales.Report/Detail.Page" -n "Detail"              # Add extra pages only if needed
pbir pages active-page "Sales.Report" "Overview"
```

### Step 5: Configure Theme (only if user requests)

The sqlbi theme is already included by default. Only modify the theme if the user explicitly asks for a different theme or custom colors.

```bash
# Only if user wants a different theme:
pbir theme apply-template "Sales.Report" custom-theme

# Or to customize specific colors:
pbir theme set-colors "Sales.Report" --good "#00B050" --bad "#FF0000"
pbir theme set-text-classes "Sales.Report" title --font-size 16
pbir theme set-formatting "Sales.Report" "card.*.border.radius" --value 8
```

### Step 6: Add Visuals to Pages

Check actual page dimensions first -- do not assume 1280x720. Use `pbir pages json "Report.Report/Page.Page"` to verify. The object model validates that visuals fit within page bounds.

Fill the canvas with a purposeful visual hierarchy. Standard composition for a 1280x720 page:

- **Row 1 (y: 20-160): KPI visuals** -- 2-3 `kpi` visuals showing headline metrics with targets and trend lines
- **Row 2 (y: 180-460): Trend + Breakdown** -- Line/area chart (~60% width) + bar/column chart (~40% width)
- **Row 3 (y: 480-700): Detail table/matrix** -- Full-width `tableEx` or `matrix` with hierarchies and conditional formatting

For a complete layout example with exact coordinates, spacing verification, and visual commands, consult **`references/layout-example.md`**.

Key principles:

- **Consistent spacing**: Calculate positions from `(margin, gap, page_width, page_height)`. For 1280x720 with margin=24, gap=16, usable width = 1232. Verify arithmetic before placing visuals.
- **No redundant titles**: Page title = subject ("Order Lines"), visual titles = differentiator ("by Key Account", "Monthly Trend"). Hide subtitles: `pbir visuals subtitle "path" --no-show`
- **Sorting**: Charts auto-sort descending by first measure. After `pbir visuals bind`, set sort explicitly: `pbir visuals sort "path" -f "Table.Measure" -d Descending`

### Step 7: Add Filters

```bash
pbir add filter Date Year -r "Sales.Report" --values 2025
pbir add filter Geography Region -r "Sales.Report"
pbir add filter Products Category -p "Sales.Report/Detail.Page"
```

### Step 8: Format Visuals

Most formatting should come from the theme (Step 5). Apply bespoke formatting only for genuinely one-off cases.

```bash
# Bulk formatting via glob (requires -f for glob patterns)
pbir set "Sales.Report/**/*.Visual.title.show" --value true -f
pbir set "Sales.Report/**/*.Visual.border.show" --value true -f

# Individual visual formatting
pbir visuals title "Sales.Report/Overview.Page/Revenue.Visual" --fontSize 14 --bold
pbir visuals background "Sales.Report/Overview.Page/Revenue.Visual" --color "#F8F9FA"
```

### Step 9: Validate

```bash
pbir validate "Sales.Report"
pbir tree "Sales.Report" -v
```

### Step 10: Publish or Open

```bash
pbir publish "Sales.Report" "MyWorkspace.Workspace/Sales.Report"      # Publish
pbir publish "Sales.Report" "MyWorkspace.Workspace/Sales.Report" -o   # Publish and open in browser
pbir open "Sales.Report"                                               # Open in Power BI Desktop
```

## Common Report Patterns

### Executive Dashboard

- 2-3 KPI cards at top (revenue, orders, margin)
- 1 trend line/area chart (monthly if yearly filter, daily/weekly if monthly)
- 1-2 breakdown charts (bar/column) by key categories
- 1 detail table or matrix with hierarchies and conditional formatting
- Page size: 1280x720 (16:9)

### Detailed Analysis

- Slicer bar at top (date range, category filters)
- Large table or matrix as main content with conditional formatting
- Supporting KPI cards for context
- Page size: 1280x720 or 1920x1080

### Tooltip Pages

- Small page (320x240 or similar)
- 2-3 focused visuals
- Set via `pbir pages type "path" --type tooltip`

## Reference Files

- **`references/vague-prompts.md`** -- Handling underspecified prompts: targeted questions, sensible defaults, propose-before-building workflow
- **`references/layout-example.md`** -- Complete layout with coordinates, spacing verification, time granularity table
