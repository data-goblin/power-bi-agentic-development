# Serialize/Build Workflow

Split a monolithic theme JSON into small, focused files for editing, then rebuild. This is the recommended approach for substantial theme modifications; it avoids loading 2000+ lines of JSON into context.

## When to Use

- Authoring a new theme from a template or base theme
- Making multiple changes across different sections (colors + typography + visual styles)
- Reviewing or auditing an unfamiliar theme's structure
- Consolidating formatting from multiple sources into a single theme

For single-property changes (one color, one font size), use `pbir theme set-colors` or `pbir theme set-formatting` directly instead.

## Serialization

```bash
# Serialize from a report's active theme
pbir theme serialize "Report.Report" -o /tmp/Work.Theme

# Serialize from a standalone theme JSON file
pbir theme serialize theme.json -o /tmp/Work.Theme

# Serialize with all supported properties (includes defaults)
pbir theme serialize "Report.Report" -o /tmp/Work.Theme --full
```

> **Note:** Serialize to a folder outside the `.Report/` directory. The PBIR validation hooks monitor `.Report/` for JSON changes and will flag serialized fragments as invalid PBIR files, blocking further edits. Use `/tmp/`, a sibling folder, or any path outside the report tree.

## Serialized File Structure

Serialization produces a `.Theme` folder with these files:

| File | Contents |
|------|----------|
| `_config.json` | Top-level keys: `name`, `dataColors`, semantic colors (`good`/`bad`/`neutral`), `textClasses`, background/foreground variants, accent colors |
| `_wildcards.json` | `visualStyles["*"]["*"]` wildcard section (container defaults for all visuals) |
| `<type>.json` | One file per visual-type override (e.g., `slicer.json`, `page.json`, `textbox.json`) |

Each file is small (typically under 100 lines) and safe to read and edit directly.

## Editing Serialized Files

### `_config.json`

Modify the color system, typography, and named colors:

```bash
# Check structure
jq 'keys' /tmp/Work.Theme/_config.json

# Edit dataColors (the series palette)
jq '.dataColors = ["#1971c2","#f08c00","#2f9e44","#ae3ec9","#e03131"]' \
  /tmp/Work.Theme/_config.json > tmp && mv tmp /tmp/Work.Theme/_config.json

# Edit a text class
jq '.textClasses.title.fontSize = 14 | .textClasses.title.fontFace = "Segoe UI Semibold"' \
  /tmp/Work.Theme/_config.json > tmp && mv tmp /tmp/Work.Theme/_config.json

# Edit semantic colors
jq '.good = "#2f9e44" | .bad = "#e03131" | .neutral = "#868e96"' \
  /tmp/Work.Theme/_config.json > tmp && mv tmp /tmp/Work.Theme/_config.json
```

### `_wildcards.json`

Modify the wildcard visual styles (container defaults):

```bash
# Set title defaults
jq '.title[0].show = true | .title[0].fontSize = 14' \
  /tmp/Work.Theme/_wildcards.json > tmp && mv tmp /tmp/Work.Theme/_wildcards.json

# Disable drop shadows globally
jq '.dropShadow[0].show = false' \
  /tmp/Work.Theme/_wildcards.json > tmp && mv tmp /tmp/Work.Theme/_wildcards.json
```

### Visual-Type Overrides

Edit or create type-specific files:

```bash
# Edit existing textbox override
jq '.title[0].show = false | .background[0].show = false' \
  /tmp/Work.Theme/textbox.json > tmp && mv tmp /tmp/Work.Theme/textbox.json

# Create a new visual-type override (e.g., for card)
echo '{"title": [{"fontSize": 16}], "border": [{"show": true, "radius": 8}]}' | \
  jq . > /tmp/Work.Theme/card.json
```

## Building

```bash
# Build only (produces a merged JSON file in the current directory)
pbir theme build /tmp/Work.Theme

# Build and apply directly to a report
pbir theme build /tmp/Work.Theme -o "Report.Report" -f

# Build, apply, and clean up the .Theme folder
pbir theme build /tmp/Work.Theme -o "Report.Report" -f --clean
```

The `--clean` flag removes the `.Theme` folder after a successful build.

## Validation

Validate at any stage:

```bash
# Validate the serialized folder (before building)
pbir theme validate /tmp/Work.Theme

# Validate the built theme (after applying to report)
pbir theme validate "Report.Report"
```

## Round-Trip Integrity

The serialize/build cycle produces an identical theme JSON. The process is lossless; no properties are dropped or reordered. This means serialize/build can be used safely for inspection without modifying the theme, since building without `-o` produces a standalone file without touching the report.
