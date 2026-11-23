---
title: PBIP entry files with schema-checked examples
summary: .pbip, .platform, definition.pbir and definition.pbism as Desktop writes them, with current schema versions and a project that validates
kind: reference
status: current
sources:
  - url: https://learn.microsoft.com/en-us/power-bi/developer/projects/projects-overview
  - url: https://learn.microsoft.com/en-us/power-bi/developer/projects/projects-report
  - url: https://github.com/microsoft/json-schemas/tree/main/fabric
tools:
  pbir: 0.9.33
last_updated: 2026-11-23
last_verified: 2026-11-23
review_cadence_days: 90
verified_by:
  - python3 -I plugins/pbip/skills/pbip/scripts/validate_pbip.py plugins/pbip/wiki/examples/bikes --no-pbir-cli
  - pbir validate plugins/pbip/wiki/examples/bikes/Bikes.Report --fields
skills: [pbip/pbip]
---

# PBIP entry files

The project in [examples/bikes](examples/bikes/Bikes.pbip) is a thick PBIP: `Bikes.pbip`, `Bikes.Report` and `Bikes.SemanticModel` side by side. Each JSON file was checked against its schema from microsoft/json-schemas (draft-07), and `pbir validate --fields` loads the model by path.

```yaml
Bikes.pbip: schema pbip/pbipProperties/1.0.0; artifacts[].report.path points at the .Report folder; optional file
Bikes.Report/definition.pbir: schema item/report/definitionProperties/2.0.0; exactly one of byPath or byConnection
Bikes.Report/.platform and Bikes.SemanticModel/.platform: schema gitIntegration/platformProperties/2.1.0; 2.1.0 adds metadata.sensitivityLabelId
Bikes.SemanticModel/definition.pbism: schema item/semanticModel/definitionProperties/1.0.0; the version string is the pbism version (4.0 or higher allows TMDL)
report definition: report 3.3.0, page 2.1.0, pagesMetadata 1.1.0, versionMetadata 1.0.0, visualContainer 2.13.0
```

## byPath and byConnection

`definition.pbir` 2.0.0 has `additionalProperties: false`; a byConnection holds only `connectionString`. The six-property byConnection form belongs to schema 1.0.0 (Learn, report folder, "Version 1" tab) and fails a 2.0.0 check.

```json
"datasetReference": { "byPath": { "path": "../Bikes.SemanticModel" } }
```

- `byConnection.connectionString` must point at a semantic model hosted in Fabric. A model in any other Analysis Services instance needs `byPath` to a semantic model folder that contains `modelReference.json`
- `byPath` is relative to the folder that holds `definition.pbir`

## Folder naming

Page, visual and bookmark folder names are the object's `name`: letters, digits, underscore or hyphen, at most 50 characters (`name` has `maxLength: 50` in page 2.1.0 and visualContainer 2.13.0). The example page folder `Overview` is a valid hand-chosen name; Desktop itself writes 20-character hex ids.

## Fork a project

Copy the folder, rename the `.Report` and `.SemanticModel` folders and the `.pbip`, update `artifacts[].report.path` and a `byPath`, set each `.platform` `displayName`, and generate a new `logicalId` if the copy deploys as its own Fabric item.
