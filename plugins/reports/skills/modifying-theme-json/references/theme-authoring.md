# Theme Authoring Guide

Design guidance for creating and evolving Power BI report themes. This covers decisions and structure — for JSON mechanics, jq patterns, and filter pane properties, see `pbir-format` skill → `references/theme.md`.

## Reading and Editing Theme Files

**CRITICAL:** Theme JSON files can be 75KB+ and 2000+ lines. Never read the full file. Two approaches:

**Preferred: Serialize/build workflow.** Split the theme into small, focused files, edit those, then rebuild:
```bash
# Serialize to a temporary folder (MUST be outside .Report/ to avoid validation hook errors)
pbir theme serialize "Report.Report" -o /tmp/Work.Theme

# Edit the small files in /tmp/Work.Theme/ (_config.json, _wildcards.json, etc.)

# Build and apply back
pbir theme build /tmp/Work.Theme -o "Report.Report" -f --clean
```

**Fallback: Targeted `jq` queries.** When serialize/build is unavailable, use `jq` to extract only specific keys:
```bash
jq 'keys' "$THEME"
jq '.textClasses | keys' "$THEME"
jq '.visualStyles["*"]["*"] | keys' "$THEME"
jq '.dataColors' "$THEME"
```

Never use `cat`, `head`, or the `Read` tool on theme files.

---

## Starting Point

Never author a theme from an empty object. Start from:

1. **SQLBI/Data Goblins theme** — in `pbir-format` examples at `examples/K201-MonthSlicer.Report/StaticResources/RegisteredResources/SqlbiDataGoblinTheme.json`. Validated, complete, follows best practices.
2. **Community templates** — [deldersveld/PowerBI-ThemeTemplates](https://github.com/deldersveld/PowerBI-ThemeTemplates) has snippets for individual visual types.
3. **Existing report theme** — export from Power BI Service via View → Themes → Save current theme, then extend.

### Schema Integration (Recommended)

Add a `$schema` property as the first key to enable IDE autocomplete and inline validation in VS Code. Two schema URLs are used in practice:

```json
// Generic Power BI schema reference (used in exported themes)
{ "$schema": "https://powerbi.com/product/schema#reportTheme" }

// Versioned GitHub schema (recommended for authoring — enables full validation)
{ "$schema": "https://raw.githubusercontent.com/microsoft/powerbi-desktop-samples/main/Report%20Theme%20JSON%20Schema/reportThemeSchema-2.152.json" }
```

Use the versioned GitHub URL when authoring or editing themes. Use the generic `powerbi.com` URL only if it was already present in an exported theme and you're not changing it.

The schema is versioned monthly alongside Power BI Desktop releases (pattern: `reportThemeSchema-2.{version}.json`). The latest as of March 2026 is `2.152` (exploration version 5.71). Target the version matching the Desktop release the report consumers are using.

- Schema index (check for newer versions — schemas are released monthly): https://github.com/microsoft/powerbi-desktop-samples/tree/main/Report%20Theme%20JSON%20Schema
- The schema is Draft 7 compliant and is used verbatim by Desktop to validate themes on import. Invalid themes are rejected.
- In VS Code, trigger autocomplete with Ctrl+Space to see valid property names and enum values from the Format pane.

The `visualStyles` section of the schema documents every property available for each visual type — this is the most reliable reference for which properties exist and what their valid values are.

---

## Color System Design

The color system in a theme has four layers. Design them in this order:

### 1. Data Colors (`dataColors`)

The primary series palette — ordered by expected usage frequency (most-used color first).

Rules:
- 6–12 colors recommended; fewer is more cohesive
- Colors must be visually distinguishable from each other, including for color-blind users (favor blue/orange/teal over red/green combinations for series)
- Test by listing the palette and imagining a 4-series bar chart — the first 4 colors carry the most meaning
- Muted, desaturated tones are preferable to saturated "screaming" colors

```json
"dataColors": ["#1971c2", "#f08c00", "#2f9e44", "#ae3ec9", "#e03131", "#0c8599"]
```

### 2. Semantic Colors

Flat top-level hex string keys used by conditional formatting measures that return color name strings (`"good"`, `"bad"`, `"neutral"`). These are NOT nested under a `sentimentColors` object — they are individual keys at the root level of the theme JSON.

```json
"good": "#2f9e44",
"bad": "#e03131",
"neutral": "#868e96",
"maximum": "#1971c2",
"center": "#f8f9fa",
"minimum": "#e03131"
```

> Conditional formatting measures that return `"good"` will use whatever hex is set here. This centralizes CF color control in one place.

### 3. Background/Foreground Variants

Extended palette for container surfaces, canvas backgrounds, and foreground text. These feed into `visualContainerObjects` backgrounds and the filter pane.

```json
"foreground": "#343a40",
"foregroundLight": "#868e96",
"foregroundDark": "#212529",
"foregroundNeutralSecondary": "#adb5bd",
"background": "#ffffff",
"backgroundLight": "#f8f9fa",
"backgroundNeutral": "#e9ecef",
"backgroundDark": "#dee2e6"
```

### 4. Additional Accent Colors

```json
"tableAccent": "#1971c2",
"hyperlink": "#1971c2",
"shapeStroke": "#dee2e6",
"accent": "#1971c2"
```

### Color Principles

- Refer to `pbi-report-design` skill → `references/visual-colors.md` for WCAG contrast requirements and accessibility guidance
- Use `ThemeDataColor` references (ColorId + Percent) in theme JSON rather than hardcoded hex wherever possible — this keeps the theme internally consistent if the palette changes
- Keep `dataColors[0]` as the "primary" color that appears most frequently across the report

---

## Typography (`textClasses`)

Text classes define font properties by semantic role. Every defined class overrides Power BI's defaults for that role across all visuals.

### Standard Roles

| Role | Typical Use | Recommended Size |
|------|-------------|-----------------|
| `title` | Visual titles, page titles | 14–16pt |
| `header` | Section headers, column headers | 12–14pt |
| `label` | Axis labels, data labels | 11–12pt |
| `callout` | KPI values, prominent numbers | 28–36pt |
| `dataTitle` | KPI subtitles / labels | 12pt |
| `boldLabel` | Emphasized labels | 12pt |
| `largeTitle` | Large section titles | 20–24pt |
| `largeLabel` | Larger variant of label | 13–14pt |

### Font Choice

- Use `"Segoe UI"` for regular weight, `"Segoe UI Semibold"` for emphasis — short name form only
- In `visualStyles` and `textClasses`: use the short name (`"Segoe UI Semibold"`). The long CSS font stack format (`"'Segoe UI Semibold', wf_segoe-ui_semibold, ..."`) is for `outspacePane`/`filterCard` only.
- Do not use custom fonts — Power BI only supports its built-in font list. Supported options include: Arial, Calibri, Candara, Consolas, Courier New, DIN, DIN Light, Georgia, Segoe UI, Segoe UI Light, Segoe UI Semibold, Segoe UI Bold, Tahoma, Times New Roman, Trebuchet MS, Verdana (confirmed from pbir object model)
- Mixing more than two font weights in a report creates visual noise

### Example `textClasses` Block

```json
"textClasses": {
  "callout": {
    "fontSize": 32,
    "fontFace": "Segoe UI",
    "color": "#343a40"
  },
  "title": {
    "fontSize": 14,
    "fontFace": "Segoe UI Semibold",
    "color": "#343a40"
  },
  "header": {
    "fontSize": 12,
    "fontFace": "Segoe UI Semibold",
    "color": "#343a40"
  },
  "label": {
    "fontSize": 11,
    "fontFace": "Segoe UI",
    "color": "#495057"
  },
  "dataTitle": {
    "fontSize": 12,
    "fontFace": "Segoe UI",
    "color": "#868e96"
  }
}
```

> **Note:** `textClasses` colors use a plain hex string (`"color": "#343a40"`), NOT the `{"solid":{"color":"..."}}` object wrapper. The nested wrapper is correct in `visualStyles` but wrong in `textClasses` — using it in textClasses causes the color to be silently ignored.

---

## Wildcard Container Defaults (`visualStyles["*"]["*"]`)

The wildcard section is the most important part of the theme — it sets the baseline for every visual before any type-specific overrides apply.

### Minimum Viable Wildcard

At a minimum, set:

```json
"visualStyles": {
  "*": {
    "*": {
      "title": [{
        "show": true,
        "fontSize": 14,
        "fontFamily": "Segoe UI Semibold",
        "fontColor": {"solid": {"color": "#343a40"}}
      }],
      "background": [{"show": false}],
      "border": [{"show": false}],
      "dropShadow": [{"show": false}],
      "padding": [{"top": 8, "bottom": 8, "left": 8, "right": 8}]
    }
  }
}
```

### Recommended Additions

- **`subTitle`** — `show: false` by default; only specific visuals should use it
- **`divider`** — `show: false` unless design calls for it
- **`visualHeader`** — `show: true` to keep the visual header (focus mode, filter icon, etc.)
- **`outspacePane`** — filter pane styling (see `pbir-format` → `theme.md`)
- **`filterCard`** — filter card styling for Available and Applied states

### Design Guidelines

- `dropShadow.show: false` globally is strongly recommended — drop shadows create visual noise and cause vestibular issues for some users. Only enable on specific visual types that genuinely benefit.
- `background.show: false` by default keeps the canvas clean. Individual visuals can opt in.
- `border.show: false` by default — borders are clutter. Use spacing instead.
- Title should be enabled by default so visuals have useful labels. Suppress per visual type as needed (e.g., textboxes).

---

## Visual-Type Override Strategy

After setting the wildcard, add type-specific sections for visual types that need different defaults. The most critical:

| Visual Type | Why Override |
|-------------|-------------|
| `textbox` | Wildcard titles/borders don't apply to text — suppress all container chrome |
| `image` | Images rarely need a title or border |
| `shape` | Geometric shapes should have no title, background, or shadow |
| `actionButton` | Buttons have their own style system — suppress container chrome |

Less critical but commonly useful:

| Visual Type | Common Override |
|-------------|----------------|
| `kpi` | Indicator font size, trend line visibility, goal formatting |
| `card` | Category label font, value font size |
| `slicer` | Item font family/size, header font |
| `lineChart` | Legend position (`Bottom`), gridline weight |
| `tableEx` | Column header background, row alternating color |

See `references/visual-type-overrides.md` for JSON patterns for each of these.

---

## Promoting Bespoke Visual Formatting to Theme

For detailed guidance on promoting bespoke visual.json formatting back into the theme — including the objects vs visualContainerObjects distinction, wildcard vs visual-type decisions, and property mapping examples — see **`references/promoting-formatting.md`**.

---

## Theme Authoring Checklist

Before considering a theme complete:

- [ ] `dataColors` has 6–12 entries; first color is the "primary"
- [ ] Semantic colors (`good`, `bad`, `neutral`) are set and distinct from series colors
- [ ] `textClasses` covers at minimum: `title`, `header`, `label`, `callout`
- [ ] Wildcard sets container defaults: `title`, `background`, `border`, `dropShadow`, `padding`
- [ ] `dropShadow.show: false` in wildcard
- [ ] At least `textbox` and `image` have type-specific overrides disabling container chrome
- [ ] Filter pane (`outspacePane` and `filterCard`) styled in wildcard
- [ ] Theme validates with `pbir theme validate "Report.Report"` (or `jq empty` as fallback)
- [ ] Deployed and visually verified on at least 3 visual types
