# TE CLI Scripts

Utility C# scripts for `te script`. Pass `--output-format json` for agent use,
and add `--save` when setting or deleting metadata.

## Semantic model AI metadata

### manage-ai-metadata.csx

Read, set, list, or delete semantic model AI instructions and AI schema stored
in culture linguistic metadata:

- `CustomInstructions` maps to Copilot instructions.
- `Entities` maps to the semantic model AI schema.

```bash
TE_AI_ACTION=get TE_AI_TARGET=both \
  te script -s "workspace" -d "model" \
  -S scripts/manage-ai-metadata.csx \
  --output-format json --non-interactive
```

```bash
TE_AI_ACTION=set TE_AI_TARGET=instructions TE_AI_INPUT_FILE=instructions.md \
  te script -s "workspace" -d "model" \
  -S scripts/manage-ai-metadata.csx \
  --save --output-format json --non-interactive
```

Environment variables:

- `TE_AI_ACTION`: `list`, `get`, `set`, or `delete`. Default: `get`.
- `TE_AI_TARGET`: `instructions`, `schema`, or `both`.
- `TE_AI_CULTURE`: optional culture name. Defaults to the best available
  culture and creates `en-US` on `set` when needed.
- `TE_AI_INPUT_FILE`: payload file for `set`.
- `TE_AI_INPUT`: inline payload for `set`.
- `TE_AI_OUTPUT_FILE`: optional output file.
- `TE_AI_ALLOW_OVER_LIMIT=true`: allow instructions over 10000 characters.

### edit-ai-instructions-interactive.csx

TE3 Desktop GUI editor for AI instructions. It uses the connected model,
defaults to `en-US`, does not require a selected object, and enforces the
10000 character guard.

### edit-ai-schema-interactive.csx

TE3 Desktop GUI editor for AI schema. It opens on a perspective-editor-style
object tree and includes a JSON tab for exact schema roundtrips.

### manage-ai-metadata-interactive.csx

Original combined TE3 Desktop prototype for editing both AI instructions and
AI schema in one dialog. Prefer the two focused GUI editors above for normal
interactive work.
