---
name: semantic-model
description: Build, change, review or audit a Power BI / Analysis Services semantic model from the terminal with the `te` CLI, and diagnose model behaviour. Use for measures, relationships, roles and RLS, calculation groups (including errors after adding one, such as format strings, text measures and the variant type), incremental refresh, storage mode and Direct Lake settings and framing, AI/Copilot metadata, and for model reviews (BPA, unused columns, VertiPaq size, fail-open RLS). Owns the object-reference convention for DAX. Not for report visuals (pbir-cli), query tuning (dax), or TMDL syntax (tmdl).
---

# Semantic models with te

## Rules

- Object references in every expression and metadata text: `'Table'[Column]` (table always present, always single-quoted) and `[Measure]` (never table-prefixed). This is the only copy of the rule: `dax`, `organize-semantic-model` and `connect-pbid` link here. Check it with `te bpa run -r rules/model-rules.json`
- Read before you write: `te get <path> --properties` lists every settable property of the real object. `te` can set far more than older notes claim: relationship `CrossFilteringBehavior` and `SecurityFilteringBehavior`, column `AlternateOf`, KPI, calendars, calculation group precedence and selection expressions, model `DirectLakeBehavior` and `SelectionExpressionBehavior`, incremental refresh policies. Use `te script` only when `--properties` shows no way
- Every mutation is a dry run until `--save`. Each Bash call is a fresh shell, so pass `--model <path>` (or `-s`/`-d`) every time. Properties are `-p Name=Value`; `-p Name=null` or `--unset Name` clears one
- Remote writes need the user's approval: `te refresh`, `te deploy` and `te test run` against a service model only act with `--execute` or a live connection. Dry run first and show the TMSL
- After every change batch: `te validate --errors-only`, then the BPA gate below. Add relationships before measures that use `RELATED()` or cross-table `CALCULATE()`, or save fails with `DAX0002`
- Renaming or moving an object can break reports and other models: run `lineage-analysis` first, then propagate with `pbir-cli`

## Routing

1. `te` (this file). 2. `te script` for C# against TOM (`c-sharp-scripting` skill). 3. `connect-pbid` for traces and live Desktop work (Windows). 4. TMDL files with the `tmdl` skill, last, then `te validate`. Service-only operations (role members, report binding, Copilot item files) go through `fabric-cli`

## Commands that older notes got wrong

```bash
te get --ls relationships --output-format json     # names, cardinality, objectPath (Relationships/<guid>)
te add "Orders[Customer Key]->Customers[Customer Key]" --save   # relationship: no -t
te set "Relationships/<guid>" -p CrossFilteringBehavior=BothDirections --save
te add "Variants" -t CalcGroup --save ; te add "Variants/Plain" -t CalcItem -p Expression='SELECTEDMEASURE ()' --save
te add Region -t Role --save                        # types: Table CalcGroup CalcItem Measure KPI Calendar Function Role TablePermission Member ...
te add Orders -t Table --mode directlake --source-table dbo.Orders --save
te set Orders/RefreshPolicy -p RollingWindowPeriods=5 -p RollingWindowGranularity=Year -p IncrementalPeriods=10 -p IncrementalGranularity=Day --save
te set Orders -p RefreshPolicy=null --save           # remove the policy
te set . -p DirectLakeBehavior=DirectLakeOnly --save
te refresh --type automatic --execute               # Direct Lake framing; without --execute only the TMSL prints
te refresh --apply-refresh-policy Orders --execute   # --partition cannot be combined with --table
te script manage-ai-metadata.csx --save              # files are positional or --file; there is no -S
te test run --ci github                              # the failure threshold flag belongs to `te bpa run`
```

`te ls relationships` lists relationships. There is no load command, no incremental-refresh command and no query flag on `te set`.

## Review

```bash
te validate --errors-only --model <model>
te bpa run --model <model> -r rules/model-rules.json --fail-on error
te deps --unused --hidden --model <model>
te vertipaq --columns --detail --top 25
te test snapshot --output-file before.json   # then --diff before.json after a change
```

- `rules/model-rules.json` adds house rules to the 32 built-in BPA rules: unquoted table in a column reference, table-prefixed measure reference, fail-open RLS (a filter branch ending in `TRUE()`), visible measures without description or display folder. Built-ins already cover missing format strings, auto date tables, hidden foreign keys and IsAvailableInMdx
- Read order for findings: fail-open RLS and limited relationships that drop rows, then memory (high-cardinality columns, unsplit DateTime, auto date/time), then DAX correctness, then documentation. Report file locations, not essays

## Gotchas models get wrong

- Adding any calculation group makes every measure variant: dynamic format strings that reuse a measure and arithmetic items on text measures fail. See [wiki/calculation-groups.md](../../wiki/calculation-groups.md)
- RLS written as `IF(cond, filter, TRUE())` fails open. Return `FALSE()` or a mapping-table lookup for the fallback. Bidirectional security filtering on the one side needs `SecurityFilteringBehavior`. Perspectives and display folders are not security
- Direct Lake: one-side relationship keys must be unique or queries fail at runtime; Direct Lake on OneLake has no DirectQuery fallback; a table made over XMLA stays unprocessed until a refresh frames it. See [wiki/direct-lake.md](../../wiki/direct-lake.md)
- Incremental refresh needs `RangeStart`/`RangeEnd` DateTime parameters, a half-open filter that folds, and the policy on the table. See [wiki/incremental-refresh.md](../../wiki/incremental-refresh.md)
- Calculation items do not apply to implicit measures; Desktop forces `DiscourageImplicitMeasures` on when the first group is added, so set it (`te set . -p DiscourageImplicitMeasures=true`) when adding groups with `te`
- Storage mode is `--mode` on `te add -t Table`, or a partition-level property on an existing table
- Copilot reads only the first 200 characters of a description. Prep data for AI, AI data schema, verified answers and AI instructions are separate features; hiding a field does not remove it from Copilot. See [wiki/copilot-ai-metadata.md](../../wiki/copilot-ai-metadata.md)
- Hybrid (real-time) tables force related dimensions to Dual and need automatic page refresh in reports to show the live partition
- Aggregations: map `AlternateOf` with `te set` on the aggregation column (`te get <column> --properties` shows it read/write) and hide the aggregation table
- Time intelligence: calendar-based is preview and authored only in Desktop or TMDL; a date table needs "mark as date table" for classic functions
