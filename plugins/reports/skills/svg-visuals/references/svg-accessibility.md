# SVG Measures: Accessibility

A DAX SVG measure renders as an image keyed off `ImageUrl`; the screen-reader path reads the visual's title, type, author alt text, and the "Show data" table. A cell whose value is an `svg+xml` URI contributes nothing meaningful to either path (Show-data lists the literal markup string), and there is no per-cell alt-text slot. Every inline SVG chart is an accessibility dead zone by default.

## Mitigation at the host-visual level

Apply both of the following for any SVG measure encoding primary KPI data; the second alone is sufficient for decorative micro-charts.

### 1. Keep the numbers in adjacent readable columns

For an SVG sparkline column, also bind the numeric measures the SVG encodes (min, max, last value; actual, target, variance) as plain value columns in the same table or matrix. Show-data then carries real numbers rather than markup strings, satisfying WCAG 1.1.1 for the data-table fallback.

Decide per project which columns to expose vs hide at the visual level (they can be hidden from the visual but still present in the query so Show-data picks them up).

### 2. Set dynamic alt text on the host container

Author a sibling `_Alt` measure returning a spoken sentence (under ~250 characters) that narrates the SVG's content for the current filter context:

```dax
KPI Sparkline Alt =
VAR _Last = [Sales Amount]
VAR _Trend = IF([Sales Amount] > [Sales Amount PY], "up", "down")
RETURN
    "Sales: " & FORMAT(_Last, "$#,0,, M") & ", trending " & _Trend & " vs prior year"
```

Bind via `pbir set`:

```bash
pbir set "MyPage/MyTable.Visual" "general.altText" --measure "_Report.KPI Sparkline Alt"
```

Or set directly in `visual.json` under `visualContainerObjects.general[0].properties.altText`:

```json
"general": [{
  "properties": {
    "altText": {
      "expr": {
        "Measure": {
          "Expression": { "SourceRef": { "Schema": "extension", "Entity": "Sales" } },
          "Property": "KPI Sparkline Alt"
        }
      }
    }
  }
}]
```

The measure must guard `BLANK()` (a blank alt text is no better than none):

```dax
IF(COUNTROWS(VALUES('Date'[Month])) > 0,
    "Sales: " & FORMAT(_Last, "$#,0,, M") & "...",
    "No data for the current selection."
)
```

For an `image` visual rendering a single SVG, the container has a `general.altText` slot; always set it. The static literal form is acceptable when the SVG is not filter-sensitive.

### Decorative SVGs

For purely decorative SVGs (dividers, brand backgrounds), mark the host hidden in tab order so screen readers skip it entirely:

```bash
pbir set "MyPage/MyDecorativeSVG.Visual" "position.tabOrder" -1
```

## Color-only encoding

An SVG that conveys status purely via `fill`/`stroke` color fails WCAG 1.4.1. Pair every semantic color with at least one of:

- A shape or glyph change (circle vs diamond, filled vs hollow)
- A text label or abbreviation inside the SVG
- A `<title>` element inside the SVG markup itself

The status pill pattern already does this (text label alongside fill color). The dumbbell and bullet patterns do not; add a symbol or label if they are primary status indicators.

## Contrast

SVG elements are subject to the same WCAG contrast requirements as rasterized content:
- Text inside the SVG: >= 4.5:1 against the cell background (3:1 for large text >= 18pt)
- Graphical elements (bars, lines, dots used for data): >= 3:1 against adjacent colors

Theme tokens from the host report's theme do not automatically propagate into an SVG string; verify contrast manually, especially on dark themes or high-contrast accessibility themes.

## What the Desktop Bridge screenshot does not confirm

The Bridge screenshot is useful for layout verification; it does not confirm:
- Alt text is populated and readable
- Adjacent readable columns are present in Show-data
- Tab order positions the visual correctly for keyboard users

Confirm accessibility by reading back the bound measure expression and auditing `visual.json` for `general.altText` and the presence of non-SVG bound columns.

## Severity guidance for audit findings

When surfaced by the `review-report` skill:

- Primary KPI SVGs with no alt text and no adjacent numeric column: high severity
- SVG measures with color-only encoding and no paired shape or label: high severity
- Decorative micro-charts with no alt text: medium severity (low if clearly decorative and tab-order is -1)
