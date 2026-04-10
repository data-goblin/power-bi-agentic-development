---
name: bpa-rules
version: 0.22.3
description: Interactive BPA rule generation for Power BI semantic models; guided discovery, model investigation, and expert rule authoring. Automatically invoke when the user mentions "BPA rule", "Best Practice Analyzer", or asks to "create a BPA rule", "audit BPA rules", "recommend BPA rules", "set up BPA for my team", "check model for best practices", "validate BPA rules", "improve a BPA expression".
---

# Best Practice Analyzer Rules

Expert guidance for creating and improving BPA (Best Practice Analyzer) rules for Tabular Editor and Power BI semantic models.

## When to Use This Skill

Activate automatically when tasks involve:

- Creating new BPA rules for semantic model validation
- Recommending or choosing BPA rules for a model, team, or organization
- Improving or debugging BPA rule expressions
- Writing FixExpression to auto-remediate rule violations
- Understanding BPA annotations in TMDL files
- Analyzing a semantic model against best practices
- Converting ad-hoc checks into reusable BPA rules
- Auditing or discovering all BPA rules across sources (built-in, URL, model, user, machine)

## Primary Workflow: Interactive Q&A Discovery (Double Diamond)

**CRITICAL: Do NOT generate BPA rules immediately.** This is a requirements-gathering exercise. Use the `AskUserQuestion` tool to conduct an iterative, back-and-forth conversation with the user across multiple rounds. Continue asking questions until sufficient context about the user's business, team, model, and priorities has been gathered. Only then move to rule generation.

The workflow follows a **double-diamond** pattern:
1. **Diverge** -- broadly explore the user's context, organization, and goals
2. **Converge** -- narrow down to specific priorities and constraints
3. **Diverge** -- explore the model structure and identify candidate rule areas
4. **Converge** -- select and generate the final tailored rule set

### Diamond 1: Requirements Gathering (Phases 1-2)

#### Phase 1: Understand the User and Organization

Call `AskUserQuestion` with 2-4 questions per round. After each round, review the answers and ask follow-up questions. **Do not proceed to Phase 2 until the organizational context is clear.** Continue rounds until satisfied.

**Round 1 -- Goal and audience:**

Ask about the primary goal and who will use the rules. Example AskUserQuestion call:
- Question 1: "What is the primary goal for these BPA rules?" -- options: "Set up BPA for my team", "Improve a specific model", "Create governance/compliance rules", (Other)
- Question 2: "Who will use these rules?" -- options: "Solo developer", "Small team (2-5)", "Large org / multiple teams", (Other)
- Question 3: "What tooling do you use?" -- options: "Tabular Editor 3", "Tabular Editor 2", "TE CLI in CI/CD", "Fabric notebooks"

**Round 2 -- Standards and existing rules:**

Based on Round 1 answers, ask about conventions and existing rules. Example:
- Question 1: "Do you have existing naming conventions?" -- options: "Yes, documented", "Yes, informal/ad-hoc", "No conventions yet", (Other)
- Question 2: "Are there BPA rules already in use?" -- options: "Yes, in Tabular Editor", "Yes, from a URL/repo", "No existing rules", (Other)
- Question 3: "Which categories matter most?" -- multiSelect: true -- options: "Performance", "Metadata/Documentation", "DAX quality", "Naming conventions"

**Round 3+ -- Follow-ups as needed:**

If the user has existing rules, ask for the file path or URL and read them. If they have naming conventions, ask for specifics. If they mentioned CI/CD, ask about the pipeline setup. **Keep calling AskUserQuestion until the organizational picture is clear.**

#### Phase 2: Investigate the Model

After Phase 1, use `AskUserQuestion` to determine how to access the model:

- Question: "How is your semantic model available?" -- options: "Published to Fabric / Power BI Service", "Local as PBIP (.tmdl files)", "Local as .pbix file", "I have a model.bim file"

**Then investigate the model based on the answer:**

| Answer | Action |
|--------|--------|
| **Published to Fabric** | Use `AskUserQuestion` to get workspace and model name. Then use `fab` CLI to inspect remotely -- load the `fabric-cli` skill and read `references/model-investigation.md` for specific commands. |
| **Local as PBIP** | Use `AskUserQuestion` to get the path to the `.SemanticModel/definition/` folder. Then read TMDL files directly with Read/Grep tools. |
| **Local as .pbix only** | Guide the user to save as PBIP: **File > Save as > Power BI Project (*.pbip)** in Power BI Desktop. Then ask for the resulting folder path. See `references/model-investigation.md` for detailed steps. |
| **model.bim file** | Use `AskUserQuestion` to get the file path. Then parse with `jq` or read directly. |
| **No model yet** | Skip model investigation; generate general-purpose rules based on organizational context only. |

**What to extract from the model** (read files, grep patterns, count objects):
- Table count, measure count, column count
- Storage mode (Import, DirectQuery, Direct Lake, mixed)
- Metadata completeness (descriptions, display folders, format strings)
- DAX patterns in use (CALCULATE, FILTER/ALL, calculation groups, UDFs)
- Relationship patterns (bi-directional, many-to-many, inactive)
- RLS roles defined
- Naming conventions currently in use
- Existing BPA annotations already embedded in model.tmdl

After model investigation, **summarize findings to the user** and use `AskUserQuestion` to confirm the analysis is accurate and ask if anything was missed.

### Diamond 2: Rule Generation (Phases 3-4)

#### Phase 3: Prioritize and Recommend

Based on everything gathered, present a prioritized recommendation of rule categories. Use `AskUserQuestion` to let the user confirm or adjust before generating any rules.

**Present categories ranked by relevance to the user's context.** For example:

If the model has many measures without descriptions and the user cares about governance:
1. Metadata (high priority -- many objects lack descriptions)
2. Governance (high priority -- user goal)
3. Performance (medium -- some unused hidden columns detected)
4. DAX Expressions (medium -- some FILTER/ALL patterns found)
5. Naming Conventions (low -- model already follows consistent naming)

Use `AskUserQuestion` to ask:
- Which categories to include (multiSelect)
- What severity level to assign to each category (or let the skill decide)
- Whether FixExpressions should be included (some teams prefer manual fixes)

**Do not generate rules until the user confirms the priorities.**

#### Phase 4: Generate Rules

Only after Phases 1-3, generate tailored BPA rules. For each rule:
- Explain why it is relevant to the user's specific model and context
- Include a FixExpression where safe and practical (if the user opted in)
- Set severity based on the user's stated priorities
- Use the organization's naming conventions in rule IDs and names

After generating rules, use `AskUserQuestion` to ask:
- Whether any rules should be adjusted, removed, or added
- Where to save the output (user-level, machine-level, model-embedded, or URL)
- Whether to validate with `scripts/validate_rules.py`

Iterate on the rule set until the user is satisfied. Continue calling `AskUserQuestion` for refinements.

### When to Skip Q&A

Skip the full Q&A workflow only when:
- The user asks for a specific, well-defined rule (e.g., "write a rule that checks for measures without descriptions")
- The user asks to improve or debug an existing expression
- The user asks to audit existing rules
- The user provides all context upfront in their request

Even in these cases, ask clarifying questions with `AskUserQuestion` if the request is ambiguous.

## Critical

- Always validate rule expressions before suggesting them
- Test expressions against the target scope (Measure, Column, Table, etc.)
- Ensure FixExpression does not cause data loss or break the model
- Consider CompatibilityLevel when using newer TOM properties

## Tabular Editor Compatibility

BPA rule files must follow specific formatting requirements for Tabular Editor to load them correctly. Files that don't follow these rules may show empty rule collections or fail to load entirely.

### Line Endings (CRLF Required)

Tabular Editor on Windows requires **Windows line endings (CRLF, `\r\n`)**. Files with Unix line endings (LF only) will fail to load or show empty rule collections.

To convert a file to CRLF:
```bash
# macOS/Linux
sed -i 's/$/\r/' rules.json

# Or use the validation script
python scripts/validate_rules.py --fix rules.json
```

### File Paths

When adding rule files in Tabular Editor:
- **Use absolute paths** (e.g., `C:\BPARules\my-rules.json`)
- **Avoid relative paths** with `..\..\..` - TE may fail to resolve these
- URLs work reliably (e.g., `https://raw.githubusercontent.com/...`)

### JSON Format Requirements

**No extra properties:** TE's JSON parser is strict. Only use allowed fields:
- `ID`, `Name`, `Category`, `Description`, `Severity`, `Scope`, `Expression`
- `FixExpression`, `CompatibilityLevel`, `Source`, `Remarks`

**Avoid these patterns:**
```json
// BAD: _comment fields not allowed
{ "_comment": "Section header", "ID": "RULE1", ... }

// BAD: Runtime fields (TE adds these, don't include them)
{ "ID": "RULE1", "ObjectCount": 0, "ErrorMessage": null, ... }

// GOOD: FixExpression can be null or omitted
{ "ID": "RULE1", "FixExpression": null, ... }
{ "ID": "RULE1", "Name": "...", "Severity": 2, "Scope": "Measure", "Expression": "..." }
```

**Note:** `FixExpression: null` is valid. `ErrorMessage` and `ObjectCount` are runtime fields that TE adds - do not include them in rule definitions.

### Regex Expression Syntax

When using `RegEx.IsMatch()` in expressions:

**No `@` prefix:** Do not use C# verbatim string prefix
```csharp
// BAD: @ prefix not supported
RegEx.IsMatch(Expression, @"FILTER\s*\(\s*ALL")

// GOOD: Standard escaping
RegEx.IsMatch(Expression, "FILTER\\s*\\(\\s*ALL")
```

**No RegexOptions parameter:** TE doesn't support the options parameter
```csharp
// BAD: RegexOptions not supported
RegEx.IsMatch(Name, "^DATE$", RegexOptions.IgnoreCase)

// GOOD: Use inline flag or pattern only
RegEx.IsMatch(Name, "(?i)^DATE$")
RegEx.IsMatch(Name, "^(DATE|date|Date)$")
```

### Correct Scope Names

Use the exact scope names from the TOM enum. Common mistakes:

| Wrong | Correct |
|-------|---------|
| `Role` | `ModelRole` |
| `Member` | `ModelRoleMember` |
| `Expression` | `NamedExpression` |
| `DataSource` | `ProviderDataSource` or `StructuredDataSource` |

**Note:** `Column` is valid as a backwards-compatible alias for `DataColumn, CalculatedColumn, CalculatedTableColumn`.

### Validation Script

Use the validation script to check and fix TE compatibility issues:

```bash
# Check for issues
python scripts/validate_rules.py rules.json

# Auto-fix issues (CRLF, remove nulls, remove _comment)
python scripts/validate_rules.py --fix rules.json
```

The script checks:
- Line endings (CRLF)
- No `_comment` fields
- No `null` values for optional fields
- Valid scope names
- Expression syntax warnings

## About BPA rules

- BPA rules define automatic tests for semantic models in Power BI and Fabric for QA/QC
- BPA rules are used by Tabular Editor 2, 3, CLI, or Fabric notebooks
- Rule expressions are defined in C# for Tabular Editor or Python for Fabric Notebooks
- BPA rules are better defined and used by Tabular Editor because they are actionable with ability to ignore or fix, and they are integrated with the IDE

## File Locations

BPA rules can exist in multiple locations (evaluated in order of priority):

| Location | Path / Source | Description |
|----------|---------------|-------------|
| **Built-in Best Practices** | Internal to TE3 | Default rules bundled with Tabular Editor 3 |
| **URL** | Any valid URL (e.g., `https://raw.githubusercontent.com/TabularEditor/BestPracticeRules/master/BPARules-standard.json`) | Remote rule collections loaded from web |
| **Rules within current model** | See below | Rules embedded in model metadata |
| **Rules for local user** | `%LocalAppData%\TabularEditor3\BPARules.json` | User-specific rules on Windows |
| **Rules on local machine** | `%ProgramData%\TabularEditor3\BPARules.json` | Machine-wide rules for all users |

For built-in rule IDs (27 rules in TE3), model-embedded rule formats, cross-platform file access, and all file location details, see **`references/te-compatibility.md`**.

## Quick Reference

For rule JSON structure, valid scope values, severity levels, compatibility levels, and category prefixes, see **`references/quick-reference.md`**.

For expression syntax (Dynamic LINQ, TOM properties, string/boolean/collection checks, Tokenize(), DependsOn, ReferencedBy), see **`references/expression-syntax.md`**.

## TMDL Annotations

BPA rules can be embedded in TMDL files via annotations:

```tmdl
annotation BestPracticeAnalyzer = [{ "ID": "...", ... }]
annotation BestPracticeAnalyzer_IgnoreRules = {"RuleIDs":["RULE1","RULE2"]}
annotation BestPracticeAnalyzer_ExternalRuleFiles = ["https://..."]
```

For complete annotation patterns, see `references/tmdl-annotations.md`.

## Workflow

### Recommended: Interactive Rule Generation

Follow the **Primary Workflow: Interactive Q&A Discovery** (above) for the best results. Use AskUserQuestion iteratively to gather context, investigate the model, then generate targeted rules.

### Creating a Single Rule (Direct)

When the user requests a specific rule without needing full discovery:

1. Identify the best practice to enforce
2. Determine the appropriate Scope
3. Write the Expression to detect violations
4. Optionally write a FixExpression for auto-remediation
5. Test against sample models
6. Add to rule collection

### Improving an Existing Rule

1. Understand the current rule's intent
2. Identify false positives or missed cases
3. Refine the Expression logic
4. Verify FixExpression doesn't cause side effects
5. Test thoroughly

## Additional Resources

### Reference Files

For detailed syntax and patterns, consult:

- **`references/model-investigation.md`** - Investigating models via Fabric CLI or local .bim/.tmdl files; guiding users to save as PBIP; model analysis checklist
- **`references/te-compatibility.md`** - Tabular Editor compatibility (CRLF, file paths, JSON format, regex, scope names, validation, built-in rules, file locations, cross-platform access)
- **`references/quick-reference.md`** - Rule JSON structure, valid scopes, severity levels, compatibility levels, category prefixes, expression syntax overview
- **`schema/bparules-schema.json`** - JSON Schema for validating BPA rule files (Draft-07) *(temporary location)*
- **`references/rule-schema.md`** - Human-readable BPA rule field descriptions
- **`references/expression-syntax.md`** - Dynamic LINQ expression syntax, TOM properties, Tokenize(), DependsOn, ReferencedBy
- **`references/tmdl-annotations.md`** - BPA annotations in TMDL format

### Example Files

Working examples in `examples/`:

- **`examples/comprehensive-rules.json`** - 30+ production-ready rules across all categories
- **`examples/model-with-bpa-annotations.tmdl`** - TMDL file showing all annotation patterns

### Scripts

Utility scripts:

- **`/scripts/bpa_rules_audit.py`** - Comprehensive BPA rules audit across all sources (built-in, URL, model, user, machine). Supports Windows, WSL, and macOS with Parallels. Outputs ASCII report and JSON export.
- **`scripts/validate_rules.py`** - Validate BPA rule JSON files for schema compliance

**Audit Script Usage:**
```bash
# Basic audit
python scripts/bpa_rules_audit.py /path/to/model

# Export to JSON
python scripts/bpa_rules_audit.py /path/to/model --json output.json

# Quiet mode (summary only)
python scripts/bpa_rules_audit.py /path/to/model --quiet
```

### Related Commands

- **`/suggest-rule`** - Generate BPA rules from descriptions

### Related Agents

- **`bpa-expression-helper`** - Debug and improve BPA expressions

### Fetching Docs

To retrieve current BPA and TOM reference docs, use `microsoft_docs_search` + `microsoft_docs_fetch` (MCP) if available, otherwise `mslearn search` + `mslearn fetch` (CLI). Search based on the user's request and run multiple searches as needed to ensure sufficient context before proceeding.

### External References

- [Tabular Editor BPA Getting Started](https://docs.tabulareditor.com/getting-started/bpa.html)
- [Tabular Editor BPA View](https://docs.tabulareditor.com/features/views/bpa-view.html)
- [BPA Sample Rule Expressions](https://docs.tabulareditor.com/features/using-bpa-sample-rules-expressions.html)
- [TabularEditor BPA Source Code](https://github.com/TabularEditor/TabularEditor/tree/master/TabularEditor/BestPracticeAnalyzer)
- [BPA Rules Repository](https://github.com/TabularEditor/BestPracticeRules)
- [TabularEditor Docs Repository](https://github.com/TabularEditor/TabularEditorDocs)
- [Power BI Semantic Model Checklist](https://data-goblins.com/dataset-checklist)

## Example Rules

### Measure Without Description

```json
{
  "ID": "META_MEASURE_NO_DESCRIPTION",
  "Name": "Measure has no description",
  "Category": "Metadata",
  "Description": "All measures should have descriptions for documentation.",
  "Severity": 2,
  "Scope": "Measure",
  "Expression": "string.IsNullOrWhitespace(Description)"
}
```

### Hidden Unused Column

```json
{
  "ID": "PERF_UNUSED_HIDDEN_COLUMN",
  "Name": "Remove hidden columns not used",
  "Category": "Performance",
  "Description": "Hidden columns with no references waste memory.",
  "Severity": 3,
  "Scope": "Column",
  "Expression": "IsHidden and ReferencedBy.Count = 0 and not UsedInRelationships.Any()",
  "FixExpression": "Delete()"
}
```
