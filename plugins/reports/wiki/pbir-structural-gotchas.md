---
title: pbir bookmarks, filters, reference lines and error bars
summary: "Behaviours of the structural pbir commands that help text leaves out: bookmark scopes, filter type changes, non-idempotent adds."
kind: gotcha
status: current
sources:
  - url: https://learn.microsoft.com/en-us/power-bi/create-reports/desktop-bookmarks
  - url: https://learn.microsoft.com/en-us/power-bi/create-reports/power-bi-report-filter-types
tools:
  pbir: 0.9.33
last_updated: 2026-11-23
last_verified: 2026-11-23
review_cadence_days: 90
verified_by:
  - pbir add bookmark --help
  - pbir visuals reference-line add --help
  - pbir visuals error-bars add --help
skills: [reports/pbir-cli]
---

# pbir structural commands: what help text leaves out

## Bookmarks

[Learn: bookmarks](https://learn.microsoft.com/en-us/power-bi/create-reports/desktop-bookmarks). Bookmarks snapshot filter state, visual visibility and page; adding visuals, renaming fields or changing filters can silently break them. Use them only when navigation and slicers cannot do the job, and audit existing ones before changing a report.

```bash
pbir add bookmark "R.Report" "Default View" --no-display
pbir visuals action "R.Report/P.Page/Reset.Visual" --type Bookmark --target "Default View"
```

- `--no-data` skips filter and slicer state; `--no-display` skips visual visibility; `--no-current-page` skips the page. A filter-reset bookmark is Data-scoped, so pass `--no-display`: a Display-scoped one moves, shows and hides visuals unexpectedly
- Power BI fills the captured state when the bookmark is used in the UI; a bookmark created by pbir starts as a shell, so capture the real state in Desktop or the service
- Copying a bookmark to another report keeps `activeSection` page ids and `targetVisualNames` visual ids; update them when the target report's ids differ
- Re-capture after slicers change; a reset button only restores what the bookmark captured

## Filters

[Learn: filter types](https://learn.microsoft.com/en-us/power-bi/create-reports/power-bi-report-filter-types). The type (Categorical, TopN, Advanced, RelativeDate) cannot be changed in place because each has a different JSON structure: remove and recreate. `pbir filters list` has no `-v`; use `--json`.

## Reference lines

`pbir visuals reference-line add` is not idempotent: re-running appends a new entry with a new id, so a retried call duplicates the line. Run `pbir visuals reference-line list` first, or `remove --all` and re-add, or use `pbir batch`. Style the entry afterwards with `pbir set "<container>.id(N).<property>"`. A measure passed to `--value` must already be bound to a role on the visual.

## Error bars

Bind the series first (`pbir visuals bind --add "Y:Table.Measure" --type Measure`), then `pbir visuals error-bars add --series Table.Measure --upper Table.Upper`; an unbound series errors. Style with `pbir set "error.field(<queryRef>).<property>"` using the queryRef the add command prints. `--lower` defaults to the upper bound, which gives bullet markers. Shade properties are not in the `error` schema; they belong to the y1 axis reference line. Removal is idempotent.

## Converting and rebinding

Converting a legacy single-file `report.json` report to PBIR is a one-way upgrade done in Power BI Desktop. `pbir report rebind` to a model with different table or column names breaks bindings: run `pbir validate --fields` afterwards and repair with [the rename cascade](pbir-model-rename-cascade.md).
