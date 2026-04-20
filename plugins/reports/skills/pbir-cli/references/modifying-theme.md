# Modifying a Theme

Comprehensive guide to inspecting and modifying Power BI report themes using the pbir CLI.

## Inspection: Understand Before Modifying

```bash
# Full theme JSON
pbir cat "Report.Report/theme"

# Color palette with usage audit (which visuals use each color)
pbir theme colors "Report.Report"

# Audit hardcoded colors in visuals
pbir theme colors "Report.Report" --visuals

# Filter by color type: literal, theme, measure, gradient, conditional, named
pbir theme colors "Report.Report" --visuals --type literal

# Text class definitions (title, label, callout, header, etc.)
pbir theme text-classes "Report.Report"

# Font usage and validation
pbir theme fonts "Report.Report"
pbir theme fonts "Report.Report" --validate          # Check for invalid fonts
pbir theme fonts --list-supported                    # 26 supported PBI fonts

# Compare themes
pbir theme diff "Report1.Report" "Report2.Report"
pbir theme diff "Report.Report" "theme.json"         # Compare against file
pbir theme diff "Report.Report" "Report.Report" --colors  # Colors only
```

## Serialize/Build Workflow (Recommended for Large Changes)

For substantial theme edits, serialize the theme into separate editable files, modify them, then rebuild. This saves tokens and makes changes more manageable.

```bash
# Step 1: Serialize into a .Theme folder
pbir theme serialize "Report.Report"                 # Creates Report.Theme/
pbir theme serialize "Report.Report" -o MyTheme.Theme
pbir theme serialize "Report.Report" --full          # Include all supported properties

# Step 2: Edit the serialized files (colors.json, textClasses.json, etc.)
# These are small, focused JSON files

# Step 3: Build back into theme.json and apply to report
pbir theme build "MyTheme.Theme"                     # Build only
pbir theme build "MyTheme.Theme" -o "Report.Report"  # Build and apply
pbir theme build "MyTheme.Theme" -o "Report.Report" -f --clean  # Overwrite + cleanup
```

## Setting Colors

### Named Color Keys

Named colors are referenced by DAX measures for conditional formatting (e.g., `"good"`, `"bad"`).

```bash
# Sentiment colors (used by conditional formatting measures)
pbir theme set-colors "Report.Report" --good "#00B050" --bad "#FF0000" --neutral "#FFC000"

# Background/foreground
pbir theme set-colors "Report.Report" --background "#FFFFFF" --foreground "#323232"
pbir theme set-colors "Report.Report" --background-light "#F8F9FA"
pbir theme set-colors "Report.Report" --foreground-neutral-dark "#605E5C"

# Accent and structural
pbir theme set-colors "Report.Report" --accent "#118DFF" --table-accent "#118DFF"
pbir theme set-colors "Report.Report" --shape-stroke "#E0E0E0"

# Map, hyperlink, hierarchy
pbir theme set-colors "Report.Report" --hyperlink "#1971C2" --visited-hyperlink "#8B5CF6"
pbir theme set-colors "Report.Report" --map-pushpin "#118DFF"

# Gradient colors (min/center/max for gauges, conditional heatmaps)
pbir theme set-colors "Report.Report" --minimum "#FF0000" --center "#FFC000" --maximum "#00B050"
```

### Data Theme Colors (Series Palette)

The data color array controls the default colors assigned to series in charts.

```bash
# Set data colors (JSON array)
pbir theme set-colors "Report.Report" --data-colors '["#1971C2","#F08C00","#2F9E44","#7048E8","#E64980"]'

# Limit to first N colors (useful for decluttering)
pbir theme set-colors "Report.Report" --data-colors-limit 6
```

### Normalizing Hardcoded Colors

Replace hardcoded hex colors in visuals with theme references for maintainability.

```bash
# Dry-run: see what would change
pbir theme colors "Report.Report" --normalize

# Apply normalization
pbir theme colors "Report.Report" --normalize --apply

# Adjust match tolerance (Delta-E color distance, default 15.0)
pbir theme colors "Report.Report" --normalize --max-distance 10 --apply

# Replace a specific color
pbir theme colors "Report.Report" --replace --from "#118DFF" --to theme:0
pbir theme colors "Report.Report" --replace --from "#118DFF" --to named:good
pbir theme colors "Report.Report" --replace --from "#118DFF" --to "#1971C2"

# Dry-run a replacement
pbir theme colors "Report.Report" --replace --from "#118DFF" --to theme:0 --dry-run

# Scope replacement to specific property
pbir theme colors "Report.Report" --replace --from "#118DFF" --to theme:0 --in fill
```

## Setting Text Classes

Text classes define default text styles used across the report (title, label, callout, etc.).

```bash
# Available text classes:
#   title, label, callout, header, largeTitle, dataTitle,
#   boldLabel, largeLabel, largeLightLabel, lightLabel,
#   semiboldLabel, smallLabel, smallLightLabel, smallDataLabel

pbir theme set-text-classes "Report.Report" title --font-size 14 --font-face "Segoe UI Semibold"
pbir theme set-text-classes "Report.Report" label --font-size 10 --color "#605E5C"
pbir theme set-text-classes "Report.Report" callout --font-size 48 --bold
pbir theme set-text-classes "Report.Report" header --font-size 12 --font-face "DIN"
```

## Setting Fonts

```bash
# Replace a font globally in the theme
pbir theme fonts "Report.Report" --replace "Arial" --with "DIN"

# Set all text classes to the same font
pbir theme fonts "Report.Report" --set-default "Segoe UI"

# Auto-fix invalid fonts (suggests closest supported match)
pbir theme fonts "Report.Report" --fix
```

## Setting Background Image

```bash
# Set background image (auto base64-encoded; supports PNG, JPG, GIF, SVG)
pbir theme background "Report.Report" --image logo.png

# Check current background
pbir theme background "Report.Report" --show

# Remove background
pbir theme background "Report.Report" --clear
```

## Setting Default Formatting for Visual Types

Use `set-formatting` to define defaults that apply to all visuals of a type (or all types via wildcard).

Path format: `{visualType}.{state}.{property}.{subproperty}`
- `visualType`: `*` (all types) or specific type (`card`, `lineChart`, `tableEx`, etc.)
- `state`: `*` (default) or `hover`, `press`, `selected`

```bash
# All visuals: default title size
pbir theme set-formatting "Report.Report" "*.*.title.fontSize" --value 14

# All visuals: background color
pbir theme set-formatting "Report.Report" "*.*.background.color" --value "#F5F5F5"

# Cards: border radius
pbir theme set-formatting "Report.Report" "card.*.border.radius" --value 8
pbir theme set-formatting "Report.Report" "card.*.title.show" --value true

# Line charts: show markers
pbir theme set-formatting "Report.Report" "lineChart.*.lineStyles.showMarker" --value true

# Tables: grid lines
pbir theme set-formatting "Report.Report" "tableEx.*.grid.gridVertical" --value true

# Set raw JSON for complex values
pbir theme set-formatting "Report.Report" "card.*.border" --json '{"show": true, "color": "#E0E0E0", "radius": 8}'
```

## Push Visual Formatting to Theme

Extract formatting from a well-formatted visual and apply it as the theme default for that visual type.

```bash
# Push all formatting from a visual to theme
pbir theme push-visual "Report.Report/Page.Page/Chart.Visual"

# Push only specific components
pbir theme push-visual "Report.Report/Page.Page/Card.Visual" --components title,background,border

# Preview what would be pushed (dry-run)
pbir theme push-visual "Report.Report/Page.Page/Card.Visual" --dry-run

# Include selector-based properties (advanced)
pbir theme push-visual "Report.Report/Page.Page/Chart.Visual" --include-selectors
```

## Custom Icons

```bash
# List current icons
pbir theme icons "Report.Report"

# Add/update an icon (data URI or URL)
pbir theme icons "Report.Report" --set "arrow" --url "data:image/svg+xml;utf8,<svg>...</svg>"
pbir theme icons "Report.Report" --add "star" --url "data:image/svg+xml;utf8,<svg>...</svg>" -d "Star icon"

# Remove an icon
pbir theme icons "Report.Report" --remove "arrow"
```

## Renaming Theme File

```bash
# Rename using name from theme.json
pbir theme rename "Report.Report"

# Rename to specific name
pbir theme rename "Report.Report" "MyCustomTheme"

# Rename a non-active theme file
pbir theme rename "Report.Report" "Rebranded" --theme-file OldThemeName.json
```

## Validation

Always validate after modifications:

```bash
pbir theme validate "Report.Report"
pbir theme validate "theme.json"                     # Validate standalone file
pbir theme validate "CustomTheme.Theme"              # Validate serialized folder
```

## Recommended Workflow

1. **Understand intent**: **Use `AskUserQuestion`** to discuss what the user wants the report to feel like -- brand colors, visual tone, data density. This shapes color palette, font choices, and default formatting
2. **Inspect**: `pbir theme colors`, `pbir theme text-classes`, `pbir theme fonts`
3. **Serialize** (for large changes): `pbir theme serialize "Report.Report" -o Work.Theme`
4. **Modify**: Use `set-colors`, `set-text-classes`, `set-formatting`, or edit serialized files
5. **Build** (if serialized): `pbir theme build "Work.Theme" -o "Report.Report" -f --clean`
6. **Clear visual overrides** (if enforcing a new theme): `pbir visuals clear-formatting "Report.Report/**/*.Visual" --keep-cf -f` -- see **`references/apply-theme.md` > Clearing Visual-Level Formatting** for selective clearing options
7. **Normalize**: `pbir theme colors "Report.Report" --normalize --apply`
8. **Validate**: `pbir theme validate "Report.Report"` + `pbir validate "Report.Report"`
9. **Verify**: `pbir visuals format "Report.Report/Page.Page/Visual.Visual"` to confirm cascade
