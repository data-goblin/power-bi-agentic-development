---
name: pbir-cli
version: 0.22.3
description: Advanced Power BI report manipulation and execution using pbir CLI and object model; executable scripts for complex workflows, domain-specific references, and reusable templates. Automatically invoke when the user works with .pbir/.pbip report files, or asks to "add a visual", "format a chart", "bind fields", "set a theme", "add conditional formatting", "create a page", "add a thin-report measure", "validate a report", "audit report formatting", "bulk format visuals", "publish to Fabric", "explore a report", or mentions pbir, pbir-cli, report visuals, visual formatting, field bindings, report extensions, or Fabric workspace integration for reports.
---

# Working with Power BI reports using `pbir`

CLI for exploring, building, managing, formatting Power BI reports. All commands use `pbir`.

**IMPORTANT:** ALWAYS use `pbir` CLI commands to read and modify reports if `pbir` is available. ONLY Read, Write, or Update JSON files directly as a fallback if `pbir` fails three times in a row, and you MUST invoke the `pbir-format` skill from the `pbip` plugin when working with these files.

**IMPORTANT:** FIRST Read and adhere to the mental model in [MENTAL-MODEL.md](important/MENTAL-MODEL.md).

## Learning from Mistakes

You MUST log learnings about the `pbir` CLI, including avoiding mistakes or gotchas, unexpected results, user expectations and design preferences in the project's memory file, such as:

- **Claude Code:** `.claude/rules/pbir-cli.md`
- **Cursor:** `.cursor/rules/pbir-cli.mdc`
- **GitHub Copilot:** `.github/instructions/pbir-cli.instructions.md`

You must be concise only log learnings that lead to improved, general performance and NOT very specific examples. This is NOT a change log, and you must treat this learning file as a valuable finite neuronal resource, pruning it, avoiding redundancy and making connections or references to examples.

## How to use `pbir`

### General workflow

1. Explore the report: The report must be in PBIR format and can be pbip, pbir definition only, or PBIX. Prefer either pbir or pbip
2. Identify the model: Reports generally should be "thin reports" connected to a remote model in Power BI or Fabric
3. Ask user for clarification: If the user provided a vague or open-ended instruction, consult **`references/vague-prompts.md`** and use `AskUserQuestion` tool as many times as needed to understand their expectations and the report context
4. Formulate a plan: Plan out what changes are necessary. If you need to create new reports, pages, or visuals, draft a wireframe or mock-up for the user to approve first
5. Make changes: Search for relevant files and examples in `references/` and in related skills like `pbi-report-design`
6. Validate changes: Run `pbir validate`. You can ask the user permission to view the report by publishing it to a sandbox workspace in Power BI or Fabric with `pbir publish` and then using tools like `chrome-mcp` or devtools CLI or playwright to view the report to see if it renders as expected
7. Ask user for feedback: Inform the user that iteration is expected and push back on user expectations for single-prompt or one-shot workflows
8. Record learnings: Document learnings concisely in your rules

### Path syntax

`pbir` uses a filesystem paradigm for identifying reports, pages, visuals etc. and glob syntax for bulk operations.

Format: `ReportName.Report/PageName.Page/VisualName.Visual`

- Type suffixes (`.Report`, `.Page`, `.Visual`) are required
- Quote paths with spaces: `"My Report.Report/Dashboard.Page"`
- Use glob patterns for bulk operations: `"Report.Report/**/*.Visual"` (requires `--force/-f` for `set` and `rm`)
  - `*.Visual` -- all visuals on current page
  - `Page.Page/*.Visual` -- all visuals on a specific page
  - `**/*.Visual` -- all visuals across all pages
  - `**/card*.Visual` -- visuals whose name starts with "card"
  - `**/*.Report/**/*.Visual` -- all visuals across all reports
- Properties via `get` or `set` and dot notation: `"Report.Report/Page.Page/Visual.Visual.title.fontSize"`
- Filters/bookmarks: `"Report.Report/filter:Name"`, `"Report.Report/bookmark:Name"`
- If multiple reports match, disambiguate with parent folder prefix
- Workspace destinations use `.Workspace` suffix: `"My Workspace.Workspace/Report.Report"`


## Critical Rules

You must follow all of the below rules

0. **ASK user for clarifications and push back on one-shot prompt requests.** Pursue an iterative multi-step way-of-working

1. **CHECK references before starting work.** Identify relevant (references)[references/] and (examples)[examples/] that can help you understand the user requirements

2. **NEVER edit report JSON files directly.** Always use `pbir` CLI commands. Use `pbir cat` or `pbir get` to inspect JSON or properties; use `pbir set` for any property not covered by a dedicated command.

3. **Discover before setting.** Run `pbir schema containers <type>` then `pbir schema describe <type>.<container>` to find correct property names, types, ranges, and enums before formatting. Do not guess property names

4. **Theme-first formatting.** Check `pbir visuals format` before applying bespoke formatting -- the theme may already set the property. Prefer `pbir theme set-formatting` for changes that apply to all visuals of a type. Reserve `pbir visuals title/background/border` for one-off overrides

5. **Validate after changes.** Run `pbir validate "Report.Report"` after changes. Use `--qa` for overlap/overflow checks, `--fields` for model field verification, `--all` for everything


## Core Workflows

### Exploration and Analysis

Understand existing reports before modifying. **Always check page dimensions and existing visual positions before adding or resizing visuals** setting position/size without knowing the page dimensions causes errors.

```bash
pbir ls                                          # Find all reports
pbir ls "Report.Report"                          # List pages/filters/theme
pbir tree "Report.Report" -v                     # Full structure with fields
pbir validate "Report.Report"                    # Health check
pbir get "Report.Report"                         # Report properties
pbir pages json "Report.Report/Page.Page"        # Check page width/height
```

For deeper exploration, consult **`references/exploration.md`**.

### Model Discovery (Required Before Binding Fields)

Always query the connected model to discover correct table/column/measure names. Never guess field names.

```bash
pbir model "Report.Report"                       # Connection info (workspace, model, thick/thin)
pbir model "Report.Report" -d                    # All tables, columns, measures
pbir model "Report.Report" -d -t Sales           # Filter to specific table
pbir model "Report.Report" -q "EVALUATE VALUES('Geography'[Region])"  # Check field values
pbir model "Report.Report" -q "EVALUATE ROW(\"Revenue\", [Total Revenue])"  # Test a measure
pbir fields list "Report.Report"                 # Fields already in use across report
```

For full model query patterns and field binding workflows, consult **`references/fields-and-bindings.md`**.

### Creating Reports

New reports include out of the box:
- The **sqlbi** theme (professional colors, typography) -- do NOT run `pbir theme apply-template` unless the user requests a different theme
- A default **Page 1** with a **textbox** visual for the page title at position (20,20) height 90 -- do NOT add a new textbox, rename the existing page instead. **Place all visuals at y:120 or below** to avoid overlapping the title textbox.

```bash
pbir new report "Sales.Report" -c "Workspace/Model.SemanticModel"
pbir pages rename "Sales.Report/Page 1.Page" "Overview"        # Rename default page
pbir add visual card "Sales.Report/Overview.Page" --title "Revenue" -d "Values:Sales.Revenue" --y 120
pbir add filter Date Year -r "Sales.Report"
pbir validate "Sales.Report"
```

For step-by-step creation guidance, use the **`create-pbi-report`** skill.

### Adding and Formatting Visuals

**Formatting hierarchy**: base theme -> custom theme -> visual-type defaults -> individual visual overrides. Always check and prefer theme-level formatting before applying bespoke visual formatting. Use `pbir visuals format` to see the full cascade with source labels (default/wildcard/visualType/visual).

```bash
# Add a visual with data binding
pbir add visual card "Report.Report/Page.Page" --title "Total Sales" -d "Values:Sales.Revenue"

# ALWAYS check theme cascade first -- see what formatting already applies
pbir visuals format "Report.Report/Page.Page/Visual.Visual"

# Set formatting in the THEME (preferred -- applies to all visuals of this type)
pbir theme set-formatting "Report.Report" "card.*.border.radius" --value 8

# Only format bespoke if genuinely one-off
pbir visuals title "Report.Report/Page.Page/Visual.Visual" --text "Revenue" --fontSize 14 --show

# Bind more fields
pbir visuals bind "Report.Report/Page.Page/Visual.Visual" -a "Category:Products.ProductName"

# Validate after changes
pbir validate "Report.Report"
```

For bulk visual creation, see **`references/add-new-visual.md`**.
For formatting workflows, consult **`references/format-visuals.md`** (theme-first approach, property discovery, glob patterns).

### Property Discovery (Required Before Formatting)

Every visual type has dozens of containers with hundreds of properties. Use the schema discovery workflow to find the right container and property name before setting values. Do not guess property names.

```bash
# Step 1: What containers exist for this visual type?
pbir schema containers "lineChart"

# Step 2: What properties does a container have? (includes types, ranges, enums, descriptions)
pbir schema describe "lineChart.lineStyles"

# Step 3: What's currently set on a live visual? (shows source: default/wildcard/visualType/visual)
pbir visuals format "Report.Report/Page.Page/Visual.Visual"
pbir visuals format "Report.Report/Page.Page/Visual.Visual" -v   # Include unset (None) properties
pbir visuals format "Report.Report/Page.Page/Visual.Visual" -p lineStyles  # Filter to container

# Step 4: Fuzzy search for a property by name
pbir visuals properties -s "marker"
```

Schema descriptions include practical usage notes (e.g., error bars as target lines, title.text supporting measure-driven dynamic values). Use `--json` output for full descriptions.

For a complete offline reference of every property for every visual type, consult **`references/property-catalogue.md`** (49 types, 15 universal containers, 12,600+ property slots).

### Bulk Modification (Glob Patterns)

```bash
# Set property on ALL visuals in report (glob requires -f)
pbir set "Report.Report/**/*.Visual.title.show" --value false -f

# Find all card visuals
pbir find "Report.Report/**/card*.Visual"

# Format all visuals on a page
pbir visuals title "Report.Report/Page.Page" --show --fontSize 12
```

### Conditional Bulk Ops (--where)

Use `--where` to filter which visuals a glob operation targets. Available on `set`, `visuals title`, `visuals background`, `visuals border`, `visuals legend`, `visuals labels`, `visuals resize`, `visuals move`, and all other visual property commands.

```bash
# Set title fontSize 16 only on card visuals
pbir set "Report.Report/**/*.Visual.title.fontSize" --value 16 --where "visual_type=card" -f

# Set title fontSize 12 on bar and line charts
pbir set "Report.Report/**/*.Visual.title.fontSize" --value 12 \
  --where "visual_type__in=clusteredBarChart|lineChart" -f

# Show legend only on visuals wider than 400px
pbir visuals legend "Report.Report/**/*.Visual" --show --where "width__gt=400"

# Hide all small visuals
pbir set "Report.Report/**/*.Visual.is_hidden" --value true --where "width__lt=200" -f

# Resize only card visuals
pbir visuals resize "Report.Report/**/*.Visual" --width 350 --height 250 \
  --where "visual_type=card"
```

**Where syntax** (same as OM QuerySet lookups):
```yaml
field=value:              exact match
field__lt=value:          less than
field__gt=value:          greater than
field__lte=value:         less than or equal
field__gte=value:         greater than or equal
field__in=a|b|c:          in list (pipe-separated)
field__contains=text:     string contains
field__icontains=text:    case-insensitive contains
```

Multiple predicates are comma-separated and ANDed: `--where "visual_type=card,width__gt=300"`

### Conditional Formatting

```bash
# Measure-driven CF
pbir visuals cf "Visual" --measure "labels.color _Fmt.StatusColor"

# Gradient CF
pbir visuals cf "Visual" --gradient --field "Table.Field" --min-color bad --max-color good

# Data bars CF
pbir visuals cf "Visual" --data-bars --field "Table.Field"
```

For gradient/rules/icons/data bars options, copy/remove/convert, and best practices, consult **`references/conditional-formatting.md`**.

### Visual Actions, Bookmarks, Drillthrough

```bash
pbir visuals action "Visual" --type PageNavigation --target "Details"  # Set action
pbir add bookmark "Report.Report" "Q1 View"                           # Create bookmark
pbir bookmarks page "Report.Report" "Q1 View" "Details"               # Set bookmark target page
pbir pages drillthrough "Report/Details.Page" --table T --field F     # Add drillthrough
pbir pages set-tooltip "Report/Tooltip.Page"                          # Configure tooltip
```

For bookmark management, consult **`references/bookmarks.md`**.

### Filters

```bash
pbir add filter Table Field -r "Report.Report"                        # Categorical
pbir add filter T F -r "R.Report" --type TopN --n 10 --by-table T2 --by-field F2  # TopN
pbir add filter T F -r "R.Report" --type Advanced --operator GreaterThan --values 1000
pbir add filter Date Date -r "R.Report" --type RelativeDate --period Last30Days
```

To change filter type, remove and recreate. For full filter reference, consult **`references/filters.md`**.

### Auditing Reports

```bash
pbir validate "Report.Report"
pbir tree "Report.Report" -v
pbir theme colors "Report.Report"
pbir fields list "Report.Report"
pbir dax measures list "Report.Report"
pbir filters list "Report.Report"
```

For comprehensive audit checklist, consult **`references/audit-report.md`**.


## Command Reference

For full syntax with all flags, consult **`references/cli-reference.md`**.

### Exploring Reports

Understand a report before modifying it. See **`references/exploration.md`** for systematic workflows.

```yaml
pbir ls [path]:
  use: find reports, list pages/visuals in a report
  flags: --tree, --images

pbir tree "path":
  use: see full structure at a glance
  flags: -v (include field bindings)

pbir cat "path":
  use: inspect raw JSON for a page, visual, theme, or reportExtensions
  note: does NOT support filters or bookmarks -- use `pbir filters list --json` or `pbir bookmarks json` instead

pbir find "glob":
  use: locate visuals by name/pattern across reports
  flags: --type, --json, --count

pbir get "path":
  use: read properties at report/page/visual level

pbir model "path":
  use: check model connection (workspace, model, thick/thin)
  flags: -d (schema), -t Table, -q "DAX", -v, --json

pbir fields list "path":
  use: see which fields are in use and where

pbir validate "path":
  use: health check after any change
  flags: --fields, --qa, --all, --strict, --json, --tree
```

### Creating and Managing Reports

See **`references/create-new-report.md`** for step-by-step creation. See **`references/converting-reports.md`** for format conversion and rebinding.

```yaml
pbir new report "Name.Report":
  use: create a new report from scratch
  flags: -c "Workspace/Model" (connection), --from-template, --thick

pbir report rebind:
  use: switch a report to a different model
  flags: --local, --model-id

pbir report convert:
  use: change format (PBIP/PBIX)
  flags: -F pbix, -F pbip

pbir report merge:
  use: combine two reports
  flags: -o "Output.Report"

pbir report split-pages:
  use: split pages into separate reports
  flags: -o ./dir

pbir report split-from-thick:
  use: extract thin report from thick PBIP
  flags: --target "Workspace/Model"

pbir cp "from" "to":
  use: copy reports, pages, visuals, or themes
  flags: --format

pbir mv "from" "to":
  use: move or rename pages/visuals

pbir visuals rename "path" "new-name":
  use: rename a visual's folder (human-readable alias)
  flags: --sanitize (auto-clean special chars), --force (glob patterns)

pbir rm "path" -f:
  use: remove pages, visuals, filters, bookmarks, measures
  flags: --measures, --theme, --annotations, --fields, --image, --all
```

### Adding and Binding Visuals

See **`references/add-new-visual.md`** for creation workflow and layout patterns. See **`references/fields-and-bindings.md`** for field types (Column vs Measure), bulk binding, field swapping, and rebinding.

**`-t` flag is for `bind` and `add visual` only** -- it sets the field type (Column/Measure). Sort does not need or accept `-t`.

```yaml
pbir add visual TYPE "path":
  use: create a new visual on a page
  flags: --title, -d "Role:Table.Field", -t Measure/Column, --x/y/width/height, --name, --from-json, --list

pbir add title/subtitle "path":
  use: add page title/subtitle textbox

pbir visuals bind "path":
  use: add, remove, or inspect field bindings
  flags: -a "Role:Table.Field", -r "Role:Table.Field", -c Role, -t Measure/Column, --show, --list-roles, --no-validate

pbir visuals sort "path":
  use: set sort order on a visual
  flags: -f "Table.Field", -d Ascending/Descending, --remove
```

### Formatting Visuals

See **`references/format-visuals.md`** for theme-first approach, property discovery, and glob patterns.

```yaml
pbir visuals title/subtitle:
  use: set title/subtitle text, font, color
  flags: --text, --show, --fontSize, --fontColor, --bold, --alignment

pbir visuals background:
  use: set visual background
  flags: --color, --transparency

pbir visuals border:
  use: set border style
  flags: --show, --color, --radius, --width

pbir visuals shadow:
  use: toggle drop shadow
  flags: --show

pbir visuals padding:
  use: set inner padding
  flags: --top/bottom/left/right

pbir visuals header:
  use: visual header icon visibility
  flags: --show

pbir visuals legend:
  use: chart legend
  flags: --show, --position

pbir visuals axis:
  use: category/value axis
  flags: --axis category/value, --show, --title

pbir visuals labels:
  use: data labels
  flags: --show, --fontSize

pbir visuals position/resize:
  use: move or resize a visual
  flags: --x/y/width/height

pbir visuals align:
  use: align/distribute multiple visuals
  args: left/right/top/bottom/distribute-horizontal/distribute-vertical

pbir visuals z-order:
  use: layer stacking order

pbir visuals clear-formatting:
  use: reset to theme defaults
  flags: --keep-cf, --only-containers, --dry-run, -f (globs)

pbir set "path.prop" --value X:
  use: set any property by dot notation
  flags: -f (required for globs), --json
```

### Property Discovery

Use before formatting -- find the right container and property name. See **`references/property-catalogue.md`** for the full offline index.

```yaml
pbir schema containers "type":
  use: list all containers for a visual type

pbir schema describe "type.container":
  use: show properties with types, ranges, enums
  flags: --json

pbir visuals format "path":
  use: see merged theme + visual values with source labels
  flags: -v (include unset), -p container (filter)

pbir visuals properties "path":
  use: tree view of all properties on a live visual
  flags: -s "search" (fuzzy)
```

### Conditional Formatting

See **`references/conditional-formatting.md`** for CF types, measure-based CF, and best practices.

```yaml
pbir visuals cf "path":
  use: list all CF rules on a visual

pbir visuals cf "path" --measure:
  use: apply measure-based CF
  args: "component.property Table.Measure"

pbir visuals cf "path" --info:
  use: inspect a CF rule
  args: component.property

pbir visuals cf "path" --remove:
  use: remove a CF rule
  args: component or component.property

pbir visuals cf "path" --set-color:
  use: update gradient colors
  args: "component.property min=bad max=good"

pbir visuals cf "path" --theme-colors:
  use: convert hex to theme tokens
  args: component.property

pbir visuals cf "path" --to-measure:
  use: convert gradient to extension measure
  args: component.property

pbir visuals format-field:
  use: per-field formatting (positional args)
  args: VISUAL COMPONENT PROPERTY -f "Table.Field" -v value

pbir visuals format-state:
  use: interaction state formatting
  args: VISUAL COMPONENT PROPERTY -s hover/selected -v value
```

### Theme Operations

See **`references/modifying-theme.md`** for inspection/modification and **`references/apply-theme.md`** for templates.

```yaml
pbir theme colors "path":
  use: view color palette with usage audit

pbir theme text-classes "path":
  use: view text style definitions

pbir theme fonts "path":
  use: view font usage

pbir theme set-colors:
  use: change semantic colors (good/bad/neutral)
  flags: --good, --bad, --neutral

pbir theme set-text-classes:
  use: change text class properties
  flags: --font-size, font options

pbir theme set-formatting:
  use: set formatting at theme level
  args: "type.*.container.property" --value X

pbir theme push-visual:
  use: copy visual formatting into theme defaults

pbir theme serialize/build:
  use: extract theme to editable files / rebuild
  flags: -o OutputDir.Theme

pbir theme diff:
  use: compare two report themes

pbir theme apply-template/create-template/list-templates:
  use: template library
```

### DAX Operations

See **`references/thin-report-measures.md`** for extension measure patterns and **`references/visual-calculations.md`** for visual calculations.

```yaml
pbir dax measures list:
  use: list all extension measures

pbir dax measures add:
  use: add a thin-report measure
  flags: -t Table, -n Name, -e "DAX", --data-type, --no-validate

pbir dax measures update/rename:
  use: modify existing measures

pbir dax viscalcs list/add/update/rename:
  use: visual calculations (RUNNINGSUM, RANK, etc.)
  flags: -n Name, -e "DAX"
```

### Filter and Bookmark Operations

See **`references/filters.md`** for filter workflows and **`references/bookmarks.md`** for bookmark management.

```yaml
pbir add filter TABLE COLUMN:
  use: create a new filter
  flags: -r "Report.Report" (report-level), -p "Page.Page" (page-level), --values, --type

pbir filters list/set/clear:
  use: manage filter values
  flags: --values, --type RelativeDate

pbir filters hide/lock/unlock/rename:
  use: filter visibility and locking

pbir filters pane-hide/pane-collapse/pane-get/pane-set/pane-card:
  use: filter pane appearance
  flags: --width, --bg-color

pbir bookmarks list/rename/data/display/visuals/page/json:
  use: bookmark management
  flags: --off (disable capture)

pbir bookmarks page "path" "bookmark" "page":
  use: set which page a bookmark navigates to
  args: report path, bookmark name, page name (omit page to show current)
```

### Page Operations

```yaml
pbir add page "path":
  use: add a new page
  flags: -n "Name", --width/height, --from-template, --list-templates

pbir pages rename "path" "new name":
  use: rename a page (updates display name and folder)
  flags: --force (skip confirmation)

pbir pages resize:
  use: change page dimensions
  flags: --width/height

pbir pages type:
  use: set page aspect ratio
  flags: --type 16:9/4:3/letter/tooltip/custom

pbir pages display:
  use: set display mode
  flags: -o FitToPage/FitToWidth/ActualSize

pbir pages hide:
  use: hide/show in view mode
  flags: --show (to unhide)

pbir pages background/wallpaper:
  use: page styling
  flags: --color, --image

pbir pages move:
  use: reorder pages
  flags: --to N

pbir pages active-page:
  use: set default landing page
```


## Global Flags

Top-level flags -- place before the subcommand: `pbir -q new report ...`, NOT `pbir new report -q ...`

```yaml
-q / --quiet: suppress animations, tips, spinners (agent-friendly)
--debug: enable tracebacks and timing
--json: machine-readable output (on find, model, validate, etc.)
-f / --force: skip confirmation prompts (required for glob patterns in set and rm)
```


## Common Mistakes

- **`pbir cat` does not support filters or bookmarks.** Use `pbir filters list --json` or `pbir bookmarks json` instead.
- **`pbir publish` uses positional args**, not `--workspace`. Correct: `pbir publish "Report.Report" "Workspace.Workspace/Report.Report" -f`
- **`pbir filters list` has no `-v` flag.** Use `--json` for detailed output.
- **Do not convert to PBIX then publish the PBIR folder.** If converting to PBIX, publish the `.pbix` file directly. If publishing PBIR, skip conversion entirely.
- **`pbir pages rename` renames folders only** -- it does not change page IDs or display names. Use `--to` for single page folder rename.
- **Always run `pbir <command> --help`** before using an unfamiliar command to confirm exact syntax.


## User Interaction

Use `AskUserQuestion` to interview the user before executing. This is important for:

- **Visual design**: What story should the visual tell? What comparisons matter?
- **Formatting intent**: One-off bespoke or theme-level change for all visuals of this type?
- **Complex requirements**: Deneb vs core visual, CF logic, page layout -- discuss trade-offs first
- **Ambiguous field mapping**: When the model has multiple plausible fields, discuss intent
- **Clearing formatting**: ALWAYS confirm before `pbir visuals clear-formatting` -- it is irreversible


## Validation

Run `pbir validate "Report.Report"` after **every mutation**. This catches broken field references, invalid JSON, schema violations, and structural issues early.

```yaml
(no flags): structure + schema validation
--fields: also validate fields exist in model with correct types (Column/Measure)
--qa: also run quality assurance rules
--all: structure + schema + fields + QA
--strict: promote field/QA warnings to errors
--json / --tree: output format
--allow-download-schemas: download missing schemas on the fly
```

**Schema version errors**: Fix with `pbir schema fetch --yes` then `pbir schema upgrade "Report.Report"`.


## Reference Files

```yaml
references/cli-reference.md: full syntax for any command with all flags
references/exploration.md: exploring an unfamiliar report systematically
references/create-new-report.md: building a report from scratch
references/add-new-visual.md: adding visuals, layout patterns, bulk creation
references/fields-and-bindings.md: field binding, Column vs Measure types, swapping fields, rebinding
references/format-visuals.md: formatting workflow, property discovery, glob patterns
references/conditional-formatting.md: CF types, measure-based CF, copy/remove/update/convert
references/modifying-theme.md: theme inspection, colors, text classes, fonts
references/apply-theme.md: applying/copying/saving theme templates
references/converting-reports.md: format conversion, thick/thin split, merge, rebind
references/thin-report-measures.md: extension measures for CF, conditional rendering
references/visual-calculations.md: visual calculations (RUNNINGSUM, RANK, etc.)
references/filters.md: filter types (Categorical, TopN, Advanced, RelativeDate), management, pane styling
references/bookmarks.md: bookmark management, copying, button references
references/audit-report.md: report quality audit checklist
references/vague-prompts.md: handling underspecified prompts; targeted questions, sensible defaults
references/property-catalogue.md: offline property index (49 types, 15 containers, 12,600+ slots)
references/visualTypes/*.md: per-visual-type design rules, CLI commands, and best practices
examples/visuals/default/*.json: minimal visual.json files with no bespoke formatting (theme defaults only)
examples/visuals/formatted/*.json: visual.json files with bespoke formatting, CF, filters, or advanced patterns
```


## Related Skills

- `pbi-report-design`: Use for design best practices and guidelines for reports
- `pbir-format`: Use when falling back to editing report JSON files directly
- `pbip-format`: Use for working with pbip structure
- `create-pbi-report`: Use to follow step-by-step instructions for creating new reports