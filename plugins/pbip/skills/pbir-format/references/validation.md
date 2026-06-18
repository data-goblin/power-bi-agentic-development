# Validating PBIR conformance

PBIR is conformant when it passes every dimension below, not just JSON schema. Prefer
`pbir validate` (it checks all of these at once); when editing JSON directly, hand-author
to these rules.

## Validate with the CLI

```bash
pbir validate "Report.Report"            # structure + schema
pbir validate "Report.Report" --all      # + fields + QA + semantic
pbir validate "Report.Report" --fields   # + field references resolve in the model
pbir validate "Report.Report" --qa       # + quality rules (overlap, hidden, filters, counts, layout, role cardinality)
pbir validate "Report.Report" --semantic # + visual type ids / objects / vCO names vs the core visual catalog
pbir validate "Report.Report" --strict   # promote field/QA/semantic warnings to errors
pbir validate "Report.Report" --json     # machine-readable
```

The same checks run implicitly on every `pbir` mutation. To bypass a check deliberately,
use the global flag before the subcommand: `--skip <category>` (repeatable,
comma-separated) or `--rawdog` (skip all). Categories: `structure`, `schema`,
`schema-version`, `fields`, `enums`, `qa`, `roles`, `layout`, `theme`.

## The conformance dimensions

- **structure** -- folder layout matches the PBIR tree and required files are present (version.json, report.json, pages/pages.json, each page.json, each visual.json).
- **schema** -- each file validates against its `$schema`, and the `$schema` URL is well-formed and points at a known version.
- **schema-version** -- parent and embedded schema versions form a compatible set; do not mix versions across the report (see `schemas.md`).
- **required fields** -- per file type:
  - `definition.pbir`: `$schema`, `version`, `datasetReference` (with `byPath` or `byConnection`)
  - `version.json`: `$schema`, `version`
  - `report.json`: `$schema`, `themeCollection`
  - `pages/pages.json`: `$schema`, `pageOrder`
  - `page.json`: `$schema`, `name`, `displayName`, `displayOption`
  - `visual.json`: `$schema`, `name`, `position`, and one of `visual` or `visualGroup`
- **name + id** -- every `name` matches `[a-zA-Z0-9_][a-zA-Z0-9_-]*` (no spaces, no leading hyphen), is unique among siblings, and matches its folder name. Spaces in page/visual folder names deploy but do not render.
- **fields** -- every field reference (Entity/Property, queryRef, filter, sort, conditional formatting) resolves to a real table/column/measure of the right kind in the connected model. Discover with `pbir fields list` and `pbir model`.
- **enums** -- enumerated properties use allowed values only (see `enumerations.md`); discover allowed values with `pbir schema describe <type> <object>`.
- **roles** -- data roles bound on a visual exist for that visual type and respect cardinality (single vs multiple). Discover with `pbir schema roles <type>`.
- **qa** -- quality heuristics: visuals on-canvas and non-overlapping, no stray hidden visuals, sane field counts, layout and role-cardinality checks.
- **layout** -- positions sit within the page canvas and sizes are non-negative.
- **theme** -- theme JSON is structurally valid and referenced colors and text classes resolve.
- **semantic** -- `visualType` ids, per-type `objects` names, and the 15 `visualContainerObjects` names match the core visual catalog the CLI bundles (advisory; custom visuals use arbitrary ids). See `visual-container-formatting.md`.

## Discover and audit before authoring

- `pbir schema describe <type>` then `pbir schema describe <type> <object>` -- valid objects, properties, allowed values, and ranges for a visual type.
- `pbir schema roles <type>` -- the canonical data roles a visual type accepts.
- `pbir color list "Report.Report"` -- every hard-coded color literal and where it is used (audit before re-coloring).
- `pbir fonts list "Report.Report"` -- font families, sizes, and weights across the report and theme.

## Verify rendering

JSON conformance does not guarantee a visual renders. After editing, reload and screenshot
the open Desktop instance and inspect the PNG; see `desktop-bridge.md`.
