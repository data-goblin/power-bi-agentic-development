# filter (Filter Entity)

A filter entity attached to a visual, page, or report — not a standalone visual and not the filter pane chrome.

## Containers

| Container | Key properties                                      |
|-----------|-----------------------------------------------------|
| `general` | `isInvertedSelectionMode`, `requireSingleSelect`    |

## Theme Example

```json
{
  "name": "My Theme",
  "visualStyles": {
    "filter": {
      "*": {
        "general": [{ "requireSingleSelect": false, "isInvertedSelectionMode": false }]
      }
    }
  }
}
```

## Notes

- `filter` has only one container (`general`) with two behavioural boolean properties — there is no visual styling (color, font, border) available here.
- This is **not** the filter pane. Filter pane styling (`outspacePane`, `filterCard`) is applied via report-level theme properties, not via `visualStyles`. See `pbir-format` skill references: `references/filter-pane.md` and `references/theme.md`.
- Use this container sparingly — forcing `requireSingleSelect` or `isInvertedSelectionMode` via theme applies the setting globally to all filter entities across the report.
