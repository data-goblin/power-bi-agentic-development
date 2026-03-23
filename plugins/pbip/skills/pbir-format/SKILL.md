---
name: pbir-format
description: "This skill should be used when the user asks about 'PBIR format', 'PBIR JSON structure', 'what does this visual.json property mean', 'how do PBIR expressions work', 'objects vs visualContainerObjects', 'theme inheritance', 'conditional formatting pattern', 'extension measures', 'visual container formatting', 'how to create a visual in PBIR', 'PBIR page structure', 'visual.json format', 'PBIR sorting', 'report wallpaper', 'filter formatting', 'PBIR bookmarks', 'definition.pbir', 'query roles', 'field references in PBIR', or needs to understand Power BI Enhanced Report metadata format idiosyncrasies. This is a format reference for understanding and authoring PBIR JSON schemas and patterns."
---

# PBIR Format Reference

Skill that teaches Claude about the Power BI Enhanced Report (PBIR) JSON format to read and use it. Doesn't support legacy `report.json` or `layout` report metadata. To convert from legacy to PBIR format, users have to open and save their reports in Power BI Desktop.

**WARNING:** The PBIR format is brittle and easily corrupted. You should prefer to modify the PBIR files via the `pbir` command-line tool, because it has special tools and features to avoid breaking the report files. Only fall back to direct modification of the JSON files if the user explicitly requests it or if `pbir` is not available.

## General, critical guidance

- **Check examples:** Check [examples](./examples/) for a valid report
- **Take a backup:** Make a copy of the report before modifying it
- **PBIX vs PBIP vs PBIR:** So long as report metadata is in PBIR format, you can work with any of these formats. PBIX is just a zip file; unzip and rezip to work with it. You shouldn't work with PBIT (Power BI Template) file types. Note that PBIP and PBIX contain PBIR, but you can also have a "thin" report that is PBIR only.
- **Validate often:** Any time you change a JSON file you **must** validate it *IMMEDIATELY* after the modification to avoid "breaking" changes with `<claude put code here>`
- **Valid JSON vs. Rendering JSON:** Just because something is valid JSON doesn't mean it will render. A visual might not render if the bound field is invalid (missing, wrong table, or misspelled) in the visual.json, if the visual elements are cropped by their container, if a model performance issue causes the dax query to time out, if a model data quality issue results in (Blank) or empty values, etc. You can use tools like the chrome or chrome devTools MCP server to check whether a visual rendered if the report was published to Power BI, but it's often faster to just ask the user to check in Power BI Desktop or the browser.
- **Hierarchical formatting cascade:** In Power BI reports, formatting is determined by the following order of operations: defaults --> Theme wildcards (*) --> Theme visualTypes --> bespoke visual.json configuration. Theme overwrites defaults, visualType overrides wildcards in themes, and visual.json overrides all theme formatting. It's preferable to put as much of the formatting in the theme as possible over bespoke visual.json formatting because then changes only need to happen in one place
- **PBIR files are strict JSON:** No comments allowed

## Report Structure

```
Report.Report/
+-- .pbi/localSettings.json                # Local-only, gitignored
+-- .platform                              # Fabric Git integration
+-- definition.pbir                        # Semantic model connection (byPath or byConnection) can open this file in Power BI Desktop to open the report
+-- mobileState.json                       # Mobile layout (niche)
+-- semanticModelDiagramLayout.json        # Model diagrams
+-- CustomVisuals/                         # Private custom visuals only
+-- definition/
|   +-- version.json                       # REQUIRED -- PBIR version
|   +-- report.json                        # REQUIRED -- report-level config, including theme, report filters, settings
|   +-- reportExtensions.json              # Extension measures and visual calculations (report- and visual-level DAX)
|   +-- pages/
|   |   +-- pages.json                     # Page order, active page
|   |   +-- [PageName]/                    # Letters, digits, underscores, hyphens ONLY
|   |       +-- page.json                  # Page-level properties, including size, background, filters
|   |       +-- visuals/
|   |           +-- [VisualName]/
|   |               +-- visual.json        # Visual config, formatting, and field data bindings <-- most important and complex file for report dev and formatting
|   |               +-- mobile.json        # Mobile formatting of the visual (niche)
|   +-- bookmarks/                         # Bookmarks are a bad practice and should be avoided if possible!
|       +-- bookmarks.json                 # Bookmark order and groups
|       +-- [id].bookmark.json             # Individual bookmark state containing a snapshot of the report basically
+-- StaticResources/
    +-- RegisteredResources/               # Custom themes, images
        +-- [ThemeName].json               # Custom theme <-- second most important and complex file for formatting
    +-- SharedResources/BaseThemes/        # Microsoft base themes
```

## Rules

### Modifying a report

1. First start by understanding the user's request. Ask questions if necessary and make sure you understand the context of their ask. Focus on the business process, and don't be afraid to push the user for additional information about the users, the report, the model, or the business. This information should all be in function of the report.
2. Explore the report efficiently to get a sense of its contents and where's-what.
3. Check the connected semantic model. Ideally the report is a thin-report with `byConnection`. If that's the case you can use the `fab`, `pbir`, or `te` command-line tools to explore the model. If those aren't available, you can use an MCP server. If it's `byPath` then you might be able to connect to and query the local model open in Power BI Desktop. Understanding the model helps you to know what fields are available for visuals and the business logic of calculations (in DAX expressions).
4. Find the appropriate visuals and pages that you need to modify. You might have to ask the user for clarification.
5. Plan the modifications ensuring that you know the appropriate structure and values
6. Validate the JSON files that you change IMMEDIATELY after changing them. Revise if necessary

### Creating a report

1. Same as the above, except you need to generate the appropriate files _de novo_ from scratch. You have to be careful to not miss anything; the best way to do this is just with the `pbir new` command if the `pbir` CLI is available. If not, then check the example reports thoroughly.
2. You have to make sure that the `definition.pbir` is set properly.
3. You should use a theme.json file. We recommend [the example theme from SQLBI and Data Goblins](./examples/K201-MonthSlicer.Report/StaticResources/RegisteredResources/SqlbiDataGoblinTheme.json).
4. Proceed as normal, validating each time you add a new JSON file.
5. Make sure that you add the appropriate filters to the `report.json` or `page.json`; see [the filter pane for more information](references/filter-pane.md)

## Expression Syntax

All formatting values in visual.json / page.json use `expr` wrappers with type-specific suffixes. Theme JSON uses bare values instead.

| Type | Syntax | Notes |
|------|--------|-------|
| String | `{"expr": {"Literal": {"Value": "'smooth'"}}}` | Inner single quotes required |
| Double | `{"expr": {"Literal": {"Value": "14D"}}}` | `D` suffix -- most common for font sizes, percentages |
| Integer | `{"expr": {"Literal": {"Value": "14L"}}}` | `L` suffix -- pixel counts, enum values |
| Decimal | `{"expr": {"Literal": {"Value": "2.4M"}}}` | `M` suffix -- money/decimal precision |
| Boolean | `{"expr": {"Literal": {"Value": "true"}}}` | Lowercase, no quotes, no suffix |
| DateTime | `{"expr": {"Literal": {"Value": "datetime'2024-01-15T00:00:00.000000"}}}` | Single-quoted datetime string |
| Color (hex) | `{"expr": {"Literal": {"Value": "'#FF0000'"}}}` | Inner single quotes; 6-digit RGB or 8-digit ARGB |
| Null | `{"expr": {"Literal": {"Value": "null"}}}` | Lowercase, no quotes, no suffix |
| Theme color | `{"expr": {"ThemeDataColor": {"ColorId": 0, "Percent": 0}}}` | Percent: -1.0 (darker) to 1.0 (lighter), 0 = exact |
| Extension measure | `{"expr": {"Measure": {"Expression": {"SourceRef": {"Schema": "extension", "Entity": "_Fmt"}}, "Property": "Color"}}}` | `"Schema": "extension"` required |

Both `D` and `L` work for whole numbers. Use `D` for font sizes and floating-point contexts, `L` for integer-only contexts (pixel counts, ComparisonKind values).

**Gotchas:** `transparency` uses `D` normally but `L` inside `dropShadow`. `labelPrecision` always uses `L` but `labelDisplayUnits` always uses `D`.

**String escaping:** Single quotes within string literals are doubled: `"'here''s some text'"`. Font families with fallback chains use triple-quote escaping: `"'''Segoe UI Semibold'', helvetica, sans-serif'"`.

**Filter SourceRef gotcha:** In filter `Where` conditions, SourceRef uses `"Source": "alias"` (referencing the alias defined in `From`), NOT `"Entity"`. This differs from query projections which use `"Entity"`.

## Field Reference Patterns

Six patterns for referencing fields in queries and expressions:

| Pattern | Syntax |
|---------|--------|
| Column | `{"Column": {"Expression": {"SourceRef": {"Entity": "Table"}}, "Property": "Column"}}` |
| Measure (model) | `{"Measure": {"Expression": {"SourceRef": {"Entity": "Table"}}, "Property": "Measure"}}` |
| Measure (extension) | `{"Measure": {"Expression": {"SourceRef": {"Schema": "extension", "Entity": "Table"}}, "Property": "Measure"}}` |
| Aggregation | `{"Aggregation": {"Expression": {"Column": {"Expression": {"SourceRef": {"Entity": "Table"}}, "Property": "Col"}}, "Function": 0}}` |
| Hierarchy level | `{"HierarchyLevel": {"Expression": {"Hierarchy": {"Expression": {"SourceRef": {"Entity": "Table"}}, "Hierarchy": "Name"}}, "Level": "Level"}}` |
| SparklineData | `{"SparklineData": {"Measure": {"Measure": {...}}, "Groupings": [{"Column": {...}}]}}` |

**Aggregation function codes:** 0=SUM, 1=AVG, 2=COUNT, 3=MIN, 4=MAX, 5=DISTINCTCOUNT

## Query Roles by Visual Type

| Visual Type | Query Roles |
|-------------|-------------|
| card | Values |
| cardVisual (new card) | Data |
| tableEx | Values |
| slicer | Values |
| advancedSlicerVisual | Values |
| pieChart | Category, Y |
| lineChart | Category, Y (also Y2 for combo) |
| areaChart / stackedAreaChart | Category, Y |
| clusteredBarChart | Category, Y |
| clusteredColumnChart | Category, Y |
| pivotTable | Rows, Columns, Values |
| kpi | Indicator, Goal, Goals, TrendLine |
| scatterChart | Category, X, Y, Size, Tooltips |
| textbox | (none -- uses objects.general.paragraphs) |
| shape / actionButton | (none -- uses objects for shape/icon config) |
| scriptVisual | Values |

### Projection Properties

Each projection in `queryState` supports:

| Property | Description |
|----------|-------------|
| `queryRef` | Fully qualified reference (`Table.Field`) -- used internally |
| `nativeQueryRef` | Display label shown in visual |
| `displayName` | Override display name (optional) |
| `active` | Whether hierarchy level is expanded (optional, boolean) |

## Visual Position

```json
"position": {"x": 100, "y": 50, "z": 1000, "width": 400, "height": 300, "tabOrder": 0}
```

- `x`, `y` -- top-left corner in pixels (can be fractional)
- `z` -- layer order (higher = front); common values: 0, 1000, 2000, 3000, 5000, 8000, 15000
- `tabOrder` -- keyboard navigation order (optional; can differ from z)

## objects vs visualContainerObjects

Both live inside `visual` (not root level of visual.json):

- **`objects`** -- Visual-specific: dataPoint, legend, categoryAxis, valueAxis, dataLabels, lineStyles, plotArea
- **`visualContainerObjects`** -- Container: title, subTitle, background, border, dropShadow, padding, divider, visualHeader, visualTooltip

Putting container properties in `objects` silently fails. Putting `visualContainerObjects` at root level errors.

**Schema version matters:** Schemas 2.1.0-2.2.0 use `objects` for everything (including container properties). Schema 2.4.0+ splits them into `objects` and `visualContainerObjects`. Both are found in the wild.

## Conditional Formatting Patterns

Three distinct patterns:

1. **Measure-based** -- DAX measure returns a color string directly via extension measure reference
2. **FillRule (gradient)** -- Maps numeric values to color gradients (`linearGradient2` with min/max, or `linearGradient3` with min/mid/max). Uses `nullColoringStrategy` with `'asZero'` or `'specificColor'`.
3. **Conditional (rule-based)** -- Explicit comparison conditions with `ComparisonKind` (0=Equal, 1=GreaterThan, 2=GreaterThanOrEqual, 3=LessThanOrEqual, 4=LessThan). Cases evaluated in order; first match wins. Optional `DefaultValue`.

Per-point formatting (e.g. per-bar colors) requires a two-entry array with `matchingOption: 1`. A single-entry array or `matchingOption: 0` applies the same value to all points.

### Selector Types

| Type | Syntax | Purpose |
|------|--------|---------|
| (none) | No `selector` key | Applies to entire visual |
| metadata | `{"metadata": "Sales.Revenue"}` | Specific column/measure |
| id | `{"id": "default"}` | Named instance (also: `"selection:selected"`, `"interaction:hover"`, `"interaction:press"`) |
| dataViewWildcard | `{"data": [{"dataViewWildcard": {"matchingOption": 1}}]}` | Per-point formatting |
| scopeId | `{"data": [{"scopeId": {"Comparison": {...}}}]}` | Specific data point value |

matchingOption: `0` = identities + totals, `1` = per data point, `2` = totals only. Selectors can be combined.

## Theme Inheritance

Formatting resolves in order (least to most specific):

1. Base theme (`SharedResources/BaseThemes/<name>.json`)
2. Custom theme (`RegisteredResources/<name>.json`) -- overrides base
3. Theme wildcard `visualStyles["*"]["*"]` -- applies to all visuals
4. Theme visual-type specific `visualStyles["textbox"]["*"]` -- overrides wildcard
5. Visual instance `objects` / `visualContainerObjects` in visual.json -- overrides theme

Many "formatting bugs" are actually theme issues. Before making formatting changes, always check the theme first.

**Theme JSON uses bare values** (`"fontSize": 12`). **PBIR visual.json uses expr wrappers** (`"fontSize": {"expr": {"Literal": {"Value": "12D"}}}`).

## Visual Creation Rules

1. Pages: 1280x720 px (default)
2. Page and visual folder names: letters, digits, underscores, hyphens ONLY (no spaces). Note: Power BI Desktop can produce folders with spaces or `.Page`/`.Visual` suffixes -- these work but aren't recommended for programmatic creation
3. Visuals must not overlap; use even spacing
4. All fields must exist in semantic model or `reportExtensions.json`
5. Each page must have a title (textbox visual)
6. Prefer font size 14 (expressed as `"14D"` in JSON) or larger for readability at 1920x1080
7. Include `altText` in `visualContainerObjects.general` for WCAG 2.1
8. Use theme colors (`ThemeDataColor`) over hex literals; hex literals are acceptable as fallback for colors not in the theme

## definition.pbir

A report must be connected to a semantic model. There are two ways to do this:

- **byPath** -- Local PBIP reference/thick report: `{"byPath": {"path": "../Model.SemanticModel"}}` (schema 1.0.0 or 2.0.0)
- **byConnection** -- Remote/thin report: `{"byConnection": {"connectionString": "Data Source=powerbi://..."}}` (schema 2.0.0)

## Related Skills

- **`pbip`** -- PBIP project operations: rename cascades, project forking, report JSON patterns
- **`tmdl`** -- TMDL file format, authoring, and editing

## References

**Examples:**
- **`examples/K201-MonthSlicer.Report/`** -- Real PBIR report with 7 visual types (slicer, advancedSlicerVisual, kpi, lineChart, scatterChart, tableEx, textbox), extension measures, bookmarks, conditional formatting

**Structure & schemas:**
- **`references/pbir-structure.md`** -- PBIR folder structure details
- **`references/schemas.md`** -- Schema versions and URLs
- **`references/enumerations.md`** -- Valid property enumerations
- **`references/version-json.md`** -- version.json format (concise)
- **`references/platform.md`** -- .platform file format (concise)
- **`references/bookmarks.md`** -- Bookmark structure and state snapshots

**Formatting & expressions:**
- **`references/schema-patterns/`** -- Expressions, selectors, conditional formatting, visual calculations
- **`references/visual-container-formatting.md`** -- objects vs visualContainerObjects deep-dive
- **`references/theme.md`** -- Theme wildcards, inheritance, and color system
- **`references/measures-vs-literals.md`** -- When to use measure expressions vs literal values
- **`references/measures.md`** -- Extension measure patterns

**Visual & page configuration:**
- **`references/textbox.md`** -- Textbox visual format
- **`references/page.md`** -- Page configuration and backgrounds
- **`references/report.md`** -- Report-level settings
- **`references/wallpaper.md`** -- Report wallpaper/canvas background
- **`references/filter-pane.md`** -- Filter pane formatting
- **`references/sort-visuals.md`** -- Visual sort configuration
- **`references/images.md`** -- Static images, base64 in themes, SVG measures
- **`references/report-extensions.md`** -- reportExtensions.json format

**Semantic model integration:**
- **`references/semantic-model/`** -- Field references, model structure, report rebinding, query inference

**How-to guides:**
- **`references/how-to/`** -- Advanced conditional formatting, SVG in visuals
