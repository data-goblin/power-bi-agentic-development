---
name: tmdl
description: Rules and gotchas for hand-editing .tmdl files in a PBIP semantic model, and for converting BIM to TMDL. Use when asked to edit TMDL, add a measure, column, relationship or description in a .tmdl file, fix a TMDL parse error, write a DAX user-defined function in functions.tmdl, or convert model.bim to TMDL. Prefer te for edits; validate with te validate.
---

# TMDL hand-editing

Learn is the grammar reference: [TMDL overview](https://learn.microsoft.com/en-us/analysis-services/tmdl/tmdl-overview). This skill holds what Learn leaves out and what the parser enforces.

## Rules

- Validate every edit with `te validate --model <definition folder> --errors-only --non-interactive`. It runs Microsoft's TOM TmdlSerializer on the whole folder plus a DAX analyzer, in under a second, and exits 1 on any error. The pbip plugin runs it as a hook after each `.tmdl` edit when `te` is installed
- `//` is NOT a comment in TMDL. A `//` line between objects or properties is a parse error ("Unexpected line type" or "Invalid indentation"). `//` is legal only inside a DAX or M expression body. For a note on an object, use a `///` description
- `///` lines sit directly above the object, with no blank line between the description and the declaration. Several `///` lines join into one description. Only objects that have a Description property accept it; `///` above a `relationship` is a parse error
- One tab per level. Object at depth 1 (inside a table), its properties at depth 2, multi-line expression body at depth 3. Spaces also parse, but do not mix them in one file
- Quote a name in single quotes only when it contains a dot, equals sign, colon, single quote or whitespace; double a single quote inside it. Names that start with a digit or contain `$`, `(`, `-` need no quotes. Names in references (`sortByColumn`, `fromColumn`, `perspectiveMeasure`) follow the same rule
- Expressions go after `=`. A multi-line expression starts on the next line, one level deeper than the properties. Wrap it in three backticks when it has blank lines or trailing spaces that must survive a round trip
- Boolean properties can be bare (`isHidden`) or `isHidden: false`. Property order does not matter, and neither does the order of children in a table
- `ref table X` in `model.tmdl` fixes collection order; a ref without a file is ignored, a file without a ref is appended. Add the `ref` when you add a table, role, perspective or culture file
- One file per table under `tables/`, one per role, perspective and culture; `relationships.tmdl`, `expressions.tmdl`, `functions.tmdl`, `model.tmdl`, `database.tmdl` at the root. Measures can live in any file (partial declaration), but never declare the same member twice
- `te validate` is per folder: references between files (relationships, `sortByColumn`, perspectives, roles) resolve only when the whole folder loads, so a half-finished refactor reports reference errors until the last file is written

## Decide

```yaml
change a property, rename, move, add a measure: te (te set, te mv, te add) over hand-editing, see the te-cli skill
many text edits to one file: hand-edit, then te validate
rename that touches report visuals: te mv then pbir fields replace (pbip skill, rename cascade)
BIM to TMDL: te save-as, see wiki/bim-to-tmdl.md
new model from scratch: te init
```

## Formats worth knowing

- Compatibility level: `database.tmdl` carries `compatibilityLevel`. 1702 is the minimum for DAX user-defined functions; `te init` defaults to 1706 for Power BI models. Raising it is one-way
- `definition.pbism` version 4.0 or higher allows TMDL; version 1.0 means TMSL (`model.bim`) only ([projects-dataset](https://learn.microsoft.com/en-us/power-bi/developer/projects/projects-dataset)).
- Partition `sourceType` values: Query, Calculated, None, M, Entity, PolicyRange, CalculationGroup, Inferred, Parquet. `te get <path> --properties` lists every property and enum value of any object, which beats a property table
- Editing objects that Power BI synced from a composite or Direct Lake source requires `changedProperty` entries and the `PBI_RemovedChildren` annotation (Learn, projects-dataset)
- DAX user-defined functions: types are `AnyVal`, `Scalar`, `Table`, `AnyRef`, `CalendarRef`, `ColumnRef`, `MeasureRef`, `TableRef`; `val` or `expr` is the passing mode, not a type. Details: [wiki/tmdl-user-defined-functions.md](../../wiki/tmdl-user-defined-functions.md)

## Wiki

- [Gotchas with te validate evidence](../../wiki/tmdl-hand-editing-gotchas.md)
- [A tiny valid model, line by line](../../wiki/tmdl-worked-example.md)
- [User-defined functions in functions.tmdl](../../wiki/tmdl-user-defined-functions.md)
- [BIM to TMDL](../../wiki/bim-to-tmdl.md)
