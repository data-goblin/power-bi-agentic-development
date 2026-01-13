# BPA Annotations in TMDL

How Best Practice Analyzer rules and settings appear in TMDL (Tabular Model Definition Language) files.

## Overview

BPA configuration in TMDL uses annotations on the model object. Three annotation types control BPA behavior:

1. `BestPracticeAnalyzer` - Inline rule definitions
2. `BestPracticeAnalyzer_IgnoreRules` - Rules to skip
3. `BestPracticeAnalyzer_ExternalRuleFiles` - External rule file URLs

## Location

BPA annotations appear in `model.tmdl` at the model level:

```
definition/
  model.tmdl          <- BPA annotations here
  tables/
  relationships.tmdl
```

## Annotation Syntax

### Inline Rules (BestPracticeAnalyzer)

Define custom rules directly in the model:

```tmdl
model MyModel
    culture: en-US

annotation BestPracticeAnalyzer =
        [
          {
            "ID": "CUSTOM_RULE_1",
            "Name": "Custom rule name",
            "Category": "Custom",
            "Description": "Rule description",
            "Severity": 1,
            "Scope": "Measure",
            "Expression": "string.IsNullOrWhitespace(Description)",
            "FixExpression": null,
            "CompatibilityLevel": 1200
          },
          {
            "ID": "CUSTOM_RULE_2",
            "Name": "Another custom rule",
            "Category": "Custom",
            "Severity": 2,
            "Scope": "Column",
            "Expression": "IsHidden and ReferencedBy.Count = 0"
          }
        ]
```

**Notes:**
- JSON array format
- Multi-line annotation with indentation
- Multiple rules in single annotation
- Same schema as external rule files

### Ignored Rules (BestPracticeAnalyzer_IgnoreRules)

Exclude specific rules from checking:

```tmdl
annotation BestPracticeAnalyzer_IgnoreRules = {"RuleIDs":["DAX_DIVISION_COLUMNS","META_AVOID_FLOAT","PERF_UNUSED_COLUMNS"]}
```

**Format:**
```json
{
  "RuleIDs": ["RULE_ID_1", "RULE_ID_2", ...]
}
```

**Use cases:**
- Rules not applicable to this model
- Known false positives
- Intentional exceptions to standards

### External Rule Files (BestPracticeAnalyzer_ExternalRuleFiles)

Reference external rule collections:

```tmdl
annotation BestPracticeAnalyzer_ExternalRuleFiles = ["https://raw.githubusercontent.com/TabularEditor/BestPracticeRules/master/BPARules-standard.json"]
```

**Format:**
- JSON array of URLs
- URLs must return valid BPA rule JSON
- Multiple URLs supported

**Common external files:**
- `BPARules-standard.json` - Strict standard rules
- `BPARules-standard-lax.json` - Relaxed standard rules

## Complete Example

```tmdl
model SpaceParts
    culture: en-US
    defaultPowerBIDataSourceVersion: powerBI_V3
    discourageImplicitMeasures

extendedProperty TabularEditor_DeploymentMetadata = {"User":"klonk","Time":"2026-01-12T16:38:05"}

annotation TabularEditor_SerializeOptions = {"IgnoreInferredObjects":true}

annotation BestPracticeAnalyzer_IgnoreRules = {"RuleIDs":["DAX_DIVISION_COLUMNS","META_AVOID_FLOAT","RELATIONSHIP_COLUMN_NAMES","PERF_UNUSED_COLUMNS","PERF_UNUSED_MEASURES"]}

annotation BestPracticeAnalyzer_ExternalRuleFiles = ["https://raw.githubusercontent.com/TabularEditor/BestPracticeRules/master/BPARules-standard-lax.json"]

annotation BestPracticeAnalyzer =
        [
          {
            "ID": "CUSTOM_UDF_DESCRIPTION",
            "Name": "UDF must have description",
            "Category": "Governance",
            "Description": "All user-defined functions require documentation.",
            "Severity": 2,
            "Scope": "UserDefinedFunction, Calendar",
            "Expression": "string.IsNullOrWhitespace(Description)",
            "FixExpression": "Description = \"TODO: Document this function\"",
            "CompatibilityLevel": 1470
          }
        ]
```

## Object-Level Annotations

Individual objects can also have BPA-related annotations:

### Ignoring Rules on Specific Objects

```tmdl
table Customers

    measure 'Customer Count' =
            COUNTROWS(Customers)
        formatString: #,##0
        annotation BestPracticeAnalyzer_Ignore = {"RuleIDs":["META_MEASURE_NO_DESCRIPTION"]}
```

**Note:** Object-level ignore annotations exempt only that specific object from the listed rules.

## Reading BPA Annotations

### Parsing from TMDL

To extract BPA configuration from TMDL:

1. Find `annotation BestPracticeAnalyzer*` lines in `model.tmdl`
2. Extract the JSON value after `=`
3. Handle multi-line JSON (indented continuation)

**Pattern for inline rules:**
```
annotation BestPracticeAnalyzer =
        [
          { JSON content }
        ]
```

**Pattern for ignore/external:**
```
annotation BestPracticeAnalyzer_IgnoreRules = { JSON on single line }
```

### Multi-line Handling

TMDL uses tab indentation for multi-line values:

```tmdl
annotation Name =
        {
          "key": "value",
          "nested": {
            "child": true
          }
        }
```

The JSON starts after `=` and continues on indented lines until the next non-indented line.

## Modifying BPA Annotations

### Adding a New Inline Rule

1. Read existing `BestPracticeAnalyzer` annotation
2. Parse JSON array
3. Append new rule object
4. Serialize back to TMDL format

### Ignoring a Rule

1. Read existing `BestPracticeAnalyzer_IgnoreRules` annotation
2. Parse JSON to get RuleIDs array
3. Add new rule ID
4. Serialize back

### Adding External File

1. Read existing `BestPracticeAnalyzer_ExternalRuleFiles` annotation
2. Parse JSON array
3. Add new URL
4. Serialize back

## Best Practices

1. **Use external files for standard rules** - Reference shared rule collections
2. **Inline rules for model-specific checks** - Custom business rules
3. **Document ignored rules** - Add comments explaining why rules are skipped
4. **Version control annotations** - Track BPA config changes in git
5. **Validate JSON** - Ensure annotation JSON is valid before saving
