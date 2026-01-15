# BPA Rules Schema

> **Temporary Location:** This schema is stored here temporarily until a dedicated schemas repository is available. Once that repo exists, this schema will be moved there and this directory will be removed.

## Files

- `bparules-schema.json` - JSON Schema (Draft-07) for validating Tabular Editor Best Practice Analyzer rule files

## Usage

### Validate with CLI tools

```bash
# Using ajv-cli
ajv validate -s schema/bparules-schema.json -d your-rules.json

# Using check-jsonschema
check-jsonschema --schemafile schema/bparules-schema.json your-rules.json
```

### Reference in JSON files

Add to the top of your BPA rules JSON file:

```json
{
  "$schema": "./path/to/bparules-schema.json"
}
```

## Schema Source

Based on the `RuleScope` enum and `BestPracticeRule` class from [TabularEditor source code](https://github.com/TabularEditor/TabularEditor/blob/master/TabularEditor/BestPracticeAnalyzer/BestPracticeRule.cs).
