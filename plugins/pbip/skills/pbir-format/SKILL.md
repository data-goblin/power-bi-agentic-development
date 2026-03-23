---
name: pbir-format
description: "This skill should be used when the user asks about 'PBIR format', 'PBIR JSON structure', 'what does this visual.json property mean', 'how do PBIR expressions work', 'objects vs visualContainerObjects', 'theme inheritance', 'conditional formatting pattern', 'extension measures', 'visual container formatting', or needs to understand Power BI Enhanced Report metadata format idiosyncrasies. This is a read-only format reference for understanding PBIR JSON schemas and patterns."
---

# PBIR Format Reference

Read-only reference for Power BI Enhanced Report (PBIR) JSON format idiosyncrasies -- structure, expression syntax, formatting patterns, and schema rules.

**PBIR files are strict JSON -- no comments allowed (not JSONC/JSONL).**

## Report Structure

```
Report.Report/
+-- definition.pbir                     # Semantic model connection
+-- definition/
|   +-- report.json                     # Theme, report filters, settings
|   +-- reportExtensions.json           # Extension measures (report-level DAX)
|   +-- pages/
|   |   +-- pages.json                  # Page order, active page
|   |   +-- [PageName]/
|   |       +-- page.json               # Page size, background, filters
|   |       +-- visuals/
|   |           +-- [VisualName]/
|   |               +-- visual.json     # Visual config and formatting
|   +-- version.json
+-- StaticResources/
    +-- RegisteredResources/            # Custom themes, images
    +-- SharedResources/BaseThemes/     # Microsoft base themes
```

## Expression Syntax

All formatting values use `expr` wrappers with type-specific quirks:

| Type | Syntax | Gotcha |
|------|--------|--------|
| String | `{"expr": {"Literal": {"Value": "'smooth'"}}}` | Inner single quotes required |
| Number | `{"expr": {"Literal": {"Value": "14D"}}}` | `D` suffix required |
| Boolean | `{"expr": {"Literal": {"Value": "true"}}}` | Lowercase, unquoted |
| Theme color | `{"expr": {"ThemeDataColor": {"ColorId": 0, "Percent": 0}}}` | |
| Extension measure | `{"expr": {"Measure": {"Expression": {"SourceRef": {"Schema": "extension", "Entity": "_Fmt"}}, "Property": "Color"}}}` | `"Schema": "extension"` required |

## objects vs visualContainerObjects

Both live inside `.visual` (not root level):

- **`objects`** -- Visual-specific: dataPoint, legend, axis, labels
- **`visualContainerObjects`** -- Container: title, background, border, dropShadow

Putting container properties in `objects` silently fails. Putting `visualContainerObjects` at root level errors.

## Conditional Formatting Pattern

Per-point formatting requires a two-entry array with `matchingOption: 1`. A single-entry array or `matchingOption: 0` applies the same value to all points.

## Theme Inheritance

Formatting resolves in order: theme wildcards (`"*"."*"`) -> theme visualType overrides -> bespoke `visual.json`. Many "formatting bugs" are actually theme issues.

Before making formatting changes, always check the theme first:

1. Check theme wildcards -- themes set defaults for ALL visuals
2. Understand what level the formatting is set at (theme wildcard, visualType override, or bespoke visual.json)
3. Fix at the right level: all visuals -> theme; one-off -> visual override; per-type -> theme visualType exception

## Visual Creation Rules

1. Pages: 1280x720 px (default)
2. Page and visual folder names must not contain spaces (use underscores/hyphens)
3. Visuals must not overlap; use even spacing
4. All fields must exist in semantic model or `reportExtensions.json`
5. Each page must have a title (textbox visual)
6. Prefer font size 14D+ for readability at 1920x1080
7. Include `altText` in `visualContainerObjects.general` for WCAG 2.1
8. Use theme colors, not hex values

## Related Skills

- **`pbip`** -- PBIP project operations: rename cascades, project forking, report JSON patterns
- **`tmdl`** -- TMDL file format, authoring, and editing

## References

- **`references/schema-patterns/`** -- Expressions, selectors, conditional formatting
- **`references/json-structure/`** -- Per-file format documentation (definition.pbir, report.json, reportExtensions.json, page.json, visual.json)
- **`references/theme.md`** -- Theme wildcards, inheritance, and color system
- **`references/visual-container-formatting.md`** -- objects vs visualContainerObjects deep-dive
- **`references/semantic-model/`** -- Field references, model structure, report rebinding
- **`references/enumerations.md`** -- Valid property enumerations
- **`references/extension-measures.md`** -- Extension measure patterns
- **`references/measures-vs-literals.md`** -- When to use measure expressions vs literal values
- **`references/textbox.md`** -- Textbox visual format
- **`references/page.md`** -- Page configuration and backgrounds
- **`references/report.md`** -- Report-level settings
- **`references/filter-pane.md`** -- Filter pane formatting
- **`references/wallpaper.md`** -- Report wallpaper/canvas background
- **`references/sort-visuals.md`** -- Visual sort configuration
- **`references/pbir-structure.md`** -- PBIR folder structure details
- **`references/report-extensions.md`** -- reportExtensions.json format
- **`references/how-to/`** -- Advanced conditional formatting, SVG in visuals
