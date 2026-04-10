---
name: modifying-theme-json
version: 0.22.4
description: Design, enforce, audit, and validate Power BI report themes. This skill MUST be invoked when a report uses the default or built-in theme, has a minimal custom theme (few or no visualStyles), or has accumulated many visual-level formatting overrides (objects/visualContainerObjects in visual.json); these are signs the theme needs attention. Also automatically invoke when the user asks to "create a theme", "design a theme", "enforce theme compliance", "audit theme adherence", "push formatting to theme", "clear visual overrides", "standardize report formatting", "update theme colors", "change theme typography", "set theme text classes", "validate a theme", "add visual-type overrides to the theme", "copy a theme", "download a theme", "apply a template", or mentions theme design, enforcement, compliance, or visual formatting inconsistency.
---

# Power BI Report Themes

## Why Themes Matter

A report without a well-designed theme accumulates formatting debt. Every visual ends up with its own bespoke title size, shadow toggle, border style, and hardcoded colors in `visual.json`. This creates three problems:

1. **Inconsistency.** Visuals drift apart as authors format each one individually. One card has 14pt titles, another has 12pt; one chart has shadows, another doesn't. The report looks unfinished.
2. **Fragility.** Rebranding or updating the visual style means touching every visual.json individually. A report with 40 visuals across 8 pages means 40 files to edit. With a theme, it's one file.
3. **Bloated visual JSON.** Each bespoke override adds lines to visual.json, making reports harder to diff, review, and maintain. A clean visual.json should contain field bindings, position, and conditional formatting; everything else should come from the theme.

Reports using the default Power BI theme or a minimal custom theme (just `dataColors` and a name) are leaving most formatting to Power BI's built-in defaults, which change between Desktop releases. A well-designed theme locks in the intended appearance.

**Signs a theme needs attention:**
- Many visuals have `objects` or `visualContainerObjects` with redundant formatting
- Visuals of the same type look inconsistent (different title fonts, shadows on some but not others)
- The theme JSON has few or no `visualStyles` entries
- The report uses a built-in theme like "Default" or "Classic" without customization

> **Tooling preference:** Use `pbir` CLI when available (`pbir theme colors`, `pbir visuals clear-formatting`). Fall back to direct `jq` modification when unavailable. Always validate after every write.

> **Tip:** Theme JSON files can be 75KB+ and 2000+ lines. Do not read the full monolithic file. Use `pbir theme serialize` to split into small editable files (see Author/Modify workflow below), or use `jq` to extract only specific keys. Serialized fragments from the serialize/build workflow are small and safe to read directly.

For PBIR JSON mechanics (property names, filter pane selectors, ThemeDataColor syntax, `jq` patterns), see the **`pbir-format`** skill (pbip plugin) -> `references/theme.md`.

## The Formatting Hierarchy

Power BI applies visual formatting through a four-level cascade. Each level overrides the level above it:

```
Level 1  Power BI built-in defaults
         |
Level 2  Theme wildcard     visualStyles["*"]["*"]           applies to ALL visuals
         |
Level 3  Theme visual-type  visualStyles["lineChart"]["*"]   overrides wildcard for that type
         |
Level 4  Visual instance    visual.json objects +            overrides everything
                            visualContainerObjects
```

### Core Principle

Push as much formatting as possible into levels 2 and 3. A well-designed theme means:

- Visual JSON files stay lean — no bespoke formatting noise cluttering visual.json
- Global style changes require editing one file
- New visuals automatically inherit correct defaults without manual intervention

Visual-level overrides (level 4) should exist only for true one-offs: content-specific formatting, exceptions to the visual-type default, or conditional formatting expressions.

### Diagnosing Why a Visual Looks the Way It Does

When a visual renders unexpectedly, walk up the cascade:

1. Check `visual.json` → `objects` and `visualContainerObjects` (level 4 always wins)
2. Check theme `visualStyles["<type>"]["*"]` for that visual type (level 3)
3. Check theme `visualStyles["*"]["*"]` wildcard (level 2)
4. If absent everywhere, Power BI is applying a built-in default

## Workflow: Audit Theme Compliance

Use when assessing whether a report's visuals are inheriting from the theme or have accumulated stale overrides.

**Step 1 — Locate the custom theme:**
```bash
THEME_NAME=$(jq -r '.themeCollection.customTheme.name' Report.Report/definition/report.json)
THEME="Report.Report/StaticResources/RegisteredResources/$THEME_NAME"
```

**Step 2 — Review what the theme sets at wildcard level:**
```bash
# Preferred
pbir theme colors "Report.Report"
pbir theme text-classes "Report.Report"

# Fallback
jq '.visualStyles["*"]["*"] | keys' "$THEME"
```

**Step 3 — Continue with full audit process** — see **`references/theme-compliance.md`** for the complete workflow: scanning all visuals for bespoke overrides, classifying stale vs intentional vs CF, severity levels, and fix decision tree.

## Workflow: Enforce Theme (Clear Overrides)

After applying a new theme or making significant theme changes, stale visual-level overrides prevent the new theme from rendering correctly.

**With `pbir` CLI (preferred):**
```bash
# Clears bespoke formatting while preserving conditional formatting expressions
pbir visuals clear-formatting "Report.Report/**/*.Visual" --keep-cf -f
```

**With `jq` (manual, per-visual):**
```bash
# Safe: clear container chrome only (title, border, background, shadow, padding)
# Does NOT touch chart-specific objects or conditional formatting
jq 'del(.visual.visualContainerObjects)' visual.json > tmp && mv tmp visual.json

# Aggressive: clear everything including chart-specific overrides
# WARNING: also removes conditional formatting — only use if CF is confirmed absent
jq 'del(.visual.objects) | del(.visual.visualContainerObjects)' visual.json > tmp && mv tmp visual.json

# Always validate after
jq empty visual.json
```

> When in doubt, clear `visualContainerObjects` only. Leave `objects` unless you have confirmed no conditional formatting exists in that visual.

## Workflow: Author or Modify a Theme

When building or substantially revising a theme, use the **serialize/build workflow** via `pbir` CLI. This splits the monolithic theme JSON into small, focused files that are easy to read and edit without loading 2000+ lines of JSON into context.

### Serialize/Build Workflow (Recommended)

> **IMPORTANT:** Serialize to a temporary folder outside the `.Report/` directory. The PBIR validation hooks monitor `.Report/` for JSON changes and will flag the serialized fragments as invalid PBIR files. Use `/tmp/`, a sibling folder, or the `-o` flag to place the `.Theme` folder elsewhere.

**Step 1 — Serialize the theme into editable files:**
```bash
# From a report (outputs to a .Theme folder)
pbir theme serialize "Report.Report" -o /tmp/MyTheme.Theme

# From a standalone theme JSON file
pbir theme serialize theme.json -o /tmp/MyTheme.Theme
```

This produces small, focused files: `_config.json` (colors, text classes, named colors), `_wildcards.json` (wildcard visual styles), and one file per visual-type override (e.g., `slicer.json`, `page.json`).

**Step 2 — Edit the serialized files.** Each file is small enough to read and edit directly. Focus on:
1. `_config.json` — `dataColors`, semantic colors, `textClasses`, background/foreground variants
2. `_wildcards.json` — container defaults (title, border, shadow, padding)
3. Visual-type files — overrides for specific types (textbox, image, card, etc.)

**Step 3 — Build and apply back to the report:**
```bash
# Build only (produces a merged theme.json)
pbir theme build /tmp/MyTheme.Theme

# Build and apply directly to the report
pbir theme build /tmp/MyTheme.Theme -o "Report.Report" -f --clean
```

The `--clean` flag removes the `.Theme` folder after building.

### Quick Modifications (No Serialize Needed)

For small, targeted changes, use the CLI directly without serializing:

```bash
pbir theme set-colors "Report.Report" --good "#00B050" --bad "#FF0000"
pbir theme set-text-classes "Report.Report" title --font-size 14 --font-face "Segoe UI Semibold"
pbir theme set-formatting "Report.Report" "*.*.dropShadow.show" --value false
```

See the **`pbir-cli`** skill → `references/modifying-theme.md` for full CLI command reference.

### Design Sequence

Whether using serialize/build or direct CLI commands, follow this order:

1. **Start from a valid base.** Use a template (`pbir theme apply-template`), the SQLBI/Data Goblins theme, or a [community template](https://github.com/deldersveld/PowerBI-ThemeTemplates). Do not author from an empty `{}`.
2. **Design the color system first** (`dataColors`, semantic colors, background/foreground variants). Color decisions cascade everywhere.
3. **Set typography** (`textClasses`) — font face and size for `title`, `header`, `label`, `callout`, `dataTitle`. Stick to Segoe UI / Segoe UI Semibold; custom fonts will not render on other users' machines.
4. **Set wildcard container defaults** (`visualStyles["*"]["*"]`): title visibility/font/size, `dropShadow.show: false`, padding, border, filter pane.
5. **Add visual-type overrides** for types that differ from the wildcard — at minimum, `textbox` and `image` to suppress title/border/background/shadow.
6. **Validate** with `pbir theme validate "Report.Report"`, deploy, and visually verify.

For detailed design guidance, see **`references/theme-authoring.md`**. For visual-type override patterns, see **`references/visual-type-overrides.md`**.

## Workflow: Promote Bespoke Formatting to Theme

When a `visual.json` has formatting that should become a theme default — either for that visual type or for all visuals — promote it.

**With `pbir` CLI (preferred):**
```bash
# Preview what would be pushed from a well-formatted visual into the theme
pbir theme push-visual "Report.Report/Page.Page/Card.Visual" --dry-run

# Push formatting to theme as the default for that visual type
pbir theme push-visual "Report.Report/Page.Page/Card.Visual"

# Push only specific components (title, background, border, etc.)
pbir theme push-visual "Report.Report/Page.Page/Card.Visual" --components title,background,border
```

**Manual process** (when CLI is unavailable):

1. **Identify** what's in `visual.objects` (chart-specific) and `visual.visualContainerObjects` (container chrome)
2. **Decide** whether it belongs in the wildcard (`["*"]["*"]`) or a visual-type section (`["lineChart"]["*"]`)
3. **Write** the value into the theme, then validate
4. **Remove** the override from the visual, then validate
5. **Verify** the visual still renders correctly

Both `objects` and `visualContainerObjects` properties map to the same `visualStyles[type][state]` section in the theme. The distinction in visual.json doesn't exist in the theme.

For complete property mapping tables, wildcard vs visual-type decision guide, color handling, and batch promotion across many visuals, see **`references/promoting-formatting.md`**.

## Workflow: Validate a Theme

**With `pbir` CLI (preferred):**
```bash
# Validate a report's theme (checks JSON syntax, structure, and completeness)
pbir theme validate "Report.Report"

# Validate a standalone theme file
pbir theme validate "theme.json"

# Validate a serialized .Theme folder before building
pbir theme validate "MyTheme.Theme"
```

**Manual validation** (when CLI is unavailable):
```bash
# 1. JSON syntax
jq empty "$THEME" && echo "JSON valid"

# 2. Required top-level keys
jq '{dataColors: (.dataColors | type), visualStyles: (.visualStyles | type), textClasses: (.textClasses | type)}' "$THEME"

# 3. Wildcard section
jq 'if .visualStyles["*"]["*"] then "wildcard exists" else "MISSING wildcard" end' "$THEME"

# 4. Valid hex colors
jq '[.dataColors[] | select(test("^#[0-9A-Fa-f]{6}$") | not)]' "$THEME"

# 5. No null visual-type sections
jq '[.visualStyles | to_entries[] | select(.value == null) | .key]' "$THEME"
```

After validation, deploy and visually verify:
- Wildcard container chrome (titles, borders, shadows) applies to all visuals
- Filter pane and filter cards render correctly on all pages
- Visual-type overrides correctly suppress the wildcard for exempt types (e.g., textboxes have no title)
- Data colors cycle correctly on multi-series charts

## Schema and Documentation

| Resource | URL |
|----------|-----|
| Official report theme JSON schema (versioned, Draft 7) | [microsoft/powerbi-desktop-samples — Report Theme JSON Schema](https://github.com/microsoft/powerbi-desktop-samples/tree/main/Report%20Theme%20JSON%20Schema) |
| Latest schema (v2.152, March 2026, exploration v5.71) — **check repo for newer** | [reportThemeSchema-2.152.json](https://github.com/microsoft/powerbi-desktop-samples/blob/main/Report%20Theme%20JSON%20Schema/reportThemeSchema-2.152.json) |
| Raw schema URL (for `$schema` IDE integration) — **update version as needed** | `https://raw.githubusercontent.com/microsoft/powerbi-desktop-samples/main/Report%20Theme%20JSON%20Schema/reportThemeSchema-2.152.json` |
| Microsoft Learn — Use report themes in Power BI Desktop | https://learn.microsoft.com/en-us/power-bi/create-reports/desktop-report-themes |
| Microsoft Learn — Report theme JSON file format | https://learn.microsoft.com/en-us/power-bi/create-reports/desktop-report-themes#report-theme-json-file-format |
| Community theme templates | [deldersveld/PowerBI-ThemeTemplates](https://github.com/deldersveld/PowerBI-ThemeTemplates) |
| PBIR item schemas | [microsoft/powerbi-desktop-samples — item-schemas](https://github.com/microsoft/powerbi-desktop-samples/tree/main/item-schemas) |

### IDE Integration (`$schema`)

Add a `$schema` property to the theme JSON to enable autocomplete and validation in VS Code (or any JSON Schema-aware editor):

```json
{
  "$schema": "https://raw.githubusercontent.com/microsoft/powerbi-desktop-samples/main/Report%20Theme%20JSON%20Schema/reportThemeSchema-2.152.json",
  "name": "MyTheme",
  "dataColors": ["#1971c2", ...]
}
```

The schema is used verbatim by Power BI Desktop to validate themes on import — if the JSON fails schema validation, Power BI Desktop will reject the theme. Always target the schema version that matches the Power BI Desktop version in use. Schemas follow the pattern `reportThemeSchema-2.{version}.json` where the version matches the monthly Desktop release.

## Theme Top-Level Keys

| Key | Type | Purpose |
|-----|------|---------|
| `name` | string | Display name shown in Power BI UI |
| `dataColors` | string[] | Ordered hex palette for data series |
| `good` / `bad` / `neutral` | string | Flat hex keys for CF measure semantic colors |
| `maximum` / `center` / `minimum` | string | Gradient color extremes (flat hex keys) |
| `foreground` variants | string | `foreground`, `foregroundLight`, `foregroundDark`, `foregroundNeutralSecondary`, etc. |
| `background` variants | string | `background`, `backgroundLight`, `backgroundNeutral`, `backgroundDark` |
| `textClasses` | object | Typography per semantic role (`title`, `label`, `callout`, `header`, `boldLabel`, etc.) |
| `visualStyles` | object | `[visualType][state]` formatting cascade |

## References

- **`references/theme-authoring.md`** — Color system design, typography, wildcard minimum set, schema integration
- **`references/serialize-build.md`** — Serialize/build workflow: splitting themes into editable files, editing, rebuilding, validation, temporary folder guidance
- **`references/applying-themes.md`** — Applying templates, post-apply enforcement, clearing visual overrides, normalizing hardcoded colors
- **`references/copying-themes.md`** — Copying themes between reports, extracting/downloading themes, comparing themes, consolidating across a portfolio
- **`references/promoting-formatting.md`** — Promoting bespoke visual.json formatting to theme: push-visual CLI, objects vs visualContainerObjects, wildcard vs visual-type, property mapping tables
- **`references/theme-compliance.md`** — Systematic audit workflow, stale override classification, severity levels, fix decision tree
- **`references/visual-type-overrides.md`** — Override patterns for textbox, image, shape, card, kpi, slicer, lineChart, barChart, tableEx, and matrix

## Related Skills

- **`pbir-cli`** → `references/modifying-theme.md` — Full CLI command reference for theme operations (serialize/build, set-colors, set-text-classes, set-formatting, push-visual, fonts, background, icons, diff)
- **`pbir-cli`** → `references/apply-theme.md` — Applying templates, copying themes between reports, clearing visual overrides
- **`pbir-format`** (pbip plugin) — Full theme mechanics: ThemeDataColor syntax, filter pane selectors, jq modification patterns, clearing overrides
- **`pbi-report-design`** — Report design principles: 3-30-300 rule, layout, spacing, color usage, accessibility
