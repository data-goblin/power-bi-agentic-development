# Applying and Sharing Themes

Guide for applying theme templates, copying themes between reports, and managing a template library.

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
pbir theme apply-template "Report.Report" custom -f
```

## Copying Themes Between Reports

```bash
# Copy theme from one report to another
pbir cp "Source.Report/theme" "Target.Report/theme"

# Force overwrite if target already has a theme
pbir cp "Source.Report/theme" "Target.Report/theme" -f
```

## Saving a Theme as a Template

Promote a report's theme to a reusable template for other reports.

```bash
# Create template from a theme file
pbir theme create-template --new-template theme.json --name "my-brand" --description "Corporate brand theme"

# With author and recommendation status
pbir theme create-template --new-template theme.json --name "my-brand" \
  --description "Corporate brand theme" --author "Design Team" --recommended check

# Update an existing template with a new source file
pbir theme create-template updated-theme.json --update-template my-brand
```

Recommendation statuses for `--recommended`:
- `check` -- recommended for use
- `warning` -- usable but with caveats
- `none` -- no recommendation

## Comparing Themes

```bash
# Full comparison
pbir theme diff "Report1.Report" "Report2.Report"

# Colors only
pbir theme diff "Report1.Report" "Report2.Report" --colors

# Text classes only
pbir theme diff "Report1.Report" "Report2.Report" --text-classes

# Compare report theme against a standalone file
pbir theme diff "Report.Report" "exported-theme.json"

# Compare two serialized .Theme folders
pbir theme diff "BrandA.Theme" "BrandB.Theme"
```

## Clearing Visual-Level Formatting (Reset to Theme)

When applying a new theme, visual-level overrides (stored in `objects` and `visualContainerObjects` in each visual.json) take precedence over the theme. To enforce the new theme fully, clear these overrides first. This preserves field bindings, conditional formatting, position/size, and visual type -- only bespoke formatting is removed.

### Audit Before Clearing

Check what visual-level overrides currently exist and where they differ from the theme:

```bash
# See formatting sources for a specific visual (visual = bespoke override)
pbir visuals format "Report.Report/Page.Page/Visual.Visual"

# Check all visuals for hardcoded colors
pbir theme colors "Report.Report" --visuals --type literal

# Dry-run to preview what would be cleared
pbir visuals clear-formatting "Report.Report/**/*.Visual" --dry-run
```

### Clear All Visual Overrides

Clear `objects` and `visualContainerObjects` from all visuals in the report, resetting every visual to inherit purely from the theme:

```bash
# All visuals in the report (glob resolves relative to base_dir, cd into the report's parent first)
pbir visuals clear-formatting "Report.Report/**/*.Visual" -f

# All visuals on a single page
pbir visuals clear-formatting "Report.Report/Page.Page/*.Visual" -f

# A single visual
pbir visuals clear-formatting "Report.Report/Page.Page/Visual.Visual"
```

### Preserve Conditional Formatting (Recommended)

Use `--keep-cf` to retain conditional formatting entries in `objects` while clearing all other formatting overrides:

```bash
# Clear formatting but keep CF expressions intact
pbir visuals clear-formatting "Report.Report/**/*.Visual" --keep-cf -f
```

### Selective Clearing

Clear only specific layers of formatting:

```bash
# Clear only visualContainerObjects (title, border, background, shadow, padding)
# Preserves chart-specific objects (legend, axis, labels, dataPoint) and CF
pbir visuals clear-formatting "Report.Report/**/*.Visual" --only-containers -f

# Clear only visual.objects (chart-specific formatting)
# Preserves container formatting
pbir visuals clear-formatting "Report.Report/**/*.Visual" --only-objects -f

# Combine: clear only objects but keep CF within them
pbir visuals clear-formatting "Report.Report/**/*.Visual" --only-objects --keep-cf -f
```

### Full Theme Enforcement Workflow

```bash
# 1. Apply the new theme
pbir theme apply-template "Report.Report" new-brand -f

# 2. Clear visual-level overrides so theme takes full effect (preserve CF)
pbir visuals clear-formatting "Report.Report/**/*.Visual" --keep-cf -f

# 3. Normalize any remaining hardcoded colors to theme references
pbir theme colors "Report.Report" --normalize --apply

# 4. Validate
pbir validate "Report.Report"
```

**Warning**: Without `--keep-cf`, clearing `objects` also removes conditional formatting expressions, per-field formatting, and chart-specific settings (legend position, axis configuration, data label settings). Always use `--keep-cf` if the report uses conditional formatting.

## Typical Workflows

### Standardize All Reports to One Theme

```bash
# 1. Find all reports
pbir ls

# 2. Pick the golden-standard report and save its theme as template
pbir theme create-template --new-template golden-theme.json \
  --name "standard" --description "Company standard theme" --recommended check

# 3. Apply to each report
pbir theme apply-template "Report1.Report" standard -f
pbir theme apply-template "Report2.Report" standard -f

# 4. Clear visual-level overrides so theme takes full effect (preserve CF)
pbir visuals clear-formatting "Report1.Report/**/*.Visual" --keep-cf -f
pbir visuals clear-formatting "Report2.Report/**/*.Visual" --keep-cf -f

# 5. Normalize hardcoded colors in visuals to use theme references
pbir theme colors "Report1.Report" --normalize --apply
pbir theme colors "Report2.Report" --normalize --apply

# 6. Validate
pbir validate "Report1.Report"
pbir validate "Report2.Report"
```

### Rebrand a Report

```bash
# 1. Inspect current theme
pbir theme colors "Report.Report"
pbir theme fonts "Report.Report"

# 2. Update colors
pbir theme set-colors "Report.Report" --data-colors '["#1A1A2E","#16213E","#0F3460","#533483","#E94560"]'
pbir theme set-colors "Report.Report" --accent "#0F3460" --background "#FAFAFA"
pbir theme set-colors "Report.Report" --good "#2F9E44" --bad "#E03131" --neutral "#F59F00"

# 3. Update fonts
pbir theme fonts "Report.Report" --set-default "DIN"
pbir theme set-text-classes "Report.Report" title --font-face "DIN" --font-size 16 --bold

# 4. Update background
pbir theme background "Report.Report" --image new-logo.png

# 5. Normalize visuals to new theme colors
pbir theme colors "Report.Report" --normalize --apply

# 6. Validate
pbir theme validate "Report.Report"
```

### Extract Theme from Existing Report

```bash
# 1. Serialize to editable files
pbir theme serialize "Report.Report" -o Extracted.Theme --full

# 2. Review and clean up the serialized files

# 3. Push a well-formatted visual's settings into the theme
pbir theme push-visual "Report.Report/Page.Page/BestCard.Visual" --dry-run
pbir theme push-visual "Report.Report/Page.Page/BestCard.Visual"

# 4. Save as template for reuse
pbir theme create-template --new-template theme.json --name "extracted" \
  --description "Extracted from existing report"
```
