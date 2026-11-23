---
title: What a rename leaves behind after te mv and pbir fields replace
summary: Locations in a PBIP that hold table, column or measure names outside the structures the rename tools update
kind: gotcha
status: current
sources:
  - url: https://learn.microsoft.com/en-us/power-bi/developer/projects/projects-report
  - url: https://learn.microsoft.com/en-us/power-bi/developer/projects/projects-dataset
  - url: https://pypi.org/project/pbir-cli/0.9.33/
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

Rename the model object with `te mv --save`, then repair each report with `pbir fields replace` or `pbir fields replace-table`. Both validate their own writes. Afterwards search for the old name in the places below; these hold names in free text, not in the structures the tools walk. In the pbir 0.9.33 source, `replace_field` and `replace_table` rewrite field references in visuals, filters and bookmarks of the report only; a search of that source finds no code that reads SparklineData selectors, linguistic metadata, DAX query files, TMDL scripts or the diagram layout, so those stay manual.

```bash
grep -rn "Old Name" Project.Report Project.SemanticModel --include="*.json" --include="*.tmdl" --include="*.dax"
```

```yaml
SparklineData selectors: 'SparklineData(Table.Measure_[Table.Column])' inside selector.metadata; a compact string, not SourceRef.Entity JSON
culture linguisticMetadata: cultures/<locale>.tmdl embeds JSON whose ConceptualEntity and ConceptualProperty values name tables and columns; the dictionary keys are generated and need no change
DAX query files: <Name>.SemanticModel/DAXQueries/*.dax (Learn)
semanticModelDiagramLayout.json: table names as keys; not editable outside Desktop, so let Desktop rewrite it
TMDL scripts: <Name>.SemanticModel/TMDLScripts/*.tmdl
```

Edit these by text replacement with the exact old name in quotes, then run `te validate --model <definition> --errors-only --non-interactive` and `pbir validate <Report> --fields --strict`.

A new name that contains whitespace needs single quotes at every TMDL and DAX reference (`te mv` rewrites DAX references; hand-edited text does not, so grep for the old name after a hand edit).
