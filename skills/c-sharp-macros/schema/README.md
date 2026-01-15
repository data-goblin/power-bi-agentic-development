# C# Macros Schema

> **Temporary Location:** This schema is stored here temporarily until a dedicated schemas repository is available. Once that repo exists, this schema will be moved there and this directory will be removed.

## Files

- `macros-schema.json` - JSON Schema (Draft-07) for validating Tabular Editor MacroActions.json files

## Usage

### Validate with CLI tools

```bash
# Using ajv-cli
ajv validate -s schema/macros-schema.json -d MacroActions.json

# Using check-jsonschema
check-jsonschema --schemafile schema/macros-schema.json MacroActions.json

# Using the provided Python script
python scripts/validate_macros.py MacroActions.json
```

### File Location

MacroActions.json is typically located at:
- Windows: `%LocalAppData%\TabularEditor3\MacroActions.json`
- The file contains an `Actions` array with macro definitions

## Schema Source

Based on Tabular Editor 3 documentation and observed MacroActions.json structure from the [official docs](https://docs.tabulareditor.com/features/creating-macros.html).
