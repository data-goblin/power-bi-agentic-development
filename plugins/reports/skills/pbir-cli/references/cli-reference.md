# pbir CLI -- Complete Command Reference

Complete command reference for the pbir CLI. All commands prefixed with `pbir`.

## Table of Contents
- [Navigation and Discovery](#navigation-and-discovery)
- [Property Management](#property-management)
- [Report Creation and Management](#report-creation-and-management)
- [Page Operations](#page-operations)
- [Visual Operations](#visual-operations)
- [Theme Operations](#theme-operations)
- [DAX Operations](#dax-operations)
- [Field Operations](#field-operations)
- [Filter Operations](#filter-operations)
- [Bookmark Operations](#bookmark-operations)
- [Annotation Operations](#annotation-operations)
- [Connection and Fabric](#connection-and-fabric)
- [Configuration and Setup](#configuration-and-setup)
- [Visual Types Reference](#visual-types-reference)

---

## Navigation and Discovery

```bash
# List reports in base directory
pbir ls                                          # All reports with counts
pbir ls --tree                                   # All reports with tree structure
pbir ls "Report.Report"                          # Contents of a report (pages, filters, theme)
pbir ls "Report.Report/Page.Page"                # Visuals on a page

# Tree structure
pbir tree "Report.Report"                        # Hierarchical view
pbir tree "Report.Report" -v                     # Verbose: include field bindings per visual

# Display JSON content
pbir cat "Report.Report/Page.Page"               # Page JSON
pbir cat "Report.Report/Page.Page/Visual.Visual"  # Visual JSON
pbir cat "Report.Report/reportExtensions"         # reportExtensions.json
pbir cat "Report.Report/ThemeName.Theme"          # Theme JSON

# Find by glob pattern
pbir find "*.Report"                             # All reports
pbir find "Report.Report/**/*.Visual"            # All visuals in report
pbir find "**/*card*.Visual"                     # All card-named visuals
pbir find "**/*.Visual" --type visual --count    # Count all visuals
pbir find "**/*.Page" --json                     # JSON output

# Compare (use theme diff for themes)
pbir theme diff "R1.Report" "R2.Report"          # Compare themes
```

## Property Management

```bash
# Get properties
pbir get "Report.Report"                                          # Report properties
pbir get "Report.Report/Page.Page"                                # Page properties
pbir get "Report.Report/Page.Page/Visual.Visual"                  # Visual properties (all)

# Set properties (supports glob patterns for bulk)
pbir set "Report.Report/Page.Page/Visual.Visual.title.text" --value "Revenue"
pbir set "Report.Report/Page.Page/Visual.Visual.title.fontSize" --value 14
pbir set "Report.Report/**/*.Visual.title.show" --value false -f  # Glob: all visuals
pbir set "Report.Report/**/*.Visual.border.show" --value true -f  # Glob: all borders
pbir set "path" --property "background.color" --value "#F0F0F0"   # Alternative syntax
pbir set "path" --json '{"title": {"show": true, "text": "Sales"}}'  # JSON input

# Discover properties
pbir visuals properties "Report.Report/Page.Page/Visual.Visual"   # Tree view of all properties
pbir visuals format "Report.Report/Page.Page/Visual.Visual"       # Merged theme + visual values
```

## Report Creation and Management

```bash
# Create new report
pbir new report "Sales.Report" -c "MyWorkspace/Sales.SemanticModel"
pbir new report "Sales.Report" --from-template my-dashboard
pbir new report --list-templates

# Rebind to different model
pbir report rebind "Report.Report" "Workspace/Model.SemanticModel"

# Format conversion
pbir report convert "Report.Report" -F pbix      # Convert to PBIX
pbir report convert "Report.Report" -F pbip      # Convert to PBIP

# Merge and split
pbir report merge "R1.Report" "R2.Report" -o "Combined.Report"
pbir report merge-to-thick "Report.Report" "Model.SemanticModel"
pbir report split-pages "Report.Report" -o ./split
pbir report split-from-thick "ThickReport" --target "Workspace/Model"

# Copy
pbir cp "Source.Report" "Target.Report"                   # Copy report
pbir cp "Source.Report" "Target.Report" --format pbix     # Copy and convert

# Delete
pbir rm "Report.Report/Page.Page" -f              # Remove page
pbir rm "Report.Report/Page.Page/Visual.Visual" -f  # Remove visual
pbir rm "Report.Report/filter:Name" -f             # Remove filter
pbir rm "Report.Report/bookmark:Name" -f           # Remove bookmark
pbir rm "Report.Report" --measures -f              # Remove all extension measures
pbir rm "Report.Report" --theme -f                 # Remove custom theme
pbir rm "Report.Report" --annotations -f           # Remove all annotations
pbir rm "Report.Report" --all -f                   # Remove filters+bookmarks+annotations

# Other
pbir report clear-diagram "Report.Report"          # Delete diagram layout
pbir open "Report.Report"                          # Open in Power BI Desktop
pbir validate "Report.Report"                      # Validate structure
```

## Page Operations

```bash
# Add page
pbir add page "Report.Report/Dashboard.Page" -n "Dashboard"
pbir add page "Report.Report/Overview.Page" -n "Overview" --width 1920 --height 1080
pbir add page "Report.Report/Page.Page" --from-template executive-dashboard
pbir add page --list-templates

# Rename and move
pbir pages rename "Report.Report/Old.Page" "New Name"
pbir pages move "Report.Report/Sales.Page" --to 1

# Resize and type
pbir pages resize "Report.Report/Page.Page" --width 1920 --height 1080
pbir pages type "Report.Report/Page.Page" --type 16:9    # Also: 4:3, letter, tooltip, custom
pbir pages display "Report.Report/Page.Page" -o FitToWidth   # FitToPage, FitToWidth, ActualSize

# Visibility
pbir pages hide "Report.Report/Page.Page"                 # Hide in view mode
pbir pages hide "Report.Report/Page.Page" --show           # Show (unhide)

# Styling
pbir pages background "Report.Report/Page.Page" --color "#F0F8FF"
pbir pages background "Report.Report/Page.Page" --image bg.png
pbir pages wallpaper "Report.Report/Page.Page" --color "#2B579A"

# Active page and interactions
pbir pages active-page "Report.Report" "HomePage"
pbir pages interactions "Report.Report/Page.Page"          # List visual interactions
pbir pages json "Report.Report/Page.Page"                  # Raw page JSON

# Copy/move between reports
pbir cp "R1.Report/Page.Page" "R2.Report/NewPage.Page"
pbir mv "R1.Report/Page.Page" "R2.Report/Page.Page"
```

## Visual Operations

### Creation

```bash
# Single visual
pbir add visual card "Report.Report/Page.Page" --title "Revenue"
pbir add visual card "Report.Report/Page.Page" -d "Values:Sales.Revenue" --x 100 --y 50
pbir add visual lineChart "Report.Report/Page.Page" --title "Trend" --width 600 --height 400
pbir add visual tableEx "Report.Report/Page.Page" --title "Detail"
pbir add visual kpi "Report.Report/Page.Page" -d "Indicator:Sales.Revenue"
pbir add visual --list                            # List all 50+ visual types with data roles

# Bulk creation from JSON
pbir add visual "Report.Report/Page.Page" --from-json visuals.json
# JSON format: [{"visual_type": "card", "x": 0, "y": 0, "title": "Sales", "fields": {"Values": "Sales.Revenue"}}]

# Title/subtitle textboxes
pbir add title "Report.Report/Page.Page" "Sales Dashboard"
pbir add subtitle "Report.Report/Page.Page" "Q4 2025 Performance"
```

### Position and Layout

```bash
# Position and size
pbir visuals position "Visual.Visual" --x 100 --y 50 --width 400 --height 300
pbir visuals resize "Visual.Visual" --width 400 --height 300

# Alignment (multiple visuals)
pbir visuals align "Report.Report/Page.Page" left Visual1 Visual2 Visual3
pbir visuals align "Report.Report/Page.Page" top Visual1 Visual2
pbir visuals align "Report.Report/Page.Page" distribute-horizontal V1 V2 V3

# Z-order, snap, mobile
pbir visuals z-order "Visual.Visual"             # View/manage layer stacking
pbir visuals snap "Visual.Visual"                # Snap to grid
pbir visuals mobile "Visual.Visual"              # Get/set mobile layout
pbir visuals group "Report.Report/Page.Page"     # Manage visual groups
```

### Container Formatting (all visual types)

```bash
# Title and subtitle
pbir visuals title "Visual.Visual" --text "Title" --show --fontSize 14 --fontColor "#333"
pbir visuals title "Visual.Visual" --bold --alignment center
pbir visuals subtitle "Visual.Visual" --text "Subtitle" --show

# Background, border, shadow
pbir visuals background "Visual.Visual" --color "#FFFFFF" --transparency 0
pbir visuals border "Visual.Visual" --show --color "#E0E0E0" --radius 8 --width 1
pbir visuals shadow "Visual.Visual" --show       # Drop shadow

# Padding and spacing
pbir visuals padding "Visual.Visual" --top 10 --bottom 10 --left 10 --right 10
pbir visuals spacing "Visual.Visual"             # Component spacing
pbir visuals divider "Visual.Visual" --show      # Title/subtitle divider

# Header and tooltip
pbir visuals header "Visual.Visual" --show       # Visual header icons
pbir visuals tooltip "Visual.Visual"             # Tooltip configuration
pbir visuals general "Visual.Visual"             # General properties

# Visibility and presets
pbir visuals hide "Visual.Visual"                # Hide visual
pbir visuals hide "Visual.Visual" --show         # Show visual
pbir visuals preset "Visual.Visual"              # Apply style presets

# Clear formatting (reset to theme defaults)
pbir visuals clear-formatting "Report.Report/**/*.Visual" -f          # All visuals in report
pbir visuals clear-formatting "Report.Report/Page.Page/*.Visual" -f   # All on page
pbir visuals clear-formatting "Visual.Visual"                         # Single visual
pbir visuals clear-formatting "Report.Report/**/*.Visual" --only-containers -f  # VCO only (safe, keeps CF)
pbir visuals clear-formatting "Report.Report/**/*.Visual" --keep-cf -f         # Keep CF entries
pbir visuals clear-formatting "Report.Report/**/*.Visual" --dry-run            # Preview changes
```

### Chart-Specific Formatting

```bash
# Legend (22 visual types)
pbir visuals legend "Visual.Visual" --show --position Right

# Axes
pbir visuals axis "Visual.Visual" --axis category --show --title "Category"
pbir visuals axis "Visual.Visual" --axis value --show --title "Amount"

# Data labels (22 visual types)
pbir visuals labels "Visual.Visual" --show --fontSize 10

# Sorting
pbir visuals sort "Visual.Visual" -f "Sales.Revenue" -d Descending
pbir visuals sort "Visual.Visual" --remove
```

### Data Binding

```bash
# Show current bindings and available roles
pbir visuals bind "Visual.Visual" --show
pbir visuals bind "Visual.Visual" --list-roles

# Add fields
pbir visuals bind "Visual.Visual" -a "Values:Sales.Revenue"
pbir visuals bind "Visual.Visual" -a "Category:Products.Category" -t Column
pbir visuals bind "Visual.Visual" -a "Values:Sales.TotalSales" -t Measure

# Remove and clear
pbir visuals bind "Visual.Visual" -r "Values:Sales.Revenue"
pbir visuals bind "Visual.Visual" -c "Values"    # Clear entire role
```

### Conditional Formatting

Two surfaces share one model:

- **`pbir set` / `pbir get`** — dot-path reads and scalar edits on existing CF entries.
- **`pbir visuals cf`** — structural authoring (create, copy, convert).

```bash
# Create measure-based CF (structural — stays on `visuals cf`)
pbir visuals cf "Visual.Visual" --measure "labels.color _Fmt.StatusColor"
pbir visuals cf "Visual.Visual" --measure "dataPoint.fill _Fmt.BarColor"

# Read CF via pbir get (.cf tail)
pbir get "Visual.Visual.dataPoint.fill.cf"                              # ASCII summary
pbir get "Visual.Visual.dataPoint.fill.cf.gradient.min.color"           # scalar leaf
pbir get "Visual.Visual.dataPoint.fill.cf" --json                       # raw JSON
pbir get "Report.Report/**/*.Visual.**.cf"                              # bulk read

# Edit CF leaves via pbir set
pbir set "Visual.Visual.dataPoint.fill.cf.gradient.min.color" --value "bad"
pbir set "Visual.Visual.dataPoint.fill.cf.gradient.max.value" --value 250
pbir set "Visual.Visual.labels.color.cf.rules.case[0].color" --value "alertRed"
pbir set "Visual.Visual.labels.color.cf.rules.else.color"   --value "foreground"
pbir set "Visual.Visual.dataPoint.fill.cf.measure"          --value "_Fmt.NewColor"

# Remove CF (aliases: --remove / --clear)
pbir set "Visual.Visual.dataPoint.fill.cf" --remove
pbir set "Visual.Visual.**.cf" --remove -f                              # bulk wipe

# Per-field / per-series / interaction-state selectors compose with .cf
pbir set "Visual.Visual.values.field(Sales.Revenue).fontColor" --value "#118DFF"
pbir set "Visual.Visual.dataPoint.series(Cities.City=Antwerp).fill" --value "#E66C37"
pbir set "Visual.Visual.y1AxisReferenceLine.id(2).lineColor" --value "#FF0000"
pbir set "Visual.Visual.labels.hover.fontColor" --value "#E3F2FD"

# Convert / copy / theme-tokenize (structural — retained on `visuals cf`)
pbir visuals cf "Visual.Visual" --theme-colors "dataPoint.fill"             # Hex -> theme tokens
pbir visuals cf "Visual.Visual" --to-measure dataPoint.fill                 # Convert to extension measure
pbir visuals cf "Target.Visual" --copy-from "Source.Visual"                 # Copy CF between visuals

# Note: `pbir visuals cf --info`/`--list`/`--has`/`--set-color`/`--remove`/
# `--remove-all` are deprecated and redirect to the `pbir set`/`pbir get`
# forms above. `pbir visuals format-field` and `pbir visuals format-state`
# are also deprecated redirects. Running any of them prints the equivalent
# command and exits non-zero.
```

### Custom Visuals

```bash
# Script injection
pbir visuals deneb "Visual.Visual" --spec-file chart.json
pbir visuals python "Visual.Visual" --script-file script.py
pbir visuals r "Visual.Visual" --script-file script.r

# Query extraction and testing
pbir visuals query "Visual.Visual"               # Extract DAX query
pbir visuals test "Visual.Visual"                # Performance test

# Raw JSON
pbir visuals json "Visual.Visual"                # Raw visual.json
```

## Theme Operations

```bash
# Inspection
pbir cat "Report.Report/theme"                  # Full theme JSON
pbir theme colors "Report.Report"                # Color palette with usage audit
pbir theme text-classes "Report.Report"          # Text style definitions
pbir theme fonts "Report.Report"                 # Font usage
pbir theme validate "Report.Report"              # Validate theme structure
pbir theme diff "R1.Report" "R2.Report"          # Compare themes

# Modification
pbir theme set-colors "Report.Report" --good "#00B050" --bad "#FF0000"
pbir theme set-text-classes "Report.Report" title --font-size 18
pbir theme set-formatting "Report.Report" "card.*.title.fontSize" --value 14
pbir theme push-visual "Visual.Visual"           # Push visual formatting to theme defaults
pbir theme background "Report.Report" --image bg.png
pbir theme icons "Report.Report" --set custom-icon --url "data:image/svg+xml;utf8,..."
pbir theme rename "Report.Report" "NewThemeName"

# Serialize/build workflow (for detailed theme editing)
pbir theme serialize "Report.Report" -o CustomTheme.Theme    # Extract to editable files
# ... edit files in CustomTheme.Theme/ ...
pbir theme build "CustomTheme.Theme"                         # Rebuild from files

# Templates
pbir theme list-templates
pbir theme apply-template "Report.Report" sqlbi
pbir theme create-template "Report.Report" --name my-theme
```

## DAX Operations

```bash
# Extension measures (thin report measures in reportExtensions.json)
pbir dax measures list "Report.Report"
pbir dax measures add "Report.Report" -t _Measures -n "YoY Growth" \
  -e 'DIVIDE([Sales]-[PY Sales],[PY Sales])' --data-type Double
pbir dax measures add "Report.Report" -t _Fmt -n "StatusColor" \
  -e 'IF([Sales]>[Target],"good","bad")' --data-type Text
pbir dax measures rename "Report.Report" "OldName" "NewName"
pbir rm "Report.Report" --measure "MeasureName" -f
pbir dax measures json "Report.Report"

# Visual calculations (inline DAX on visuals)
pbir dax viscalcs list "Report.Report"
pbir dax viscalcs add "R.Report/P.Page/V.Visual" -n "Running Total" \
  -e "RUNNINGSUM([Revenue])"
pbir dax viscalcs rename "R.Report/P.Page/V.Visual" "OldName" "NewName"
pbir rm "R.Report/P.Page/V.Visual" --viscalc "CalcName" -f
pbir dax viscalcs json "R.Report/P.Page/V.Visual"
```

## Field Operations

```bash
pbir fields list "Report.Report"                              # All unique fields with types
pbir fields list "Report.Report/Page.Page"                    # Fields on a page
pbir fields find "Revenue" "Report.Report"                    # Fuzzy search with locations
pbir fields replace "Report.Report" --from "Sales.Revenue" --to "Finance.Revenue"
pbir fields clear "Report.Report/Page.Page" -f                # Clear all bindings on page
pbir fields rename "Report.Report"                            # Rename field display names
pbir fields add "Report.Report/Page.Page/Visual.Visual" Values Sales.Revenue  # Add field
```

## Filter Operations

```bash
# Management
pbir filters list "Report.Report"
pbir filters set "Report.Report/Date.Year.Filter" --values "2024,2025"
pbir filters set "Report.Report/Date.Date.Filter" --type RelativeDate
pbir filters clear "Report.Report/Date.Year.Filter"
pbir filters rename "Report.Report/OldName.Filter" "New Display Name"
pbir filters json "Report.Report"

# Visibility and locking
pbir filters hide "Report.Report/Filter.Filter"
pbir filters lock "Report.Report/Filter.Filter"
pbir filters unlock "Report.Report/Filter.Filter"

# Creation
pbir add filter Date Year -r "Report.Report"
pbir add filter Products Category -p "Report.Report/Page.Page" --values Electronics
pbir add filter Date Date -r "Report.Report" --type RelativeDate

# Filter pane management
pbir filters pane-hide "Report.Report"
pbir filters pane-collapse "Report.Report"
pbir filters pane-get "Report.Report"
pbir filters pane-set "Report.Report" --width 320
pbir filters pane-card "Report.Report" -s Applied --bg-color "#E3F2FD"
```

## Bookmark Operations

```bash
pbir bookmarks list "Report.Report"
pbir bookmarks rename "Report.Report" "OldName" "NewName"
pbir bookmarks data "Report.Report" "BookmarkName"           # Show data state
pbir bookmarks data "Report.Report" "BookmarkName" --off     # Don't capture filters
pbir bookmarks display "Report.Report" "BookmarkName" --off  # Don't capture visibility
pbir bookmarks current-page "Report.Report" "BookmarkName" --off
pbir bookmarks visuals "Report.Report" "BookmarkName" --all
pbir bookmarks json "Report.Report"
```

## Annotation Operations

```bash
pbir annotations list "Report.Report"
pbir cat "Report.Report/annotations"                  # Report + pages + visuals
pbir annotations update "Report.Report" key "value"
pbir annotations rename "Report.Report" old-key new-key
pbir add annotation "Report.Report" --name version --value "1.0"
```

## Connection and Fabric

```bash
# Connection management
pbir connect "Report.Report"                     # Connect to local report
pbir connect MyWorkspace MyReport                # Connect to remote
pbir connect                                     # Show current connection
pbir connect --clear                             # Disconnect
pbir connect --profile dev                       # Activate saved profile

# Profiles
pbir profile list
pbir profile save dev --description "Dev workspace"
pbir profile show dev
pbir profile remove dev

# Cloud operations (requires fab CLI auth)
pbir download "Workspace.Workspace"                              # List reports in workspace
pbir download "Workspace.Workspace/Report.Report" -o ./output    # Download report
pbir download "Workspace.Workspace/Report.Report" -o ./output -F pbip  # Download as PBIP
pbir publish "Report.Report" "Workspace/Report"

# Model queries
pbir model                                       # List all reports and models
pbir model "Report.Report"                       # Show workspace/model info
pbir model "Report.Report" -d                    # Get model definition
pbir model "Report.Report" -d -t Sales           # Filter to table
pbir model "Report.Report" -d -v                 # Full TMDL
pbir model "Report.Report" -q "EVALUATE VALUES('Sales'[Region])"
pbir model "Report.Report" -q "EVALUATE 'Sales'" -F json  # JSON output
```

## Configuration and Setup

```bash
# Config
pbir config show                                 # Current settings
pbir config init                                 # Create config file
pbir config set debug true                       # Set config value

# Setup
pbir setup                                       # Initialize .pbir/ context files
pbir setup --force                               # Overwrite existing files
pbir setup --claude-code                         # Install Claude Code skills
pbir setup report MyReport.Report --claude-hooks # Add agent config files

# Schema management (hidden)
pbir schema status                               # Compare local vs remote versions
pbir schema fetch                                # Download latest schemas
pbir schema check "Report.Report"                # Check file schema versions
pbir schema upgrade "Report.Report"              # Upgrade to latest schemas
pbir schema describe "card"                      # Show properties for visual type
pbir schema containers "card"                    # List containers
pbir schema types                                # List all visual/entity types
```

## Visual Types Reference

### Charts
`areaChart`, `barChart`, `clusteredBarChart`, `clusteredColumnChart`, `columnChart`, `donutChart`, `funnel`, `gauge`, `hundredPercentStackedAreaChart`, `hundredPercentStackedBarChart`, `hundredPercentStackedColumnChart`, `lineChart`, `lineClusteredColumnComboChart`, `lineStackedColumnComboChart`, `pieChart`, `ribbonChart`, `scatterChart`, `stackedAreaChart`, `stackedBarChart`, `stackedColumnChart`, `treemap`, `waterfallChart`, `decompositionTreeVisual`, `keyDriversVisual`

### Cards and KPIs
`card`, `cardVisual`, `kpi`, `multiRowCard`, `scorecard`

### Tables
`tableEx`, `pivotTable` (matrix)

### Slicers
`slicer`, `advancedSlicerVisual`, `listSlicer`, `textSlicer`

### Maps
`map`, `filledMap`, `azureMap`, `shapeMap`

### Containers
`shape`, `actionButton`, `bookmarkNavigator`, `pageNavigator`

### Media
`textbox`, `image`

### Custom
`aiNarratives`, `chicletSlicer`, `hierarchySlicer`, `pythonVisual`, `scriptVisual` (R), `qnaVisual`, `rdlVisual`, `timeline`

### Common Data Roles
- **Charts**: Category, Y (Legend, SmallMultiples)
- **Combo charts**: Category, ColumnY, LineY (Legend)
- **Cards**: Values
- **KPI**: Indicator (TrendLine, Goal)
- **Tables**: Values (Rows, Columns for matrix)
- **Slicers**: Values
- **Scatter**: X, Y (Category, Size, Legend)
- **Maps**: Location (Size, Color/Values)

## Global Flags

```bash
pbir --quiet              # Suppress animations, tips, spinners
pbir --debug              # Enable tracebacks and timing
pbir --version            # Show version
```
