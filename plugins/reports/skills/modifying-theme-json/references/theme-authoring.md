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
// Generic Power BI schema reference (used in exported themes — triggers no real validation)
{ "$schema": "https://powerbi.com/product/schema#reportTheme" }

// Versioned GitHub schema (recommended for authoring — enables full validation)
{ "$schema": "https://raw.githubusercontent.com/microsoft/powerbi-desktop-samples/main/Report%20Theme%20JSON%20Schema/reportThemeSchema-2.154.json" }
```

Use the versioned GitHub URL when authoring or editing themes. The generic `powerbi.com` URL is a marker that exported themes carry; it triggers no schema validation. Do not use it for authoring.

The schema is versioned monthly alongside Power BI Desktop releases (pattern: `reportThemeSchema-2.{version}.json`). Resolve the newest version at author time rather than hardcoding a remembered number:

```bash
gh api repos/microsoft/powerbi-desktop-samples/contents/"Report Theme JSON Schema" \
  --jq '.[].name' | sort | tail -1
```

Target the schema version matching the Desktop release the report consumers are using, not necessarily the absolute latest.

Critical: Power BI validates an imported theme against the schema baked into the Desktop build, not the file's `$schema` URL. Validation is reject-unknown-fields: a single misspelled key refuses the whole theme and prompts for a corrected file. A theme that passes `jq` validation can fail Desktop import on one typo. This is stricter than `visual.json` (where unknown properties are usually dropped silently).

- Schema index (check for newer versions; schemas are released monthly): https://github.com/microsoft/powerbi-desktop-samples/tree/main/Report%20Theme%20JSON%20Schema
- The schema is Draft 7 compliant. The `visualStyles` section documents every property available for each visual type.
- In VS Code, trigger autocomplete with Ctrl+Space to see valid property names and enum values.

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

Flat top-level hex string keys used by conditional formatting measures that return color name strings (`"good"`, `"bad"`, `"neutral"`). These are NOT nested under a `sentimentColors` object; they are individual keys at the root level of the theme JSON.

```json
"good": "#2f9e44",
"bad": "#e03131",
"neutral": "#868e96",
"maximum": "#1971c2",
"center": "#f8f9fa",
"minimum": "#e03131",
"null": "#e9ecef"
```

> Conditional formatting measures that return `"good"` will use whatever hex is set here. This centralizes CF color control in one place.

The gradient dialog pulls four colors: `minimum`, `center`, `maximum`, and `null` (applied to blank values in data-bar and background CF). If `null` is unset, blanks render Power BI's default (an off-orange `#FF7F48`) which clashes with most themes. Reports with sparse measures show blanks constantly; set all four together. The key is the literal string `"null"` (not JSON `null`). `pbir theme set-colors` exposes `--minimum/--center/--maximum` but not `--null`; write it directly in `_config.json`.

### 3. Structural Colors

Six flat top-level hex keys that recolor non-data chrome across every visual (gridlines, axis labels, table grid, trend lines, slicer outlines, filter-card and tooltip backgrounds). These are the highest-leverage move when building a dark or branded theme.

The canonical names as written by the Customize-theme dialog:

```yaml
firstLevelElements:  # values/totals font, trend lines, card data labels, KPI text, filter/tooltip text
secondLevelElements: # axis labels, legend labels, table headers, slicer item font+outline, light secondary text classes
thirdLevelElements:  # gridlines, shape fill, gauge arc background, applied filter-card background
fourthLevelElements: # legend dimmed, card category labels, multi-row card bars
background:          # in-data-point label background, slicer dropdown, donut/treemap stroke, button fill, available filter-card/tooltip background
secondaryBackground: # grid outline, shape-map default, ribbon fill, tooltip separator
tableAccent:         # table/matrix grid outline when present
```

Aliases used in the pbir CLI and older exports:

```yaml
firstLevelElements:  foreground
secondLevelElements: foregroundNeutralSecondary
thirdLevelElements:  backgroundLight
fourthLevelElements: foregroundNeutralTertiary
secondaryBackground: backgroundNeutral
```

`pbir theme set-colors` exposes only the alias subset; for `firstLevelElements` through `fourthLevelElements` and `secondaryBackground`, write keys directly in `_config.json` then rebuild. Pick the level-N names for new themes (Desktop's dialog round-trips them).

Dark theme trap: flipping only `background` to a dark hex while leaving element levels black makes gridlines and axis labels invisible (they inherit `firstLevelElements` and `secondLevelElements`). Set `firstLevelElements`, `secondLevelElements`, and `background` together with mutual contrast. Light text-class variants pull their color from these structural keys and break silently if skipped.

### 4. Background/Foreground Variants

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

### 5. Additional Accent Colors

```json
"tableAccent": "#1971c2",
"hyperlink": "#1971c2",
"shapeStroke": "#dee2e6",
"accent": "#1971c2"
```

### Color Principles

- Refer to `pbi-report-design` skill → `references/visual-colors.md` for WCAG contrast requirements and accessibility guidance
- Use `ThemeDataColor` references (ColorId + Percent) in theme JSON rather than hardcoded hex wherever possible; this keeps the theme internally consistent if the palette changes
- Keep `dataColors[0]` as the "primary" color that appears most frequently across the report

---

## Typography (`textClasses`)

Text classes define font properties by semantic role. Every defined class overrides Power BI's defaults for that role across all visuals.

Power BI has 12 text classes: 4 primary ones you set explicitly, and 8 secondary ones that derive automatically from a primary (lighter shade or size delta). Over-specifying all 12 is wasted effort and a drift trap; set the four primaries, then override a secondary only when you need to break an inheritance.

### Primary Roles (set these)

```yaml
callout: "card data labels, KPI indicators"
title:   "axis titles, multi-row card title, slicer header"
header:  "key-influencers headers, tab headers"
label:   "table/matrix headers, grid values, column headers"
```

### Secondary Roles (derive from primaries; override only when needed)

```yaml
largeTitle:       # derived from title, larger
semiboldLabel:    # derived from label, semibold weight
largeLabel:       # derived from label, larger
smallLabel:       # derived from label, smaller
lightLabel:       # derived from label, lighter color (from structural colors)
boldLabel:        # derived from label, bold (used for table totals)
largeLightLabel:  # derived from label, large + light
smallLightLabel:  # derived from label, small + light
```

Common override: make table totals non-bold via `"boldLabel": {"bold": false}`. Without it, `boldLabel` inherits bold-weight from `label`.

Caveat: `title` and slicer header partly derive their color from `dataColors[0]`, so changing the first data color shifts those text colors unexpectedly. Explicitly set `color` in `title` to override this.

Use a plain hex string for `color` in `textClasses` (NOT the `{"solid":{"color":"..."}}` wrapper used in `visualStyles`).

### Standard Roles Reference

| Role | Typical Use | Recommended Size |
|------|-------------|-----------------|
| `title` | Visual titles, page titles | 14-16pt |
| `header` | Section headers, column headers | 12-14pt |
| `label` | Axis labels, data labels | 11-12pt |
| `callout` | KPI values, prominent numbers | 28-36pt |
| `dataTitle` | KPI subtitles / labels | 12pt |
| `boldLabel` | Table totals, emphasized labels | 12pt |
| `largeTitle` | Large section titles | 20-24pt |
| `largeLabel` | Larger variant of label | 13-14pt |

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
- **`filterCard`** — filter card styling; use the `$id` discriminator to style Available and Applied states differently (see below)

### Filter-Card States with `$id`

A single `filterCard` container styled without a `$id` applies identically to both states; you cannot make applied filters visually distinct from available ones. Use the `$id` discriminator to target each state independently:

```json
"filterCard": [
  { "$id": "Available", "border": true, "backgroundColor": { "solid": { "color": "#f8f9fa" } } },
  { "$id": "Applied",   "foregroundColor": { "solid": { "color": "#252423" } }, "backgroundColor": { "solid": { "color": "#e9ecef" } } }
]
```

`$id` values are fixed enumerations for this container (`Available` / `Applied`); values are case-sensitive. Mis-cased or invented values are silently ignored. This is one of the few containers in theme JSON that uses `$id`; get valid values from the schema or a Desktop-formatted export.

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

- [ ] `dataColors` has 6-12 entries; first color is the "primary"
- [ ] Semantic colors (`good`, `bad`, `neutral`) are set and distinct from series colors
- [ ] Gradient colors (`minimum`, `center`, `maximum`, `null`) are all set; `null` prevents the default off-orange on blank values
- [ ] Structural colors (`firstLevelElements`, `secondLevelElements`, `background`) set with mutual contrast (critical for dark themes)
- [ ] `textClasses` covers at minimum the four primaries: `title`, `header`, `label`, `callout`; secondary classes overridden only where inheritance breaks
- [ ] Wildcard sets container defaults: `title`, `background`, `border`, `dropShadow`, `padding`
- [ ] `dropShadow.show: false` in wildcard
- [ ] At least `textbox` and `image` have type-specific overrides disabling container chrome
- [ ] Filter pane (`outspacePane`) and filter cards (`filterCard` with `$id: Available/Applied`) styled in wildcard
- [ ] Theme validates with `pbir theme validate "Report.Report"` (or `jq empty` as fallback)
- [ ] Deployed and visually verified on at least 3 visual types
