---
title: The Copilot folder in a semantic model
summary: What lives in Copilot/ inside a .SemanticModel folder, where its schemas are, and what a deployment needs
kind: reference
status: current
sources:
  - url: https://learn.microsoft.com/en-us/power-bi/create-reports/copilot-prepare-data-ai
  - url: https://github.com/microsoft/json-schemas/tree/main/fabric/item/semanticModel/copilot
tools:
  te: 0.8.1.1
last_updated: 2026-11-23
last_verified: 2026-11-23
review_cadence_days: 90
skills: [pbip/pbip]
---

# The Copilot folder

Microsoft removed this folder's description from the projects-dataset Learn page on 2026-03-25. The folder is still written when Copilot tooling ("Prep data for AI") is configured. Schemas now live in [microsoft/json-schemas](https://github.com/microsoft/json-schemas/tree/main/fabric/item/semanticModel/copilot): `schema`, `examplePrompts` and `settings`, each at 1.0.0.

```dirtree
<Name>.SemanticModel/Copilot/
  Instructions/instructions.md      AI instructions, markdown, up to 10,000 characters, model level
  Instructions/version.json
  VerifiedAnswers/definitions/<id>/ definition.json, filters.json, visualSource.json (PBIR format)
  VerifiedAnswers/version.json
  schema.json                       AI data schema: visible tables, columns and field synonyms
  examplePrompts.json               suggested questions for zero-prompt Copilot
  settings.json
  version.json
```

- AI instructions are unstructured guidance; the model is not guaranteed to follow them exactly
- Edits made through Git or a deployment pipeline need a model refresh in the service to take effect (import: every deployment; DirectQuery and Direct Lake: at most once per day)
- Desktop supports Prep data for AI for Import, DirectQuery and composite (local) models; the service supports all model types
- The folder is committed by default; ignore single files with `.gitignore` if instructions should stay private
- After configuring, mark the model Approved for Copilot in the service (Settings)
