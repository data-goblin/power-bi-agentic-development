# Semantic Model Scripts

Utility scripts used by the semantic-model skill when a direct `te` command is
not enough.

## Semantic model AI metadata

These scripts manage or inspect semantic model AI metadata:

- `manage-ai-metadata.csx`: non-interactive `te script` CRUD for AI
  instructions and AI schema.
- `edit-ai-instructions-interactive.csx`: TE3 Desktop GUI editor for AI
  instructions.
- `edit-ai-schema-interactive.csx`: TE3 Desktop GUI editor for AI schema.
- `manage-ai-metadata-interactive.csx`: original combined TE3 Desktop editor
  prototype.
- `get_semantic_model_ai_metadata.py`: Fabric CLI readback and offline
  definition parser.

Use the C# script for fast TOM-backed reads and writes:

```bash
TE_AI_ACTION=get TE_AI_TARGET=both \
  te script -s "workspace" -d "model" \
  -S scripts/manage-ai-metadata.csx \
  --output-format json --non-interactive
```

Use the Python script to confirm the deployed service definition:

```bash
python3 scripts/get_semantic_model_ai_metadata.py \
  "workspace.Workspace/model.SemanticModel" --format json
```
