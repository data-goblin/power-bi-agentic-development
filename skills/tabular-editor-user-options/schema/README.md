# Tabular Editor User Options Schema

> **Temporary Location:** This schema is stored here temporarily until a dedicated schemas repository is available. Once that repo exists, this schema will be moved there and this directory will be removed.

## Files

- `tmuo-schema.json` - JSON Schema (Draft-07) for validating Tabular Editor .tmuo files

## Usage

### Validate with CLI tools

```bash
# Using ajv-cli
ajv validate -s schema/tmuo-schema.json -d Model.Username.tmuo

# Using check-jsonschema
check-jsonschema --schemafile schema/tmuo-schema.json Model.Username.tmuo

# Using the provided Python script
python scripts/validate_tmuo.py Model.Username.tmuo
```

### File Location

TMUO files are stored alongside model files:
- `<ModelFileName>.<WindowsUserName>.tmuo`
- Example: `AdventureWorks.JohnDoe.tmuo`

## Important Notes

- TMUO files contain user-specific settings and encrypted credentials
- Encrypted credentials are tied to Windows user accounts - cannot be shared
- Add `*.tmuo` to `.gitignore` to prevent accidental commits

## Schema Source

Based on Tabular Editor 3 documentation and observed .tmuo file structure from the [official docs](https://docs.tabulareditor.com/references/user-options.html).
