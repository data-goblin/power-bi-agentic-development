---
title: Copilot and Prep data for AI metadata
summary: Which of the four Prep data for AI features exist, what Learn says reaches Copilot, and how te and fab reach them.
kind: reference
status: current
sources:
  - url: https://learn.microsoft.com/en-us/power-bi/create-reports/copilot-prepare-data-ai
  - url: https://learn.microsoft.com/en-us/power-bi/create-reports/copilot-evaluate-data
tools:
  te: 0.8.1.1
last_updated: 2026-11-23
last_verified: 2026-11-23
review_cadence_days: 60
skills: [semantic-models/semantic-model]
---

# Copilot and Prep data for AI metadata

Learn (preview, updated 2026-11): Prep data for AI has an AI data schema, verified answers and AI instructions, plus object descriptions. All are saved on the semantic model, never the report. Authoring works in Desktop and the service; Desktop supports Import, DirectQuery and local composite models only. Q&A must be enabled on the model. AI instructions and the AI data schema save to the model's LSDL (linguistic schema).

```yaml
descriptions: object property; only the first 200 characters are used by Copilot (Unverified here: the figure comes from earlier notes, not from the page above)
ai data schema: selects the fields Copilot prioritises; hiding a field does not remove it from Copilot (Unverified), the schema is the supported way to narrow the surface
verified answers: trigger phrases mapped to a pinned visual
ai instructions: free text, steering rather than binding; 10,000 character limit (Unverified)
after a Git or pipeline deployment: refresh the model in the service to sync the LSDL (Direct Lake and DirectQuery: once a day)
```

## Reaching them from a terminal

- `te` has no verb for these. `skills/semantic-model/scripts/manage-ai-metadata.csx` reads and writes instructions and schema through the culture's linguistic metadata:

```bash
TE_AI_ACTION=get TE_AI_TARGET=both te script skills/semantic-model/scripts/manage-ai-metadata.csx --model ./model --output-format json
TE_AI_ACTION=set TE_AI_TARGET=instructions TE_AI_INPUT_FILE=./instructions.md te script skills/semantic-model/scripts/manage-ai-metadata.csx --model ./model --save
```

- In a PBIP project the files are under `<Name>.SemanticModel/Copilot/` (`schema.json`, `Instructions/instructions.md`, verified answers); edit them there and publish with `fab`
- `te deploy --skip-linguistic-metadata` keeps instructions edited in the service from being overwritten
- Description quality, unique field names and unused-object removal come first: `te bpa run -r skills/semantic-model/rules/model-rules.json`
