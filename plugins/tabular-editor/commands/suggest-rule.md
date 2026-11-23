---
name: suggest-rule
description: Suggest BPA rules based on a description or model analysis. Use when creating new Best Practice Analyzer rules for Tabular Editor.
argument-hint: "[description or model path]"
model: sonnet
---

# Suggest BPA Rule

Generate a BPA (Best Practice Analyzer) rule based on the provided description or model analysis.

## Arguments

$ARGUMENTS

## Instructions

1. **Understand the Request**
   - If a description is provided, identify the best practice to enforce
   - If a model path is provided, analyze the model for potential rule opportunities

2. **Load Skill Context**
   - Load the `bpa-rules` skill for reference documentation
   - Read `${CLAUDE_PLUGIN_ROOT}/wiki/bpa-dynamic-linq.md` for what compiles, and run `te get <path> --properties` for the properties of the scope
   - Check `${CLAUDE_PLUGIN_ROOT}/skills/bpa-rules/examples/comprehensive-rules.json` for similar existing rules

3. **Generate Rule**
   - Determine appropriate Scope based on what objects the rule applies to
   - Write Expression using Dynamic LINQ syntax
   - Consider if a FixExpression is appropriate (only for simple, safe fixes)
   - Assign appropriate Severity (1=info, 2=warning, 3=error)
   - Use standard Category or create descriptive custom category
   - Follow ID naming convention: `PREFIX_DESCRIPTIVE_NAME`

4. **Output Format**

Provide the complete rule in JSON format:

```json
{
  "ID": "PREFIX_RULE_NAME",
  "Name": "Human readable rule name",
  "Category": "Category",
  "Description": "Why this rule matters and guidance for fixing",
  "Severity": 2,
  "Scope": "Measure, CalculatedColumn",
  "Expression": "Dynamic LINQ expression",
  "FixExpression": null,
  "CompatibilityLevel": 1200
}
```

5. **Validate**
   - Run it: `te bpa run --model <model> -r <rules.json> --no-defaults --no-model-rules --rule <ID> --non-interactive --output-format json` and require `ruleErrors` 0
   - Verify Scope includes all applicable object types
   - Check that rule doesn't duplicate existing standard rules

## Example

**User**: "Create a rule to flag visible measures without a description"

**Output**:
```json
{
  "ID": "MEASURE_HAS_DESCRIPTION",
  "Name": "Visible measures need a description",
  "Category": "Documentation",
  "Description": "%objectname% is visible and has no description.",
  "Severity": 3,
  "Scope": "Measure",
  "Expression": "!IsHidden and string.IsNullOrWhitespace(Description)",
  "CompatibilityLevel": 1200
}
```
