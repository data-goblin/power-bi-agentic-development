---
name: suggest-rule
description: Suggest BPA rules based on a description or model analysis. Use when creating new Best Practice Analyzer rules for Tabular Editor.
argument-hint: [description or model path]
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
   - Review `references/expression-syntax.md` for available properties and patterns
   - Check `examples/comprehensive-rules.json` for similar existing rules

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
   - Ensure Expression syntax is valid
   - Verify Scope includes all applicable object types
   - Check that rule doesn't duplicate existing standard rules

## Examples

**User**: "Create a rule to check if measures use CALCULATE without filters"

**Output**:
```json
{
  "ID": "DAX_CALCULATE_NO_FILTERS",
  "Name": "CALCULATE should have filter arguments",
  "Category": "DAX Expressions",
  "Description": "CALCULATE without filter arguments is redundant. Either add filters or remove CALCULATE.",
  "Severity": 1,
  "Scope": "Measure, CalculatedColumn",
  "Expression": "Tokenize().Any(Type = FUNCTION and Text = \"CALCULATE\") and not Tokenize().Any(Type = FUNCTION and Text = \"CALCULATE\" and Next.Type = OPEN_PARENS and Next.Next.Type <> COMMA)",
  "FixExpression": null,
  "CompatibilityLevel": 1200,
  "Remarks": "May have false positives for complex expressions"
}
```
