---
title: What a rename leaves behind after te mv and pbir fields replace
summary: Locations in a PBIP that hold table, column or measure names outside the structures the rename tools update
kind: gotcha
status: current
sources:
  - url: https://learn.microsoft.com/en-us/power-bi/developer/projects/projects-report
tools:
  te: 0.8.1.1
  pbir: 0.9.33
last_updated: 2026-11-23
last_verified: 2026-11-23
review_cadence_days: 60
verified_by:
  - te mv --help
  - pbir fields replace --help
skills: [pbip/pbip]
---

# What a rename leaves behind

Rename the model object with `te mv --save`, then repair each report with `pbir fields replace` or `pbir fields replace-table`. Both validate their own writes. Afterwards search for the old name in the places below; these hold names in free text, not in the structures the tools walk. Unverified against the pbir 0.9.33 source: a tool may already cover one of them, so grep first and edit only what remains.

```bash
grep -rn "Old Name" Project.Report Project.SemanticModel --include="*.json" --include="*.tmdl" --include="*.dax"
```

```yaml
SparklineData selectors: 'SparklineData(Table.Measure_[Table.Column])' inside selector.metadata; a compact string, not SourceRef.Entity JSON
culture linguisticMetadata: cultures/<locale>.tmdl embeds JSON whose ConceptualEntity and ConceptualProperty values name tables and columns; the dictionary keys are generated and need no change
DAX query files: <Name>.SemanticModel/DAXQueries/*.dax (Learn); a copy in the .Report folder is unverified
semanticModelDiagramLayout.json: table names as keys; not editable outside Desktop, so let Desktop rewrite it
TMDL scripts: <Name>.SemanticModel/TMDLScripts/*.tmdl
```

Edit these by text replacement with the exact old name in quotes, then run `te validate --model <definition> --errors-only --non-interactive` and `pbir validate <Report> --fields --strict`.

A new name that contains whitespace needs single quotes at every TMDL and DAX reference (`te mv` rewrites DAX references; hand-edited text does not, so grep for the old name after a hand edit).
