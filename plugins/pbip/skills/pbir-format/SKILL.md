---
name: pbir-format
description: "This skill should be used when the user asks about 'PBIR format', 'PBIR JSON structure', 'what does this visual.json property mean', 'how do PBIR expressions work', 'objects vs visualContainerObjects', 'theme inheritance', 'conditional formatting pattern', 'extension measures', 'visual container formatting', 'how to create a visual in PBIR', 'PBIR page structure', 'visual.json format', 'PBIR sorting', 'report wallpaper', 'filter formatting', 'PBIR bookmarks', 'definition.pbir', 'query roles', 'field references in PBIR', or needs to understand Power BI Enhanced Report metadata format idiosyncrasies. This is a format reference for understanding and authoring PBIR JSON schemas and patterns."
---

# PBIR Format Reference

Reference for Power BI Enhanced Report (PBIR) JSON format -- structure, expression syntax, formatting patterns, and schema rules.

**PBIR files are strict JSON -- no comments allowed (not JSONC/JSONL).**

## Report Structure

```
Report.Report/
+-- .pbi/localSettings.json                # Local-only, gitignored
+-- .platform                              # Fabric Git integration
+-- definition.pbir                        # Semantic model connection (byPath or byConnection)
+-- mobileState.json                       # Mobile layout (no external editing)
+-- semanticModelDiagramLayout.json        # Model diagrams (no external editing)
+-- CustomVisuals/                         # Private custom visuals only
+-- definition/
|   +-- version.json                       # REQUIRED -- PBIR version (e.g. "1.6.0")
|   +-- report.json                        # REQUIRED -- theme, report filters, settings
|   +-- reportExtensions.json              # OPTIONAL -- extension measures (report-level DAX)
|   +-- pages/
|   |   +-- pages.json                     # Page order, active page
|   |   +-- [PageName]/                    # Letters, digits, underscores, hyphens ONLY
|   |       +-- page.json                  # Page size, background, filters
|   |       +-- visuals/
|   |           +-- [VisualName]/
|   |               +-- visual.json        # Visual config and formatting
|   |               +-- mobile.json        # Mobile layout (optional)
|   +-- bookmarks/                         # OPTIONAL
|       +-- bookmarks.json                 # Bookmark order and groups
|       +-- [id].bookmark.json             # Individual bookmark state
+-- StaticResources/
    +-- RegisteredResources/               # Custom themes, images
    +-- SharedResources/BaseThemes/        # Microsoft base themes
```

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
| scatterChart | Category, X, Y, Size |
| textbox | (none -- uses objects.general.paragraphs) |
| shape / actionButton | (none -- uses objects for shape/icon config) |
| scriptVisual | Values |

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
2. Page and visual folder names: letters, digits, underscores, hyphens ONLY (no spaces -- hard requirement per MS docs)
3. Visuals must not overlap; use even spacing
4. All fields must exist in semantic model or `reportExtensions.json`
5. Each page must have a title (textbox visual)
6. Prefer font size 14 (expressed as `"14D"` in JSON) or larger for readability at 1920x1080
7. Include `altText` in `visualContainerObjects.general` for WCAG 2.1
8. Use theme colors (`ThemeDataColor`) over hex literals; hex literals are acceptable as fallback for colors not in the theme

## definition.pbir Variants

Two reference types for connecting to semantic models:

- **byPath** -- Local PBIP reference: `{"byPath": {"path": "../Model.SemanticModel"}}` (schema 1.0.0 or 2.0.0)
- **byConnection** -- Remote/thin report: `{"byConnection": {"connectionString": "Data Source=powerbi://..."}}` (schema 2.0.0)

## Related Skills

- **`pbip`** -- PBIP project operations: rename cascades, project forking, report JSON patterns
- **`tmdl`** -- TMDL file format, authoring, and editing

## References

**Structure & schemas:**
- **`references/pbir-structure.md`** -- PBIR folder structure details
- **`references/schemas.md`** -- Schema versions and URLs
- **`references/json-structure/`** -- Per-file format docs (definition.pbir, report.json, reportExtensions.json, page.json, visual.json)
- **`references/enumerations.md`** -- Valid property enumerations

**Formatting & expressions:**
- **`references/schema-patterns/`** -- Expressions, selectors, conditional formatting, visual calculations
- **`references/visual-container-formatting.md`** -- objects vs visualContainerObjects deep-dive
- **`references/theme.md`** -- Theme wildcards, inheritance, and color system
- **`references/measures-vs-literals.md`** -- When to use measure expressions vs literal values
- **`references/extension-measures.md`** -- Extension measure patterns

**Visual & page configuration:**
- **`references/textbox.md`** -- Textbox visual format
- **`references/page.md`** -- Page configuration and backgrounds
- **`references/report.md`** -- Report-level settings
- **`references/wallpaper.md`** -- Report wallpaper/canvas background
- **`references/filter-pane.md`** -- Filter pane formatting
- **`references/sort-visuals.md`** -- Visual sort configuration
- **`references/report-extensions.md`** -- reportExtensions.json format

**Semantic model integration:**
- **`references/semantic-model/`** -- Field references, model structure, report rebinding, query inference

**How-to guides:**
- **`references/how-to/`** -- Advanced conditional formatting, SVG in visuals
