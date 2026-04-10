# TE CLI Utility Scripts

Scripts that are meant to be run through `te script`.

These scripts are experimental utilities provided as-is. They are not official
Tabular Editor product features, are not covered by normal product support, and
may depend on metadata shapes or implementation details that can change. Review
the scripts before use and test against copies or non-production models first.

## manage-ai-metadata.csx

Non-interactive CRUD for semantic model AI instructions and AI schema stored in culture linguistic metadata. It follows the v1 extension contract:

- `CustomInstructions` maps to `Copilot/Instructions/instructions.md`
- `Entities` maps to `Copilot/schema.json`

PowerShell examples:

```powershell
$env:TE_AI_ACTION = "get"
$env:TE_AI_TARGET = "both"
te script -S scripts/manage-ai-metadata.csx -m ./Model.SemanticModel --output-format json

$env:TE_AI_ACTION = "set"
$env:TE_AI_TARGET = "instructions"
$env:TE_AI_INPUT_FILE = "./instructions.md"
te script -S scripts/manage-ai-metadata.csx -m ./Model.SemanticModel --save

$env:TE_AI_ACTION = "set"
$env:TE_AI_TARGET = "schema"
$env:TE_AI_INPUT_FILE = "./schema.json"
te script -S scripts/manage-ai-metadata.csx -m ./Model.SemanticModel --save

$env:TE_AI_ACTION = "delete"
$env:TE_AI_TARGET = "schema"
te script -S scripts/manage-ai-metadata.csx -m ./Model.SemanticModel --save
```

In bash/zsh, set the same variables inline, for example
`TE_AI_ACTION=get TE_AI_TARGET=both te script ...`.

Environment variables:

- `TE_AI_ACTION`: `list`, `get`, `set`, or `delete`
- `TE_AI_TARGET`: `instructions`, `schema`, or `both`
- `TE_AI_CULTURE`: optional culture name
- `TE_AI_INPUT_FILE`: file used by `set`
- `TE_AI_INPUT`: inline payload used by `set` when no input file is provided
- `TE_AI_OUTPUT_FILE`: optional JSON output path
- `TE_AI_ALLOW_OVER_LIMIT=true`: allows AI instructions longer than 10000 characters

`schema.json` uses the Copilot schema shape:

```json
{
  "tables": [
    {
      "name": "Sales",
      "include": true,
      "columns": [{ "name": "Order Date", "include": true }],
      "measures": [{ "name": "Sales Amount", "include": true }]
    }
  ]
}
```

## edit-ai-instructions-interactive.csx

TE3 Desktop GUI editor for `CustomInstructions`. It uses the model, not the current selection, defaults to `en-US`, uses a plain multiline text editor, enforces the 10000-character guard, and edits the same metadata as the non-interactive script.

## edit-ai-schema-interactive.csx

TE3 Desktop GUI editor for Copilot schema JSON. It uses the model, not the current selection, defaults to `en-US`, uses a plain multiline text editor for the JSON tab, and edits the culture `Entities` payload.

## manage-ai-metadata-interactive.csx

Combined experimental TE3 GUI for both targets. Prefer the two single-purpose scripts above for demos and screenshots.
