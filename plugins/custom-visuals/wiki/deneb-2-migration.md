---
title: Deneb 2.0 changes that break specs
summary: Deneb 2.0 and 2.0.1 changes that affect hand-written Vega and Vega-Lite specs, templates and PBIR properties.
kind: gotcha
status: current
sources:
  - url: https://deneb.guide/docs/changelog
  - url: https://github.com/deneb-viz/deneb/blob/main/apps/deneb/capabilities.json
last_updated: 2026-11-23
last_verified: 2026-11-23
review_cadence_days: 60
verified_by:
  - gh api repos/deneb-viz/deneb/contents/apps/deneb/capabilities.json
skills: [custom-visuals/deneb-visuals]
---

# Deneb 2.0 changes that break specs

Deneb 2.0.0 shipped 2026-09-08 and 2.0.1 on 2026-10-18 (certified, then rolled out to AppSource over about two weeks). The [changelog](https://deneb.guide/docs/changelog) is the source; the property names below were checked against the published `capabilities.json`.

```yaml
signals: pbiContainerWidth / pbiContainerHeight / pbiContainer are deprecated; use denebContainer.width / denebContainer.height / denebContainer. Deneb remaps and logs a warning
root_schema: a root "$schema" in the spec now shows a warning with a Quick Fix; Deneb adds the right one on template export and removes it on import. Leave it out
row_limit: initial dataset is 30000 rows (the most a custom visual can request); the capabilities.json data reduction window is 30000. Older notes saying 10000 are out of date
row_limit_override: loads further rows in batches; Microsoft no longer guarantees rows beyond the initial dataset for PDF and PowerPoint export, so use it for viewing only
templates: format v2, see deneb-templates-v2.md; v1 templates are migrated by the GUI on import only
context_menu: vega.enableContextMenu now toggles whether the menu appears; vega.enableContextMenuSelector toggles data point resolution inside it (both default on)
supporting_fields: each field's highlight, highlightStatus, highlightComparator, format, formatted and names fields are individually switchable; migrated visuals keep what they had
field_parameters: stateManagement.consolidateFieldParameters merges a parameter into one array-valued column; off for migrated projects, on for new ones
continuous_view: dataLimit.enableIncrementalDataUpdates patches data into the live view (default threshold 500 rows, hard ceiling 5000); off by default
display: display.scrollbarWidth (8 to 16 px, default 10) and stateManagement.scaleToZoom (canvas) are new
bundled: Vega 6.4.0 and Vega-Lite 6.4.3 (1.9 bundled Vega 6.2.0 and Vega-Lite 6.4.1); npm latest in 2026-11 is Vega 6.4.0 and Vega-Lite 6.5.0
```

## 2.0.1 fixes worth knowing

- Marks positioned in `encode.enter` no longer render too tall or clip axis labels
- Date fields no longer show a UTC offset in debug viewers and raw tooltips; they resolve to midnight
- `__highlightStatus` no longer reports `on` for every row when another visual cross-highlights

## Still true from 1.9

- `__identity__` and `__key__` were removed; use `__row__`
- AppSource builds cannot fetch remote data (URLs in `data`); the standalone build from GitHub can. Specs for AppSource Deneb must read only `dataset`

## Fixing an old spec

```bash
grep -nE 'pbiContainer|"\$schema"|usermeta|__identity__|__key__' chart.vl.json
```

The plugin's PostToolUse hook runs the same checks on `*.vl.json` and `*.vega.json` files.
