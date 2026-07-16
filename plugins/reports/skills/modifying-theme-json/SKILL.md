---
name: modifying-theme-json
description: Design, enforce, audit, and validate Power BI report themes through the pbir CLI. Invoke when a report uses a default or minimal theme, visuals have inconsistent formatting or many local overrides, or the user asks to create, copy, apply, standardize, rebrand, audit, or validate a theme; change theme colors or typography; promote visual formatting into the theme; clear overrides; or improve theme compliance.
---

# Power BI report themes

Use this skill for theme design and compliance decisions. Use the `pbir-cli` skill for command details.

## Non-negotiable tooling rule

Use `pbir` for every report and theme mutation. Never edit `theme.json`, `visual.json`, serialized `.Theme` fragments, or other report JSON directly. Never fall back to `jq`, shell replacement, or a JSON-editing skill. If `pbir` lacks the required operation, stop and report the missing capability.

Read JSON only through `pbir cat`, `pbir get`, or read-only examples. Prefer structured CLI inspection commands because they explain the formatting cascade and usage.

## Why themes matter

A theme centralizes formatting that would otherwise drift across visuals. It should own repeated choices such as:

- Data-series palette and semantic good/neutral/bad colors
- Background, foreground, structural, gradient, hyperlink, and null colors
- Font family, size, weight, and hierarchy
- Wildcard container defaults such as titles, borders, padding, and shadows
- Visual-type defaults for cards, slicers, charts, tables, textboxes, and images

Visual-level overrides should remain only for content-specific exceptions or conditional formatting. Theme-first reports are easier to rebrand, diff, and maintain.

## Formatting cascade

```text
Power BI defaults
  -> theme wildcard defaults
  -> theme visual-type defaults
  -> visual instance overrides
```

The last layer wins. Diagnose unexpected rendering with `pbir visuals format`, which reports the effective value and source; do not inspect or patch `visual.json`.

## Audit before changing

```bash
pbir theme colors "Report.Report"
pbir theme fonts "Report.Report"
pbir color list "Report.Report"
pbir fonts list "Report.Report"
pbir visuals format "Report.Report/Page.Page/Visual.Visual"
pbir bpa run "Report.Report"
```

Look for hard-coded colors, repeated visual-level font or container overrides, inconsistent visual types, weak contrast, excessive palette size, and sentiment colors that change meaning between visuals.

## Design rules

1. Limit the data palette to the number of categories the report genuinely needs.
2. Reserve saturated accent colors for focus, selection, exceptions, and key comparisons.
3. Assign one stable meaning to each semantic color. Good, neutral, bad, selected, disabled, and hyperlink colors must not trade roles across pages.
4. Keep structural colors quiet. Axes, borders, gridlines, and backgrounds should support reading rather than compete with data.
5. Use one portable font family and a small type scale. Express hierarchy through size and weight, not many colors.
6. Prefer wildcard defaults, then visual-type defaults, then rare instance overrides.
7. Preserve accessible contrast and never rely on hue alone to communicate state.

## Author through `pbir`

Start from a valid template or the report's existing theme; do not author an empty theme.

```bash
# Apply a known base when requested
pbir theme list-templates
pbir theme apply-template "Report.Report" sqlbi

# Set palette and semantic colors
pbir theme set-colors "Report.Report" \
  --data-colors '["#1971C2","#F08C00","#2F9E44","#7048E8"]' \
  --good "#2E7D32" --neutral "#6B7280" --bad "#C62828" \
  --background "#FFFFFF" --foreground "#252525"

# Set typography by semantic level
pbir theme set-fonts "Report.Report" title --font-face "Segoe UI Semibold" --font-size 14
pbir theme set-fonts "Report.Report" label --font-face "Segoe UI" --font-size 10
pbir theme set-fonts "Report.Report" callout --font-face "Segoe UI Semibold" --font-size 32

# Set repeated formatting at theme level
pbir theme set-formatting "Report.Report" "*.*.dropShadow.show" --value false
pbir theme set-formatting "Report.Report" "*.*.border.show" --value false
pbir theme set-formatting "Report.Report" "card.*.title.fontSize" --value 14
```

Run `pbir schema describe <visualType> <object>` before authoring unfamiliar formatting properties.

## Promote a good visual into the theme

```bash
pbir theme push-visual "Report.Report/Page.Page/BestCard.Visual" --dry-run
pbir theme push-visual "Report.Report/Page.Page/BestCard.Visual"
```

Use this when a well-designed instance should become the default for its visual type. Inspect the dry run first so content-specific formatting is not promoted accidentally.

## Enforce theme inheritance

Clearing overrides is destructive and must be confirmed with the user. Preserve conditional formatting unless the user explicitly wants it removed.

```bash
pbir visuals clear-formatting "Report.Report/**/*.Visual" --keep-cf --dry-run -f
pbir visuals clear-formatting "Report.Report/**/*.Visual" --keep-cf -f
pbir theme colors "Report.Report" --normalize
pbir theme colors "Report.Report" --normalize --apply
```

For selective cleanup, use the flags documented by `pbir visuals clear-formatting --help` rather than broad file edits.

## Copy or replace a theme

```bash
pbir cp "Source.Report/theme" "Target.Report/theme" -f
pbir theme validate "Target.Report"
```

After a theme swap, clear stale visual overrides, normalize surviving color literals, and inspect foreground/background polarity so text does not become invisible.

## Validate and render

Use one confidence pass after a coherent batch:

```bash
pbir theme validate "Report.Report"
pbir validate "Report.Report" --all
pbir desktop refresh "Report.Report"
pbir desktop screenshot "Report.Report" --all --output-dir screenshots
```

Desktop refresh does not reload theme resources. Close and reopen the report before judging theme changes, then capture screenshots. If Desktop is unavailable, ask before publishing to a sandbox workspace for rendered verification.

## Detailed references

- `pbir-cli` -> `references/modifying-theme.md`: colors, fonts, formatting, normalization, validation
- `pbir-cli` -> `references/apply-theme.md`: templates, copying, clearing overrides
- `pbir-cli` -> `references/format-visuals.md`: cascade inspection and property discovery
- `pbi-report-design`: layout, restrained color use, hierarchy, and accessibility
