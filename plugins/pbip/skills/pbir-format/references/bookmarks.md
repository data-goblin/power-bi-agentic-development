# Bookmarks

Bookmarks capture report state -- active page, filter selections, visual visibility, and object overrides. They enable toggle-based interactivity (show/hide visuals, switch filter states) without custom code.

**Location:** `Report.Report/definition/bookmarks/`

## Files

### bookmarks.json

Lists bookmark IDs and their display order.

```json
{
  "$schema": ".../bookmarksMetadata/1.0.0/schema.json",
  "items": [
    {"name": "958f29ad733c047ee0b8"},
    {"name": "54698b9cd0a0c57906b7"}
  ]
}
```

### [id].bookmark.json

Individual bookmark state. Each bookmark captures a snapshot of the report at a point in time.

```json
{
  "$schema": ".../bookmark/1.4.0/schema.json",
  "displayName": "Show Details",
  "name": "54698b9cd0a0c57906b7",
  "options": {
    "targetVisualNames": ["visual_id_1", "visual_id_2"],
    "suppressDisplay": true
  },
  "explorationState": {
    "version": "1.3",
    "activeSection": "page_hex_id",
    "filters": {
      "byExpr": [...]
    },
    "sections": {
      "<page_id>": {
        "visualContainers": {
          "<visual_id>": {
            "singleVisual": {
              "display": {"mode": "hidden"},
              "objects": {"merge": {...}},
              "activeProjections": {...}
            },
            "filters": {"byExpr": [...]}
          }
        }
      }
    },
    "objects": {
      "merge": {
        "outspacePane": [{"properties": {...}}]
      }
    }
  }
}
```

## Key Properties

### options

| Property | Type | Description |
|----------|------|-------------|
| `targetVisualNames` | string[] | Visuals affected by this bookmark (empty = all) |
| `suppressDisplay` | boolean | When `true`, applying this bookmark will **not** change the display mode (visibility) of any visuals — their current visibility state is preserved. Set `false` (or omit) to allow the bookmark to toggle visibility. |
| `suppressActiveSection` | boolean | Don't change the active page when applied |
| `suppressData` | boolean | Don't restore filter/slicer state |
| `applyOnlyToTargetVisuals` | boolean | Only affect visuals listed in targetVisualNames |

### explorationState

| Property | Description |
|----------|-------------|
| `activeSection` | Page ID that's active when bookmark is applied |
| `filters.byExpr[]` | Report-level filter state snapshot |
| `sections.<page>` | Per-page state overrides |
| `sections.<page>.visualContainers.<visual>` | Per-visual state |
| `objects.merge` | Report-level UI state (filter pane, etc.) |

### Per-visual overrides

| Path | Description |
|------|-------------|
| `singleVisual.display.mode: "hidden"` | Hide the visual (the actual mechanism for bookmark show/hide) |
| `singleVisual.display.mode: "visible"` | Show the visual (explicitly set visible in this bookmark) |
| `singleVisual.objects.merge` | Override specific formatting properties |
| `singleVisual.activeProjections` | Active drill-down field |
| `filters.byExpr[]` | Visual-level filter state |

### Filter snapshot (byExpr)

Bookmarks capture filter state using the same SQExpr format as filterConfig:

```json
{
  "name": "filter_id",
  "type": "Categorical",
  "expression": {
    "Column": {
      "Expression": {"SourceRef": {"Entity": "Date"}},
      "Property": "Calendar Month (ie Jan)"
    }
  },
  "filter": {
    "Version": 2,
    "From": [{"Name": "e", "Entity": "Date", "Type": 0}],
    "Where": [...]
  },
  "howCreated": 1
}
```

**`expression` is required** on every filter entry — it defines which field the bookmark filter applies to. **`filter`** (with `Version`, `From`, `Where`) is optional — it is absent when there is no active filter selection on that field (the field is tracked but with no selected values).

`howCreated`: `0` = visual-level filter, `1` = report-level filter.

## Common Patterns

### Toggle visual visibility

Two bookmarks: one shows visual A and hides B, the other does the reverse. Wire to buttons with `visualLink` actions.

### Reset filters

Bookmark with empty `filters.byExpr` and empty `Where` clauses clears all selections.

### Guided navigation

Chain bookmarks to walk users through pages with specific filter states pre-set.

## Examples

See `examples/K201-MonthSlicer.Report/definition/bookmarks/` for 6 real bookmarks with filter snapshots, visual hide states, and object merge overrides.

## Related

- [filter-pane.md](./filter-pane.md) - Filter structure (same format used in bookmark snapshots)
- [pbir-structure.md](./pbir-structure.md) - Where bookmarks sit in the file tree
