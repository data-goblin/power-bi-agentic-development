---
title: Deneb template format v2 and terminal import
summary: Template usermeta v2 (datasets record, __dataset.N__ placeholders) and how to apply a template without the Deneb GUI.
kind: schema
status: current
sources:
  - url: https://deneb.guide/docs/templates
  - url: https://deneb.guide/schema/deneb-template-usermeta-v2.json
last_updated: 2026-11-23
last_verified: 2026-11-23
review_cadence_days: 60
verified_by:
  - gh api repos/deneb-viz/deneb/contents/apps/deneb/capabilities.json
skills: [custom-visuals/deneb-visuals]
---

# Deneb template format v2 and terminal import

A template is a Vega or Vega-Lite spec with a `usermeta` block. Deneb 2.0 moved to metaVersion 2; the JSON schema is [deneb-template-usermeta-v2.json](https://deneb.guide/schema/deneb-template-usermeta-v2.json). Example that passes that schema (usermeta validated 2026-11-23): [deneb-template-v2-bar.json](examples/deneb-template-v2-bar.json).

## What changed from v1

```yaml
datasets: record keyed by dataset name, each value an array of field definitions (v1 had a flat usermeta.dataset array)
key: placeholder __<dataset>.<index>__ such as __dataset.0__ (pattern ^__[a-zA-Z0-9_]+\.\d+__$, max 30 chars); v1 keys like __category__ are rejected
deneb.metaVersion: 2 (schema allows 1 to 2)
field.kind: column | measure | parameter | any; informational only, not used to filter on import
field.type: bool | text | numeric | dateTime | other
required_per_field: key, name, type
optional_per_field: description, namePlaceholder, supportFieldConfiguration (highlight, highlightStatus, highlightComparator, format, formatted, names, treatAsParameter)
interactivity: tooltip, contextMenu, contextMenuSelector, selection, selectionMode, highlight, dataPointLimit (1 to 250); tooltip, contextMenu, selection and dataPointLimit are required
config: optional string holding the Vega config, kept apart from the spec
```

## Applying a template from the terminal

1. Read `usermeta.datasets.dataset` (or the named dataset): each `key` is a placeholder, `kind` says column or measure
2. Bind the real fields to the `dataset` role with `pbir visuals bind`; a measure bound where the template expects a column renders blank and still passes `pbir validate`
3. Copy the spec, delete `usermeta` and any root `$schema`, and replace every `__dataset.N__` token with the real field display name (spaces kept; `. [ ] \ "` become `_`)
4. Move `usermeta.config`, if present, into a config file
5. Inject: `pbir visuals deneb <visual> --spec-file spec.vl.json --provider vegaLite --config-file config.json`
6. Check for leftovers: no `__dataset.` tokens, no `usermeta`, no `data.url` or `data.values`, no `__identity__`

Reading a v1 template (`usermeta.dataset`, `__category__` keys) works the same way with the old placeholder pattern; Deneb migrates v1 templates only when the GUI imports them.
