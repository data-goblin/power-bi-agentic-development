---
name: organize-semantic-model
description: Tidy a semantic model end to end for report authors, Excel and Copilot with Tabular Editor 3 MCP or the `te` CLI, applying the house conventions (names, display folders, descriptions, hiding and Analyze in Excel, sort-by, DAX formatting prefixes, calculated-object justification, UDF extraction). Use for "organize", "clean up", "standardize" or "prepare" a model. Reports per pass what changed or was skipped.
---

# Organize a semantic model

[Workflow] Run every pass unless the user narrows scope, and report per pass: changed, already right, skipped and why. Doing two passes leaves a model looking finished with raw names and no descriptions.

## Rules

- Inventory and lineage first (pass 0): tables, columns, measures, functions, folders, cultures, perspectives, roles; then `lineage-analysis` for bound reports and composite models. Renames, deletions and the Excel pass depend on it
- Show the old-to-new rename map and get a go-ahead before renaming anything in a model with bound reports; rebind with `pbir fields replace` (local PBIR) or `fabric-cli`. Never edit report JSON by hand
- Use a Tabular Editor 3 MCP server if one is connected, otherwise `te` (one command per change, `--save`); read the diff after each pass. Annotation changes are not in the diff: read them back
- Object references follow the rule in the `semantic-model` skill; check with `te bpa run -r ../semantic-model/rules/model-rules.json`

## Passes

1. Table groups and display folders: groups via the `TabularEditor_TableGroup` annotation (visible only in Tabular Editor, so no `DIM_`/`FACT_` prefixes). 3 to 5 top-level folders per table, nest with `/`, number prefixes for order. Keep a larger structure that predates the session
2. Names: Title Case business names, one term per concept; decisions in [references/naming-rules.md](references/naming-rules.md). Ask for the business vocabulary before renaming. A calculated table column binds through `SourceColumn`: keep it in step with the expression
3. Hierarchies and sort order: add natural drill paths; every text column with a non-alphabetical order gets a `SortByColumn` whose key is one-to-one with the value, or refresh fails
4. Hiding: keys, sort keys, technical columns, numeric columns meant to be aggregated through a measure (the measure must exist). Not columns a hierarchy or visible slicer needs
5. Analyze in Excel: `IsAvailableInMDX=false` removes the attribute hierarchy and the column from MDX clients. Candidates come from the built-in BPA rule `TE3_BUILT_IN_SET_ISAVAILABLEINMDX_FALSE` (`te bpa run --rule TE3_BUILT_IN_SET_ISAVAILABLEINMDX_FALSE`). Excel use is not a bound report: check connected workbooks in the lineage result and tell the user which columns an Excel user would lose before disabling any
6. Descriptions: only what the name does not say (grain, unit, exclusions, example value, spelled-out acronym), about 80% ASD-STE100 Simplified Technical English, facts as `- ` bullets, no `e.g.`. Never restate type, format, table or source column. Copilot reads the first 200 characters
7. Formats and categories: format strings for every visible measure and numeric column (`MM` is month, `mm` minutes); `DataCategory` for geography, `WebUrl`, `ImageUrl`; date table `Time` with `IsKey` on the date column
8. `context` annotation on objects whose purpose the name and metadata do not reveal (role-playing keys, helper tables, RLS-only columns, kept-for-a-dependency): one short sentence
9. Calculated tables and columns: each justifies itself in its `context` annotation (why it is calculated, why it cannot come from the source), or recommend moving it upstream
10. DAX code: `te set <obj> --format Expression --save` (or `te script --inline 'Model.AllMeasures.FormatDax();' --save`); prefix variables `_` (`VAR _StartDate`) and temporary columns `@` (`"@BusinessDate"`, referenced `[@BusinessDate]`); comment only atypical logic with one `//` line
11. UDFs: propose a function where logic repeats across measures, show the measures it replaces, verify equal results before and after. Naming, parameter documentation and limits (cannot be hidden or put in folders): [udf-authoring wiki](../../wiki/udf-authoring.md). Check compatibility level 1702 first; raising it is one-way, ask
12. Duplicates: delete only with no model dependency (`te deps <obj> --downstream`), no RLS or perspective use, and no consumer in the lineage. List deletions first
13. Perspectives, translations, roles: new objects are excluded from existing perspectives by default; every culture covers every visible object or the user sees mixed languages; do not create or loosen security unasked

## Finish

`te bpa run`, a small `te query` per changed table, then the per-pass report with every rename and deletion and its downstream impact.
