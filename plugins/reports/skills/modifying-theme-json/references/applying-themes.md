# Applying Themes

Apply theme templates, enforce theme compliance, and clear visual-level overrides so the theme renders correctly.

## Applying a Template

Templates are pre-built themes stored in `~/.pbir/templates/themes/`.

```bash
# List available templates
pbir theme list-templates

# Refresh bundled templates (after CLI updates)
pbir theme list-templates --refresh

# Apply a template to a report
pbir theme apply-template "Report.Report" sqlbi
pbir theme apply-template "Report.Report" CY24SU10

# Force overwrite existing theme
pbir theme apply-template "Report.Report" corporate-brand -f
```

## Post-Apply Enforcement

Applying a new theme does not automatically clear visual-level overrides. Existing `objects` and `visualContainerObjects` in each visual.json take precedence over the theme, so visuals may not reflect the new theme until overrides are cleared.

### Full Enforcement Workflow

```bash
# 1. Apply the new theme
pbir theme apply-template "Report.Report" corporate-brand -f

# 2. Clear visual-level overrides (preserve conditional formatting)
pbir visuals clear-formatting "Report.Report/**/*.Visual" --keep-cf -f

# 3. Normalize hardcoded colors to theme references
pbir theme colors "Report.Report" --normalize --apply

# 4. Validate
pbir validate "Report.Report"
```

## Clearing Visual-Level Overrides

Visual-level overrides (stored in `objects` and `visualContainerObjects` in each visual.json) override the theme. Clearing them resets visuals to inherit from the theme. This preserves field bindings, conditional formatting (with `--keep-cf`), position/size, and visual type.

### Audit Before Clearing

Check what overrides exist and where they differ from the theme:

```bash
# See formatting sources for a specific visual (visual = bespoke override)
pbir visuals format "Report.Report/Page.Page/Visual.Visual"

# Check all visuals for hardcoded colors
pbir theme colors "Report.Report" --visuals --type literal

# Dry-run: preview what would be cleared
pbir visuals clear-formatting "Report.Report/**/*.Visual" --dry-run
```

### Clear All Visual Overrides

```bash
# All visuals in the report
pbir visuals clear-formatting "Report.Report/**/*.Visual" -f

# All visuals on a single page
pbir visuals clear-formatting "Report.Report/Page.Page/*.Visual" -f

# A single visual
pbir visuals clear-formatting "Report.Report/Page.Page/Visual.Visual"
```

### Preserve Conditional Formatting (Recommended)

Use `--keep-cf` to retain conditional formatting entries in `objects` while clearing all other formatting overrides:

```bash
pbir visuals clear-formatting "Report.Report/**/*.Visual" --keep-cf -f
```

### Selective Clearing

Clear only specific layers of formatting:

```bash
# Clear only container chrome (title, border, background, shadow, padding)
# Preserves chart-specific objects (legend, axis, labels, dataPoint) and CF
pbir visuals clear-formatting "Report.Report/**/*.Visual" --only-containers -f

# Clear only chart-specific formatting
# Preserves container chrome
pbir visuals clear-formatting "Report.Report/**/*.Visual" --only-objects -f

# Combine: clear chart-specific but keep CF within them
pbir visuals clear-formatting "Report.Report/**/*.Visual" --only-objects --keep-cf -f
```

> Without `--keep-cf`, clearing `objects` also removes conditional formatting expressions, per-field formatting, and chart-specific settings (legend position, axis configuration, data label settings). Always use `--keep-cf` if the report uses conditional formatting.

## Normalizing Hardcoded Colors

Replace hardcoded hex colors in visuals with theme references for maintainability:

```bash
# Dry-run: see what would change
pbir theme colors "Report.Report" --normalize

# Apply normalization
pbir theme colors "Report.Report" --normalize --apply

# Adjust match tolerance (Delta-E color distance, default 15.0)
pbir theme colors "Report.Report" --normalize --max-distance 10 --apply

# Replace a specific color everywhere
pbir theme colors "Report.Report" --replace --from "#118DFF" --to theme:0

# Replace with a named color
pbir theme colors "Report.Report" --replace --from "#118DFF" --to named:good

# Scope replacement to a specific property
pbir theme colors "Report.Report" --replace --from "#118DFF" --to theme:0 --in fill
```

## Renaming Theme File

After applying or modifying a theme, rename the file to match its content:

```bash
# Rename using the name field from theme.json
pbir theme rename "Report.Report"

# Rename to a specific name
pbir theme rename "Report.Report" "CorporateBrand"
```
