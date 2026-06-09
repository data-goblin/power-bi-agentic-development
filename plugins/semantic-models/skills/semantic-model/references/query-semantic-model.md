# Querying a semantic model

Companion to the `semantic-model` skill (SKILL.md). How to read data and metadata out of a model from the terminal with DAX, for validation, review, and probing. For query *performance* tuning, use the `dax` skill.

**Working with `te`:** `te query -q "EVALUATE SUMMARIZECOLUMNS(...)"` (inline) or `te query -f query.dax` (from a file); add `--output-format json` for parseable results and `--output-file out.csv` to save. Target a local file with `-m ./model`, a remote model with `-s <workspace> -d <model>`.

## Inline vs file

Short probes go inline with `-q`; multi-line or reused queries go in a `.dax` file with `-f`. A file avoids shell-escaping the double quotes DAX uses for strings and column aliases, which is the main inline foot-gun. Always wrap a table expression in `EVALUATE`; wrap a scalar in `EVALUATE ROW("x", <scalar>)`.

## Output formats

`--output-format json` is the default to use when driving `te` programmatically (the text/table output mangles in transcripts). `csv`/`tsv` for tabular results, `--output-file <path>` to write to disk (format inferred from the extension). Errors and warnings go to stderr in JSON mode, so they never contaminate the parseable stdout.

## Metadata via INFO functions

The model's own schema is queryable as data, which is how you inspect a model that `te ls` cannot fully enumerate:

- `EVALUATE INFO.VIEW.RELATIONSHIPS()` ; relationships with friendly from/to, cardinality, cross-filter, active flag (`te ls` cannot list relationships)
- `EVALUATE INFO.VIEW.MEASURES()` / `INFO.MEASURES()` ; measures, expressions, format strings, display folders
- `EVALUATE INFO.VIEW.COLUMNS()` / `INFO.TABLES()` ; columns and tables with data types and properties
- `EVALUATE INFO.STORAGETABLECOLUMNS()` / `INFO.DICTIONARYSTORAGES()` ; live cardinality and dictionary sizes when a VPAX export is not available

## Probing patterns

- Test a measure in isolation: `EVALUATE ROW("Result", [Total Revenue])`
- Visual-shaped query (what a report sends): `EVALUATE SUMMARIZECOLUMNS('Date'[Year], "Revenue", [Total Revenue])`
- Check column values / cardinality: `EVALUATE TOPN(20, VALUES('Geography'[Region]))`, `EVALUATE ROW("n", DISTINCTCOUNT('Sales'[CustomerKey]))`
- Emulate an RLS filter offline: `EVALUATE CALCULATETABLE(<query>, TREATAS({"alice@contoso.com"}, 'UserMap'[UserEmail]))` (proves the predicate; does not exercise the security context, see `security.md`)

## Performance-aware querying

For timing, `te query ... --trace --cold --runs 10` and compare medians, not means; discard the first cold run as warm-up. `--cold` clears the cache for a true cold measurement. Single runs are noise. Formula-engine vs storage-engine split needs a trace via `connect-pbid` or DAX Studio; `te query` returns the result, not the timings breakdown.

## Pitfalls

- Each Claude Bash call is a fresh shell, so a `te connect` from a prior call is gone; pass `-m` (and `-s`/`-d`) on every `te query`, or set `TE_SESSION`.
- `pbir model -q` (in the reports plugin) runs `EVALUATE` DAX only; `INFO.*` and DMV queries return 400 there. Use `te query` against the model endpoint for metadata.
- DMV-style `SELECT * FROM $SYSTEM.TMSCHEMA_*` works through ADOMD against a live local instance (`connect-pbid`), not through `te query`'s DAX path.
