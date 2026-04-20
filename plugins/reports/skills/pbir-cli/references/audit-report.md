# Report Audit Checklist

Systematic audit workflow for providing critical feedback and improvement recommendations on Power BI reports.

## 1. Find and Connect to the Report

```bash
pbir ls                                          # Find all reports
pbir connect "Report.Report"                     # Set active connection
pbir tree "Report.Report" -v                     # Full overview
```

## 2. Check Report Format

Is it PBIX, PBIP, or PBIR metadata only? PBIP or PBIR formats work better with source control and make changes visible.

```bash
pbir ls                                          # Shows format in parentheses: (pbip), (pbir), (pbix)
pbir get "Report.Report"                         # Report properties
```

## 3. Check Model Connection

```bash
pbir model "Report.Report"                       # Workspace, model name, ID, thick/thin
pbir model "Report.Report" -d                    # Model tables, columns, measures
```

## 4. Check Report-Level Configuration

### Theme Assessment

Is there a custom theme or the default? Default Power BI themes are poor quality. A custom theme is the simplest way to improve a report. If the report has default theme + bespoke visual formatting, recommend pushing formatting into the theme.

```bash
pbir theme colors "Report.Report"                # Color palette with visual usage audit
pbir theme text-classes "Report.Report"          # Text style definitions
pbir theme fonts "Report.Report"                 # Font usage
pbir theme validate "Report.Report"              # Theme structure
pbir visuals format "Report.Report/Page.Page/Visual.Visual"  # Check theme cascade vs overrides
```

### Atypical Report Settings

Check for disabled export, restricted filter types, cross-report drillthrough, personalize visuals, etc.

```bash
pbir get "Report.Report"                         # Report properties
pbir report json "Report.Report"                 # Full report.json for detailed settings
```

## 5. Check Pages and Contents

### Page Count

Typically, reports with >5-7 pages can be split into multiple focused reports, unless pages are hidden or aesthetic. Blank pages without visuals or background images should be removed.

```bash
pbir ls "Report.Report"                          # List all pages with visual counts
pbir tree "Report.Report"                        # Pages and visual counts
```

### Visual Density

Pages with >12-15 visuals have performance and UX issues.

```bash
pbir tree "Report.Report"                        # Shows visual count per page
```

### Hidden Visuals

Hidden visuals are problematic -- they still execute queries against the model, degrading performance, but are invisible to users. Hidden slicers are especially dangerous: they apply filters silently, causing confusion when data appears filtered with no visible cause. Flag all hidden visuals and recommend removing or replacing them with report/page-level filters.

### Hidden Fields

Fields bound to a visual can have `hidden: true` in their query projection -- the field participates in the query but is not displayed. This is a legitimate pattern when visual calculations depend on the field (e.g., a date field needed for PREVIOUS but not shown as a column). However, hidden fields left behind after visual redesigns waste query resources. `pbir validate` catches these as `HIDDEN_FIELDS` warnings. Investigate each to confirm the field is intentionally hidden for a visual calculation, not just forgotten.

```bash
pbir validate "Report.Report"                    # Reports HIDDEN_FIELDS issues
```

### Orphaned Fields (Visual Type Changes)

When a visual's type is changed (e.g., bar chart to card), the old query state and data role bindings may persist in the JSON even though the new visual type does not use those roles. These orphaned fields generate unnecessary queries. Spot-check with `pbir cat` -- if the visual JSON contains roles or projections that don't exist for the current visual type, the fields are orphaned and should be removed.

```bash
pbir cat "Report.Report/Page.Page/Visual.Visual"  # Inspect raw JSON for stale roles
pbir visuals bind "Report.Report/Page.Page/Visual.Visual" --show  # Compare bound fields to expected roles
pbir schema containers "card"                      # Check what roles the visual type actually supports
```

## 6. Check Report Extensions

### Extension Measures

Thin-report measures are acceptable for bespoke formatting or report-specific logic. However, general business logic should be promoted to the semantic model. Report-level measures have governance issues.

```bash
pbir dax measures list "Report.Report"           # List all extension measures
pbir dax measures json "Report.Report"           # Full DAX expressions
pbir cat "Report.Report/reportExtensions"        # Raw reportExtensions.json
```

### Visual Calculations

Visual calculations can be beneficial for single visuals and performance, but are difficult to manage. Sometimes better as model measures.

```bash
pbir dax viscalcs list "Report.Report"           # List visual calculations
```

## 7. Check Filters and Slicers

### Slicer Overuse

Slicers take up valuable real estate. Only use for critical, simple selections. Too many slicers creates inefficient UX.

```bash
# Count slicers
pbir find "Report.Report/**/*slicer*.Visual" --count
pbir find "Report.Report/**/*Slicer*.Visual" --count
```

### Unsynchronized Slicers Across Pages

When multiple pages have slicers on the same field, users expect them to stay in sync. If they don't, selecting "2024" on one page and navigating to another shows unfiltered data -- confusing and error-prone. Compare slicer fields across pages to find mismatches. Prefer report-level filters for fields that should filter consistently across all pages.

### Report and Page-Level Filters

Hidden filters can create confusion. Be aware of filter values to explain possible data issues.

```bash
pbir filters list "Report.Report"                # All filters with paths/levels
pbir filters json "Report.Report"                # Full filter JSON (see hidden/locked status)
```

### Visual-Level Filters

Visual-level filters are generally bad practice -- users cannot see them and developers forget about them.

### Slicer Interactions

Check for slicers not interacting with other visuals -- often unintentional and confusing for users.

```bash
pbir pages interactions "Report.Report/Page.Page"  # List visual interactions on page
```

## 8. Check Sort Order

Visuals without an explicit sort order default to alphabetical or insertion order, which is almost never correct. Charts and tables should sort by the primary measure descending, unless a natural order exists (time ascending, ordinal categories).

```bash
# Set sort on a visual
pbir visuals sort "Visual.Visual" -f "Sales.Revenue" -d Descending
```

## 9. Check Visual Layouts

### Equal Spacing and Sizing

Simple equal spacing ensures an organized look.

```bash
# Check visual positions and sizes
pbir cat "Report.Report/Page.Page"               # Page JSON with all positions
```

### 3-30-300 Rule

Low-detail, important visuals at top-left. Detailed visuals at bottom-right. KPIs/Cards should show actionable metrics with target comparison and trend context. Limit to <5 per page.

```bash
pbir tree "Report.Report" -v                     # Visual types and field bindings
```

### Excessive Tables

Large tables/matrixes with too many columns cause cognitive load and performance issues.

### Pie/Donut Charts

Pie and donut charts with >3-7 categories are generally ineffective. Consider bar charts instead.

## 10. Check Visual Formatting

### Color Overuse

Color should be used sparingly to steer attention. Too much color creates cognitive burden.

```bash
pbir theme colors "Report.Report"                # Color palette with usage counts
```

### Color Quality

Colors should be muted and subtle, not loud and vibrant. Colors should come from the theme (dataThemeColors or sentiment colors like "good"/"bad"), not bespoke in visuals.

```bash
pbir theme colors "Report.Report"                # See theme palette
pbir visuals format "Report.Report/Page.Page/Visual.Visual"  # Check for hardcoded colors
```

### Drop Shadows

Drop shadows create accessibility issues (vestibular disabilities). Replace with flat layout + sufficient background contrast.

### Intentional Color Use

Implicit colors (green/red) should have appropriate meaning. Categorical colors should not be too similar.

```bash
pbir theme colors "Report.Report"                # Check sentiment colors
```

### Excessive Formatting

Overly formatted visuals with too many conditional elements or customization can be suboptimal.

```bash
pbir get "Report.Report/Page.Page/Visual.Visual.**.cf"       # Check conditional formatting
pbir visuals format "Report.Report/Page.Page/Visual.Visual"  # Full formatting breakdown
```
