---
name: pbir-cli
description: Use when running or writing `pbir` commands, or when reading, editing, formatting, validating, publishing or screenshotting a local PBIR Power BI report (.Report folder, .pbip, or .pbix with PBIR metadata), including a report open in Power BI Desktop. Covers path syntax, field binding, theme-first formatting, conditional formatting, filters, bookmarks, extension measures, BPA, usage metrics and the Windows-only Desktop bridge. Not for semantic models (use tabular-editor or semantic-models) or paginated reports.
---

# Working with Power BI reports through `pbir`

`pbir` is the CLI for local PBIR reports. Install it with `uv tool install pbir-cli`. `pbir <command> --help` is the authority on flags; this skill holds only the rules and gotchas that help text does not carry.

## Rules

1. **Never write, copy or patch report JSON.** Use `pbir` for every mutation; it validates its own writes. If no command exposes the change, stop and report the missing capability. Reading JSON with `pbir cat` or `pbir get` is fine.
2. **Discover before setting.** `pbir schema describe <type> [object]` lists objects, property names, types and enums; `pbir schema roles <type>` lists data roles (names differ per type: `Y` on a gauge, `Group` on a treemap, `Data` on `cardVisual`, `Values` on the legacy `card`). Do not guess property or role names.
3. **Theme first.** `pbir visuals format <visual>` shows the effective cascade with a source label per value (default, wildcard, visualType, visual). Change what applies to every visual of a type with `pbir theme set-formatting`; use `pbir visuals title|background|border` only for one-off overrides. Details: [theme cascade](../../wiki/report-theme-cascade.md).
4. **Look at page size and positions before placing or resizing.** `pbir get "Report.Report/Page.Page.width"`. A new page is 1280x720. A new report's Page 1 already holds a title textbox (y 20, height 90): rename the page, do not add a second textbox, and start content at y 120 (or create with `--no-title`). `pbir add page` adds its own 120 px title textbox, so start at y 140 there.
5. **Validate after each coherent batch, not each command.** `pbir validate "Report.Report" --all` (schema, fields, QA, semantic catalog); `pbir bpa run "Report.Report" --fail-on error` for governance and layout rules. `--fields` needs the model reachable.
6. **Rendering is the only proof a change worked.** Validation cannot see overlap, truncation or a wrong field. Loop and caveats: [render verification](../../wiki/pbir-render-verification.md).
7. **Ask before anything that leaves the machine** (`pbir publish`, `pbir usage --model`) and before destructive commands (`pbir visuals clear-formatting`, `pbir rm` with a glob).

## Desktop bridge (Windows only)

When the user says the report is open in Power BI Desktop, run `pbir desktop list` first: it maps each running instance to its file and confirms the bridge works. After a batch: `pbir desktop refresh "Report.Report"` then `pbir desktop screenshot "Report.Report/Page.Page" -o verify.png` and read the PNG.

On macOS and Linux every `pbir desktop` command fails. Instead, ask permission, publish to a sandbox workspace and inspect the render in a browser. Do not retry the bridge after every change. Setup, `.pbix` limits and troubleshooting: [Desktop bridge](../../wiki/pbir-desktop-bridge.md).

## Path syntax

`Report.Report/Page.Page/Visual.Visual`; the type suffixes are required. Quote paths with spaces. Properties use dot notation after the path: `"R.Report/P.Page/V.Visual.title.fontSize"`. Filters and bookmarks: `"R.Report/filter:Name"`, `"R.Report/bookmark:Name"`. Workspace destinations end in `.Workspace`. Globs (`**/*.Visual`, `**/card*.Visual`) never combine with absolute filesystem paths, and `set` or `rm` on a glob needs `-f` (add `--dry-run` first). `--where "visual_type=card,width__gt=300"` narrows a glob.

## Gotchas

- **Global flags go before the subcommand**: `pbir -q --skip fields set ...`. `--skip` takes `structure, schema, schema-version, fields, enums, qa` (comma-separated or repeated); `--rawdog` skips all. Prefer fixing the cause.
- **`pbir pages rename` is a dry run** until `-f`; it renames folder and displayName (`--to` for a single page).
- **`pbir cat` does not read filters or bookmarks**: use `pbir filters json` or `pbir bookmarks json`.
- **`pbir publish` takes positional arguments**: `pbir publish "R.Report" "WS.Workspace/R.Report" -f`; with no destination it overwrites the saved link (`pbir report link`). Publish a `.pbix` as a `.pbix`; never convert and then publish the PBIR folder.
- **`pbir add filter <Table> <Field>`** takes two positional arguments and validates the field against the model; it fails closed when the model is unreachable.
- **DAX spelling differs by surface**: in `pbir model -q`, extension measures and visual calculations write `'Table'[Column]` and `[Measure]`; `Table.Field` is binding syntax for `-d "Role:Table.Field"`, `--add` and `--field` only.
- **DMVs fail on thin reports.** `pbir model -q` against a `byConnection` report runs EVALUATE only (`INFO.TABLES()` returns 400); use `pbir model -d` for schema. Thick reports (`byPath`) open in Desktop query the local engine.
- **Extension measures**: `pbir dax measures add` needs `-d` (data type) and a `-t` table that already exists in the model; a measure on a phantom table breaks every visual that uses it in Desktop. Recipes: [extension measures](../../wiki/pbir-extension-measures.md).
- **Conditional formatting** is created with `pbir visuals cf` and read, edited and removed with `pbir get|set` on a `.cf` path; a wrong selector shape renders nothing without any error. Pass `--target-field` when the driving field is not the formatted one. Details: [conditional formatting](../../wiki/pbir-conditional-formatting.md).
- **A valid write can still be renderer-inert** (selector-scoped objects on New Card and similar). Compare with `pbir cat` of a manually formatted visual before inventing a path.
- **Native table values have no vertical-alignment property.** Use `pbir visuals table-density`; do not invent `values.verticalAlignment`.
- **Schema version errors**: `pbir schema fetch --yes`, then `pbir schema upgrade "Report.Report"`.
- **`pbir visuals python` and `pbir visuals r` create R and Python visuals, which Microsoft retires in May 2027** (they stop working in published reports). Do not start new ones; use a native visual, Deneb or SVG measures (`custom-visuals` plugin).

## Which command for what

```yaml
explore:        pbir ls [--tree -v], pbir find, pbir get, pbir model -d, pbir fields list, pbir filters list
create:         pbir new report, pbir add page|visual|filter|bookmark|title, pbir download (remote report to local)
bind fields:    pbir visuals bind -a "Role:Table.Field", pbir fields replace|replace-table|find (renames across a report)
format:         pbir theme *, pbir visuals format|title|legend|labels|cf|..., pbir set|get, pbir color list|replace, pbir fonts list|replace
layout:         pbir visuals position|resize|align|snap|spacing|z-order|group|mobile, pbir pages resize|type|conform
interactions:   pbir pages interactions|drillthrough|set-tooltip, pbir visuals action, pbir bookmarks *, pbir filters pane-*
audit:          pbir validate, pbir bpa run|rules, pbir usage, pbir access, pbir visuals test|query
bulk:           pbir batch plan|run (reviewed JSON spec; run --plan-digest refuses a drifted plan)
```

## Report and model together

`te mv` cascades model-internal references but cannot see report bindings, so every model rename or move is followed by `pbir fields replace` or `pbir fields replace-table` (dry run first) and `pbir validate --fields`. Full order of operations: [rename cascade](../../wiki/pbir-model-rename-cascade.md).

## Auditing and usage

`pbir bpa run --fail-on error -o json` is the audit gate; rules come from `pbir bpa rules list` and extend with `--rules team-rules.json`. `pbir usage` (views, viewers, pages, load times) and `pbir access` (who can open it, at what tier) use your `az login` token; `--model` creates a hidden usage model in the workspace and needs Contributor, so ask first. Interpretation lives in the `review-report` skill.

## Related skills

- `create-pbi-report`: owns the new-report workflow; do not rebuild it here
- `pbi-report-design`: design judgement (layout, color, KPI, mobile, filter pane)
- `modifying-theme-json`: palette, text classes and theme cleanup
- `pbip` plugin (`pbir-format`, `pbip`, `tmdl`): file formats, read-only context
