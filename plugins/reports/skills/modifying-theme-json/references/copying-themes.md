# Copying and Sharing Themes

Move themes between reports, extract themes for reuse, and consolidate themes across a portfolio.

## Copying a Theme Between Reports

```bash
# Copy theme from one report to another
pbir cp "Source.Report/theme" "Target.Report/theme"

# Force overwrite if the target already has a theme
pbir cp "Source.Report/theme" "Target.Report/theme" -f
```

After copying, clear visual-level overrides in the target so the new theme takes full effect:

```bash
pbir visuals clear-formatting "Target.Report/**/*.Visual" --keep-cf -f
pbir theme colors "Target.Report" --normalize --apply
pbir validate "Target.Report"
```

## Extracting a Theme from a Report

### As a Standalone JSON File

```bash
# Output the full theme JSON
pbir cat "Report.Report/theme" > extracted-theme.json
```

### As a Serialized .Theme Folder

```bash
# Serialize for editing and reuse
pbir theme serialize "Report.Report" -o /tmp/Extracted.Theme
```

### As a Reusable Template

Save a theme to the template library for applying to other reports:

```bash
# Create a named template from a report's theme
pbir theme create-template --new-template theme.json \
  --name "corporate-brand" \
  --description "Corporate brand theme with approved palette" \
  --author "Design Team" \
  --recommended check

# Create from a report directly (extract + save in one step)
pbir cat "Report.Report/theme" > /tmp/theme.json
pbir theme create-template --new-template /tmp/theme.json --name "corporate-brand"
```

Recommendation statuses:
- `check` -- recommended for use
- `warning` -- usable but with caveats
- `none` -- no recommendation

## Downloading Themes

### From a Fabric Workspace

Download the report first, then extract its theme:

```bash
pbir download "My Workspace.Workspace/Report.Report" -o ./downloaded
pbir cat "downloaded/Report.Report/theme" > theme.json
```

### From Power BI Service

In the Power BI service UI: View > Themes > Save current theme. This exports the theme as a JSON file. Import it into the CLI workflow by saving it locally and using `pbir theme serialize` or applying it directly.

### From the Community

Community theme templates are available at [deldersveld/PowerBI-ThemeTemplates](https://github.com/deldersveld/PowerBI-ThemeTemplates). Download the JSON file and apply with:

```bash
pbir theme apply-template "Report.Report" --from-file downloaded-theme.json
```

Or serialize for customization first:

```bash
pbir theme serialize downloaded-theme.json -o /tmp/Custom.Theme
# Edit files in /tmp/Custom.Theme/
pbir theme build /tmp/Custom.Theme -o "Report.Report" -f --clean
```

## Comparing Themes

Before copying or consolidating, compare themes to understand differences:

```bash
# Full comparison between two reports
pbir theme diff "Report1.Report" "Report2.Report"

# Colors only
pbir theme diff "Report1.Report" "Report2.Report" --colors

# Text classes only
pbir theme diff "Report1.Report" "Report2.Report" --text-classes

# Compare a report theme against a standalone file
pbir theme diff "Report.Report" "reference-theme.json"

# Compare two serialized .Theme folders
pbir theme diff "BrandA.Theme" "BrandB.Theme"
```

## Consolidating Themes Across Reports

When multiple reports have diverged from a standard theme, consolidate:

### Step 1 -- Identify the Golden Standard

Pick the report with the best-maintained theme, or start from a template:

```bash
pbir theme list-templates
```

### Step 2 -- Compare Each Report Against the Standard

```bash
pbir theme diff "Standard.Report" "Report1.Report"
pbir theme diff "Standard.Report" "Report2.Report"
```

### Step 3 -- Apply the Standard and Enforce

```bash
# Apply template to each report
pbir theme apply-template "Report1.Report" corporate-brand -f
pbir theme apply-template "Report2.Report" corporate-brand -f

# Clear visual-level overrides so the theme takes full effect
pbir visuals clear-formatting "Report1.Report/**/*.Visual" --keep-cf -f
pbir visuals clear-formatting "Report2.Report/**/*.Visual" --keep-cf -f

# Normalize hardcoded colors to theme references
pbir theme colors "Report1.Report" --normalize --apply
pbir theme colors "Report2.Report" --normalize --apply

# Validate
pbir validate "Report1.Report"
pbir validate "Report2.Report"
```

### Step 4 -- Save Updated Template

If the standard was modified during consolidation, update the template:

```bash
pbir cat "Standard.Report/theme" > /tmp/updated-standard.json
pbir theme create-template /tmp/updated-standard.json --update-template corporate-brand
```
