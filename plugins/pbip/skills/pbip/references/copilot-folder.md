# Copilot Folder Reference

> **Archival note:** This documentation was removed from the official Microsoft Learn page
> ([projects-dataset.md](https://learn.microsoft.com/en-us/power-bi/developer/projects/projects-dataset))
> on **2026-03-25** in commit [`facaed5`](https://github.com/MicrosoftDocs/powerbi-docs/commit/facaed5f528092f78a861b29e097176d7118249f)
> ("Remove Copilot tooling details from projects dataset").
> The folder structure remains present in PBIP projects saved with Copilot tooling enabled.
> Content below is sourced from the pre-removal version of the docs
> ([`f806de7`](https://github.com/MicrosoftDocs/powerbi-docs/blob/f806de7629f5d6399598472c873f020f11fff75c/powerbi-docs/developer/projects/projects-dataset.md)).

The `Copilot/` folder lives inside the `.SemanticModel/` folder and contains all
[Copilot tooling](https://learn.microsoft.com/en-us/power-bi/create-reports/copilot-prepare-data-ai)
metadata and settings configured for the semantic model via **Prep data for AI**.


## Folder Structure

```
<Name>.SemanticModel/
  Copilot/
  ├── Instructions/
  │   ├── instructions.md
  │   └── version.json
  ├── VerifiedAnswers/
  │   ├── definitions/
  │   │   └── [verified-answer-ID]/
  │   │       ├── definition.json
  │   │       ├── filters.json
  │   │       └── visualSource.json
  │   └── version.json
  ├── schema.json
  ├── examplePrompts.json
  ├── settings.json
  └── version.json
```


## File Descriptions

### Instructions/instructions.md

Contains the [AI instructions](https://learn.microsoft.com/en-us/power-bi/create-reports/copilot-prepare-data-ai-instructions)
configured for the semantic model, stored as a **markdown** file. These provide Copilot with
business context, terminology, and analytical priorities.

AI instructions:
- Are saved at the semantic model level (not report level)
- Are limited to 10,000 characters
- Are unstructured guidance that the LLM interprets (no guarantee of exact adherence)
- Affect Copilot capabilities but do not extend to general conversations

### Instructions/version.json

Tracks the version of the Instructions file structure. Updated whenever the file representation changes.

### schema.json

Contains the [AI data schema](https://learn.microsoft.com/en-us/power-bi/create-reports/copilot-prepare-data-ai-data-schema)
selection and field synonyms configured for the semantic model. Controls which tables and
columns are visible to Copilot and provides alternative names for fields.

For more information, see the
[schema.json schema document](https://github.com/microsoft/json-schemas/tree/main/fabric/item/semanticModel/copilot/schema).

### VerifiedAnswers/ folder

Contains configured [Verified answers](https://learn.microsoft.com/en-us/power-bi/create-reports/copilot-prepare-data-ai-verified-answers)
for the semantic model. Each verified answer is stored in its own subfolder within `definitions/`
using [PBIR format](https://learn.microsoft.com/en-us/power-bi/developer/projects/projects-report#pbir-format):

| File | Purpose |
|------|---------|
| `definition.json` | Verified answer metadata (trigger phrases, description) |
| `filters.json` | Filter configuration applied to the visual |
| `visualSource.json` | Visual definition that renders the answer |

### VerifiedAnswers/version.json

Tracks the version of the VerifiedAnswers file structure.

### settings.json

Contains top-level Copilot tooling settings.

For more information, see the
[settings.json schema document](https://github.com/microsoft/json-schemas/tree/main/fabric/item/semanticModel/copilot/settings).

### examplePrompts.json

Contains example prompts set up for the semantic model, used by Copilot **Zero Prompt** experiences
(the suggested questions shown when a user first opens Copilot).

For more information, see the
[examplePrompts.json schema document](https://github.com/microsoft/json-schemas/tree/main/fabric/item/semanticModel/copilot/examplePrompts).

### version.json (root)

Tracks the version of the overall Copilot feature file structure. The version is updated whenever
the file representation changes (e.g. when a new file is added to the folder).

For more information, see the
[version.json schema document](https://github.com/microsoft/json-schemas/tree/main/fabric/item/version).


## Authoring and Consumption

- **Authoring** of AI instructions, AI data schema, and verified answers is available in
  both Power BI Desktop and the Power BI service via the **Prep data for AI** button on the
  Home ribbon.
- **Consumption** of these features is available everywhere that Copilot in Power BI exists.
- Power BI Desktop supports Prep data for AI with Import, DirectQuery, and Composite (local)
  connection types only.
- All model types can use Prep data for AI within the Power BI service.


## Git and Deployment Notes

- AI instructions and AI data schemas also save to the LSDL (Linguistic Schema Definition
  Language) and can be edited through that path as well.
- When making LSDL or Copilot tooling edits through Git or deployment pipelines, a model
  refresh in the Power BI service is required to sync changes after deployment:
  - **Import models**: refresh required after deployment
  - **DirectQuery models**: refresh required, but only once per day
  - **Direct Lake models**: refresh required, but only once per day
- The `Copilot/` folder is committed to Git by default. Include or exclude individual files
  as needed via `.gitignore`.


## Marking a Model as Approved for Copilot

After configuring Copilot tooling, mark the semantic model as **Approved for Copilot** in the
Power BI service (Settings > Approved for Copilot). This removes friction treatment from the
standalone Copilot experience for that model and its associated reports.
