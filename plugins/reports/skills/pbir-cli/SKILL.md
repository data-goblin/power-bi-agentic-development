---
name: pbir-cli
version: 26.24.7
description: This skill should be used whenever the user mentions "pbir", "pbir-cli", "Power BI reports", or "PBI reports", works with .pbir, .pbip, or .pbix files, or wants to refresh, screenshot, or visually verify a report that is open in Power BI Desktop. Covers creating, exploring, formatting, validating, and publishing Power BI reports through the pbir CLI and object model, plus driving Power BI Desktop (canvas reload, page screenshots) and querying connected or local semantic models.
---

# Working with Power BI reports using `pbir`

CLI for exploring, building, managing, formatting Power BI reports. All commands use `pbir`.

**IMPORTANT:** ALWAYS use `pbir` CLI commands to read and modify reports if `pbir` is available. ONLY Read, Write, or Update JSON files directly as a fallback if `pbir` fails three times in a row, and you MUST invoke the `pbir-format` skill from the `pbip` plugin when working with these files.

**IMPORTANT:** FIRST Read and adhere to the mental model in [MENTAL-MODEL.md](important/MENTAL-MODEL.md).

## Version and availability

Check the installed CLI version with `pbir --version` and compare it against the latest `pbir-cli` release on PyPI (https://pypi.org/project/pbir-cli/). When the installed version is behind, suggest the user upgrade with `pip install --upgrade pbir-cli` so the CLI matches the commands this skill documents.

**If a command or flag documented in this skill does not exist in the installed CLI, the skill is likely ahead of the installed `pbir-cli` release.** This is especially common for the `pbir desktop` commands, which evolve quickly. Before treating a missing command as a CLI failure (and before falling back to editing JSON directly), confirm with `pbir <command> --help` and `pbir --version`, then upgrade to the latest `pbir-cli` from PyPI. Do not work around a missing newer command by hand-editing report JSON when an upgrade would provide it.

When publishing to Fabric (`pbir publish`) alongside the `fabric-cli` plugin, also keep the Fabric CLI (`fab`) current — upgrade with `uv tool upgrade ms-fabric-cli` unless the user has pinned a specific version.

## Learning from Mistakes

Log learnings about the `pbir` CLI in the project's memory file: gotchas, unexpected behavior, user expectations, and design preferences. Use the agent-appropriate path:

- **Claude Code:** `.claude/rules/pbir-cli.md`
- **Cursor:** `.cursor/rules/pbir-cli.mdc`
- **GitHub Copilot:** `.github/instructions/pbir-cli.instructions.md`

Keep entries concise and generalizable. The memory file is not a change log. Prune redundancy, link out to references and examples rather than restating them.

## How to use `pbir`

### General workflow

1. Explore the report. The report must be in PBIR format: pbip, pbir-only, or pbix-with-PBIR-metadata. Prefer pbir or pbip. Whenever the user mentions Power BI Desktop or says the report is open in Desktop, run `pbir desktop list` FIRST: it maps each running instance to the file it has open (locating the report on disk) and confirms the bridge works before any edits begin. `pbir desktop` is Windows-only; on macOS and Linux do not use it (every invocation fails). Instead deploy with `pbir publish` to a sandbox workspace in Fabric and verify the rendered report in the browser via the Chrome MCP tools.
2. Identify the model. Reports generally should be thin reports connected to a remote model in Power BI or Fabric.
3. Clarify intent. For vague or open-ended instructions, consult **`references/vague-prompts.md`** and use `AskUserQuestion` to understand expectations and report context before mutating anything.
4. Plan changes. For new reports, pages, or visuals, draft a wireframe or mock-up for the user to approve before building.
5. Make changes. Reach for relevant files in `references/`, `examples/`, and related skills like `pbi-report-design`.
6. Validate. Run `pbir validate` after every mutation. For visual confirmation, prefer the local loop when the report is open in Power BI Desktop: `pbir desktop refresh` then `pbir desktop screenshot` and inspect the PNG (see "Desktop Integration" below). Otherwise ask permission to publish to a sandbox workspace with `pbir publish` and inspect rendering via Chrome MCP, devtools CLI, or Playwright.
7. Iterate. Expect multiple rounds. Push back on one-shot expectations from vague prompts.
8. Record learnings. Add concise, generalizable entries to the memory file noted above.

### Path syntax

`pbir` uses a filesystem paradigm for identifying reports, pages, visuals etc. and glob syntax for bulk operations.

Format: `ReportName.Report/PageName.Page/VisualName.Visual`

- Type suffixes (`.Report`, `.Page`, `.Visual`) are required
- Quote paths with spaces: `"My Report.Report/Dashboard.Page"`
- Use glob patterns for bulk operations: `"Report.Report/**/*.Visual"` (requires `--force/-f` for `set` and `rm`)
  - `*.Visual`; all visuals on current page
  - `Page.Page/*.Visual`; all visuals on a specific page
  - `**/*.Visual`; all visuals across all pages
  - `**/card*.Visual`; visuals whose name starts with "card"
  - `**/*.Report/**/*.Visual`; all visuals across all reports
- Properties via `get` or `set` and dot notation: `"Report.Report/Page.Page/Visual.Visual.title.fontSize"`
- Filters/bookmarks: `"Report.Report/filter:Name"`, `"Report.Report/bookmark:Name"`
- If multiple reports match, disambiguate with parent folder prefix
- Absolute filesystem paths work too: `"C:\Reports\Sales.Report"`, `"C:\Reports\Flash.pbix"` (globs do not combine with absolute paths)
- Workspace destinations use `.Workspace` suffix: `"My Workspace.Workspace/Report.Report"`


## Critical Rules

Follow all rules below.

0. **ASK user for clarifications and push back on one-shot prompt requests.** Pursue an iterative multi-step way-of-working

1. **CHECK references before starting work.** Identify relevant (references)[references/] and (examples)[examples/] that can help you understand the user requirements

2. **NEVER edit report JSON files directly.** Always use `pbir` CLI commands. Use `pbir cat` or `pbir get` to inspect JSON or properties; use `pbir set` for any property not covered by a dedicated command.

3. **Discover before setting.** Run `pbir schema containers <type>` then `pbir schema describe <type>.<container>` to find correct property names, types, ranges, and enums before formatting. Do not guess property names

4. **Theme-first formatting.** Check `pbir visuals format` before applying bespoke formatting; the theme may already set the property. Prefer `pbir theme set-formatting` for changes that apply to all visuals of a type. Reserve `pbir visuals title/background/border` for one-off overrides

5. **Validate after changes.** Run `pbir validate "Report.Report"` after changes. Use `--qa` for overlap/overflow checks, `--fields` for model field verification, `--all` for everything

6. **Verify rendering through the Desktop bridge.** When the report is open in Power BI Desktop, run `pbir desktop refresh` after every change unless the user asks not to, then `pbir desktop screenshot` and inspect the PNG after every meaningful change. Validation cannot catch rendering problems (overlap, truncation, wrong field, illegible formatting); the screenshot is the only proof a change rendered as intended. When a request involves many changes, ask the user up front whether to refresh after each step (so they watch progress in the canvas) or once at the end. Check availability once with `pbir desktop list` before starting the loop; if the bridge is unavailable, do not retry it after every change (see "When the bridge is unavailable" below)


## Core Workflows

### Exploration and Analysis

Understand existing reports before modifying. **Always check page dimensions and existing visual positions before adding or resizing visuals** setting position/size without knowing the page dimensions causes errors.

```bash
pbir desktop list                                # FIRST if Desktop is mentioned: instances (PID, open file)
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

Routing depends on the report's model reference: thin reports (`byConnection`) query the Power BI / Fabric service; thick reports (`byPath`) query the local Analysis Services engine of the Power BI Desktop instance that has the report open, so `-q` and `-d` work fully offline against live model state. Local queries need the .NET Framework ADOMD client (found automatically from DAX Studio or Desktop installs; override with `PBIR_ADOMD_DIR`).

For full model query patterns and field binding workflows, consult **`references/fields-and-bindings.md`**.

### Desktop Integration (Refresh and Screenshot)

When the report is open in Power BI Desktop (Windows, with the "external tool access" preview feature enabled), drive the running instance directly. This is the fastest way to visually verify changes; no publishing required.

```bash
pbir desktop list                                     # Running instances (PID, open file)
pbir desktop refresh "Report.Report"                  # Reload on-disk definition into the canvas
pbir desktop screenshot "Report.Report/Page.Page" -o verify.png
```

The edit-verify loop: mutate with `pbir set`/`add`, then `pbir desktop refresh`, then `pbir desktop screenshot`, then read the PNG. Inspect the rendered page after every meaningful change; screenshots catch what validation cannot (overlap, truncation, wrong field, illegible formatting). Set `PBIR_DESKTOP_AUTO_REFRESH=1` to fold the refresh step into every save.

Screenshots need the Desktop window in the Report view. Refreshing an instance with unsaved changes makes Desktop save first, rewriting the whole definition on disk. PBIX files support screenshot but not refresh. For requirements, multi-instance behavior, and troubleshooting, consult **`references/desktop-integration.md`**.

**When the bridge is unavailable.** `pbir desktop` commands are Windows-only: on macOS and Linux do not use them at all; every invocation fails before reaching Desktop. On Windows, `pbir desktop list` distinguishes the cases: the bridge is unreachable when the preview feature is off ("Enable external tool access to Power BI Desktop through secure local APIs" under File > Options and settings > Options > Preview features, then restart Desktop), and it reports when no running instance has the target report open. If the preview feature is off, relay the enable steps to the user once and ask whether they want to turn it on; do not keep retrying bridge commands meanwhile. Until the bridge works, and always on macOS and Linux, verify with `pbir validate --all`, then with the user's permission deploy with `pbir publish` to a sandbox workspace in Fabric and inspect the rendered report in the browser through the Chrome MCP tools.

### Creating Reports

New reports include out of the box:
- The **sqlbi** theme (professional colors, typography). Do not run `pbir theme apply-template` unless the user requests a different theme
- A default **Page 1** with a **textbox** visual for the page title at position (20,20) height 90. Do not add a new textbox; rename the existing page instead. Place subsequent visuals at `y:120` or below to avoid overlapping the title textbox. Use `--no-title` on `pbir new report` to skip the default title textbox when the user wants a clean canvas

Connection: pass `--connection "Workspace/Model.SemanticModel"`, or set an active connection first with `pbir connect` (optionally `pbir profile` / `pbir connect --profile <name>` to switch between saved connections). When an active connection is set, the connection flag can be omitted.

```bash
pbir new report "Sales.Report" -c "Workspace/Model.SemanticModel"
pbir pages rename "Sales.Report/Page 1.Page" "Overview"        # Rename default page
pbir add visual card "Sales.Report/Overview.Page" --title "Revenue" -d "Values:Sales.Revenue" --y 120
pbir add filter Date Year -r "Sales.Report"
pbir validate "Sales.Report"
```

Data-role names in `-d "Role:Table.Field"` (e.g. `Values`, `Category`, `Y`, `Series`, `Indicator`) come from the visual type's capability schema. Run `pbir add visual --list` or `pbir visuals bind --list-roles` to discover the roles for unfamiliar visual types. The CLI matches role names case-insensitively, so `Values:` and `values:` both work.

For step-by-step creation guidance, use the **`create-pbi-report`** skill.

### Adding and Formatting Visuals

**Formatting hierarchy**: base theme -> custom theme -> visual-type defaults -> individual visual overrides. Always check and prefer theme-level formatting before applying bespoke visual formatting. Use `pbir visuals format` to see the full cascade with source labels (default/wildcard/visualType/visual).

```bash
# Add a visual with data binding (role names match the visual capability list)
pbir add visual card "Report.Report/Page.Page" --title "Total Sales" -d "Values:Sales.Revenue"

# ALWAYS check theme cascade first; see what formatting already applies
pbir visuals format "Report.Report/Page.Page/Visual.Visual"

# Set formatting in the THEME (preferred; applies to all visuals of this type)
pbir theme set-formatting "Report.Report" "card.*.border.radius" --value 8

# Only format bespoke if genuinely one-off
pbir visuals title "Report.Report/Page.Page/Visual.Visual" --text "Revenue" --fontSize 14 --show

# Bind more fields
pbir visuals bind "Report.Report/Page.Page/Visual.Visual" -a "Category:Products.ProductName"

# Validate after changes
pbir validate "Report.Report"

# If the report is open in Desktop, confirm the rendering
pbir desktop refresh "Report.Report"
pbir desktop screenshot "Report.Report/Page.Page" -o verify.png   # then Read verify.png
```

For bulk visual creation, see **`references/add-new-visual.md`**.
For formatting workflows, consult **`references/format-visuals.md`** (theme-first approach, property discovery, glob patterns).

### Visual Groups

Visual groups bind multiple visuals so they move and scale together. Use them when a set of visuals should behave as a single unit (a header strip, a KPI row, a chart-plus-annotation pair).

```bash
pbir visuals group "Report.Report/Page.Page" --list                       # List groups on page
pbir visuals group "Report.Report/Page.Page" --create "KPI Group"         # Create empty group
pbir visuals group "Report.Report/Page.Page/Group.Visual" --add "Card.Visual" --add "KPI.Visual"
pbir visuals group "Report.Report/Page.Page/Group.Visual" --remove "Card.Visual"
pbir visuals group "Report.Report/Page.Page/Visual.Visual" --ungroup      # Remove this visual from its group
pbir visuals group "Report.Report/Page.Page/Group.Visual" --ungroup       # Ungroup all members and delete the group
```

Default mode is `ScaleMode`; override with `--mode` if a different behavior is needed.

### Style Presets

Style presets apply a curated bundle of formatting in one step. Use a preset when the user wants a consistent look across many visuals without specifying every property.

```bash
pbir visuals preset --list                                        # Available presets
pbir visuals preset "Report.Report/Page.Page/Visual.Visual" --name minimal
pbir visuals preset "Report.Report/**/*.Visual" --name presentation
```

Presets are themed; pair them with `pbir theme apply-template` for full visual consistency.

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

`--where` filters which visuals a glob operation targets. Available on `set` and all `visuals` property commands.

```bash
pbir set "Report.Report/**/*.Visual.title.fontSize" --value 16 --where "visual_type=card" -f
pbir visuals legend "Report.Report/**/*.Visual" --show --where "width__gt=400"
pbir visuals resize "Report.Report/**/*.Visual" --width 350 --height 250 --where "visual_type=card"
```

Predicate operators: `=`, `__lt`, `__gt`, `__lte`, `__gte`, `__in=a|b|c`, `__contains`, `__icontains`. Combine with commas (ANDed): `--where "visual_type=card,width__gt=300"`. Full operator list in **`references/format-visuals.md`**.

### Conditional Formatting

```bash
# Create CF (structural; use pbir visuals cf)
pbir visuals cf "Visual" --measure "labels.color _Fmt.StatusColor"
pbir visuals cf "Visual" --gradient --field "Table.Field" --min-color bad --max-color good
pbir visuals cf "Visual" --data-bars --field "Table.Field"

# Read / edit / remove CF (dot-path; use pbir set / pbir get)
pbir get "Visual.dataPoint.fill.cf"                             # summary
pbir set "Visual.dataPoint.fill.cf.gradient.min.color" --value "bad"
pbir set "Visual.dataPoint.fill.cf" --remove                    # or --clear
pbir get "Report.Report/**/*.Visual.**.cf"                       # bulk read
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

Filter creation validates the field against the connected semantic model. If validation cannot resolve (missing connection, model unreachable), the command fails closed rather than producing an unverified filter. Use `--no-validate` only when the user explicitly needs to bypass this.

To change filter type, remove and recreate. For full filter reference, consult **`references/filters.md`**.

### Auditing Reports

```bash
pbir validate "Report.Report"                       # Structure, schema, fields, QA (use --all)
pbir bpa run "Report.Report"                        # Best Practice Analyzer rule sweep
pbir bpa run "Report.Report" --fix --save           # Apply safe automatic fixes
pbir tree "Report.Report" -v                        # Structure + field bindings
pbir theme colors "Report.Report"                   # Palette and usage
pbir fields list "Report.Report"                    # Fields in use
pbir dax measures list "Report.Report"              # Extension measures
pbir filters list "Report.Report"                   # Filters at every scope
```

BPA rules are managed with `pbir bpa rules list/ignore/unignore`; ignored rules are scoped per report. For the comprehensive audit checklist, consult **`references/audit-report.md`**.


## Command Reference

The full command reference lives in **`references/cli-reference.md`**. Always run `pbir <command> --help` before using an unfamiliar command; the help text is authoritative for flag names and defaults.

Quick map of command groups:

```yaml
Getting started:     setup, config, connect (+ --profile), profile, new
Browse and query:    ls, tree, find, get, cat, model
Modify:              set, add, mv, cp, rm, visuals, pages
Data:                fields, filters, dax, bookmarks, annotations
Theme:               theme (colors, text-classes, fonts, set-formatting, apply-template, diff)
Schema discovery:    schema (types, containers, describe), visuals properties, visuals format
Workflow ops:        validate, backup, restore, publish, download, batch, open, bpa
Desktop (Windows):   desktop (list, refresh, screenshot)
```

Notes on the less-obvious groups:

- **connect / profile**: `pbir connect "Report.Report"` sets the active context so subsequent commands can omit the report path. `pbir profile` saves and switches named connections (`pbir connect --profile dev`).
- **visuals group**: visual groups let users scale and position multiple visuals together. See "Visual groups" workflow below.
- **visuals preset**: named style presets (`minimal`, `bold`, `clean`, `emphasis`, `presentation`) apply curated formatting in one step.
- **bpa**: Best Practice Analyzer. `pbir bpa run "Report.Report"` reports rule violations; `--fix --save` applies safe fixes. `pbir bpa rules list/ignore/unignore` manages the rule set.

## Global Flags

Top-level flags; place before the subcommand: `pbir -q new report ...`, NOT `pbir new report -q ...`

```yaml
-q / --quiet: suppress animations, tips, spinners (agent-friendly)
--debug: enable tracebacks and timing
--json: machine-readable output (on find, model, validate, etc.)
-f / --force: skip confirmation prompts (required for glob patterns in set and rm)
```


## Common Mistakes

- **Role names are case-insensitive but should match the capability list.** Use `pbir add visual --list` or `pbir visuals bind --list-roles` to discover role identifiers (e.g. `Values`, `Category`, `Y`, `Series`) for the target visual type.
- **`pbir cat` does not support filters or bookmarks.** Use `pbir filters list --json` or `pbir bookmarks json` instead.
- **`pbir publish` uses positional args**, not `--workspace`. Correct: `pbir publish "Report.Report" "Workspace.Workspace/Report.Report" -f`.
- **`pbir filters list` has no `-v` flag.** Use `--json` for detailed output.
- **Do not convert to PBIX then publish the PBIR folder.** If converting to PBIX, publish the `.pbix` file directly. If publishing PBIR, skip conversion entirely.
- **`pbir pages rename` renames folders only**; it does not change page IDs or display names. Use `--to` for single page folder rename.
- **DMV queries fail against service-connected models.** For thin reports (`byConnection`), `pbir model -q` runs EVALUATE DAX only; `INFO.TABLES()` and other DMVs return 400 from the service, and schema comes from TMDL. Use `pbir model -d` for schema introspection. Thick reports (`byPath`) open in Desktop query the local engine instead, where the live schema is used.
- **`pbir desktop refresh` does not work on PBIX files.** Desktop only reloads PBIP/PBIR definitions from disk; PBIX instances support `pbir desktop screenshot` only.
- **Always run `pbir <command> --help`** before using an unfamiliar command to confirm exact syntax.


## User Interaction

Use `AskUserQuestion` to interview the user before executing. This is important for:

- **Visual design**: What story should the visual tell? What comparisons matter?
- **Formatting intent**: One-off bespoke or theme-level change for all visuals of this type?
- **Complex requirements**: Deneb vs core visual, CF logic, page layout; discuss trade-offs first
- **Ambiguous field mapping**: When the model has multiple plausible fields, discuss intent
- **Refresh cadence**: For multi-change requests with Desktop open, ask whether to `pbir desktop refresh` after each step (visible progress) or once at the end
- **Clearing formatting**: ALWAYS confirm before `pbir visuals clear-formatting`; it is irreversible


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

`pbir validate` checks structure, not rendering. When the report is open in Power BI Desktop, follow every validation with the bridge loop: `pbir desktop refresh`, `pbir desktop screenshot`, then read the PNG. Do not report a change as complete without having seen it render.


## Reference Files

```yaml
references/cli-reference.md: full syntax for any command with all flags
references/exploration.md: exploring an unfamiliar report systematically
references/desktop-integration.md: driving Power BI Desktop; canvas refresh, page screenshots, auto-refresh, local model queries, troubleshooting
references/create-new-report.md: building a report from scratch
references/add-new-visual.md: adding visuals, layout patterns, bulk creation
references/visual-groups.md: visual groups (create, add/remove members, ungroup)
references/visual-presets.md: style presets (minimal, bold, clean, emphasis, presentation)
references/fields-and-bindings.md: field binding, Column vs Measure types, swapping fields, rebinding
references/format-visuals.md: formatting workflow, property discovery, glob patterns, --where predicates
references/conditional-formatting.md: CF types, measure-based CF, copy/remove/update/convert
references/reference-lines.md: reference-line entries on chart axes; pbir visuals reference-line and styling via pbir set
references/error-bars.md: error bars and bullet markers on chart visuals; pbir visuals error-bars and styling via pbir set
references/modifying-theme.md: theme inspection, colors, text classes, fonts
references/apply-theme.md: applying/copying/saving theme templates
references/converting-reports.md: format conversion, thick/thin split, merge, rebind
references/thin-report-measures.md: extension measures for CF, conditional rendering
references/visual-calculations.md: visual calculations (RUNNINGSUM, RANK, etc.)
references/filters.md: filter types (Categorical, TopN, Advanced, RelativeDate), management, pane styling
references/bookmarks.md: bookmark management, copying, button references
references/audit-report.md: report quality audit checklist
references/bpa.md: Best Practice Analyzer; running rules, applying safe fixes, managing the rule set
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