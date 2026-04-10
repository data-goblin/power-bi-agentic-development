# Testing semantic models with `te test`

Companion to the te-cli skill (SKILL.md). CI wiring (pipelines, TRX publishing, promotion gates) is in config-cicd-env.md.

`te test` runs DAX assertion tests, so every executing subcommand (`run`, `snapshot`, `compare`) needs a **deployed model** (`-s`/`-d` or an active connection); a local `-m` path cannot execute DAX. The suite files themselves live in the repo next to the model source, which is the point: a PR that changes a measure carries its test change in the same diff.

`te test spec` prints the authoritative format reference from the binary; `te test init --example` scaffolds a richly commented suite showing every assertion type. What follows is the working knowledge.

## Suite anatomy

A suite is a directory (default `.te-tests/`) of `*.test.yaml` files, discovered recursively. `te test init` also drops a `schema.json` so editors validate the YAML (`# yaml-language-server: $schema=schema.json`).

```yaml
suite: Revenue regression
description: Guards the core revenue measures
connection:            # optional; otherwise -s/-d at run time wins
  server: MyWorkspace
  database: Sales Model
  auth: env
defaults:
  tolerance: 0.01      # 1% relative, applied to every test unless overridden
  tags: [revenue]
tests:
  - name: FY25 revenue matches finance sign-off
    query: |
      EVALUATE ROW("Revenue", CALCULATE([Total Revenue], 'Date'[FY] = "FY25"))
    expect:
      Revenue:
        value: 12500000
        tolerance: 0.001
  - name: No orphan sales rows
    query: EVALUATE ROW("Orphans", COUNTROWS(FILTER(Sales, ISBLANK(RELATED(Product[ProductKey])))))
    tags: [integrity]
    expect:
      Orphans: 0
```

Test-case fields: `name`, `query` (inline DAX, multiline with `|`) or `query_file` (path to a `.dax` file relative to the suite dir), `tags` (filter with `te test run --tag <tag>`), `tolerance` / `tolerance_abs` overrides, `matrix` (parameterized expansion; `{var}` placeholders in the query and expectations), `expect` (at least one assertion), and `compare` (multi-row diff settings used by `te test compare`).

## Assertion types

```yaml
expect:
  Revenue: 100                      # exact (numbers use tolerance if set)
  Margin: { gt: 0 }                 # gt / gte / lt / lte
  Ratio: { gte: 0.1, lte: 0.9 }     # range
  rows: 5                           # exact row count
  rows: { gte: 1, lte: 100 }        # row-count range
  empty: false                      # >= 1 row (true = must be 0 rows)
  columns: [Region, Revenue]        # result has these columns
  error: true                       # the query itself is expected to fail
```

A `ROW("A", ..., "B", ...)` query asserts multiple columns in one test. Relative `tolerance` is a fraction (0.01 = 1%); `tolerance_abs` is a raw value; when both are set, passing either satisfies the assertion. Strings and dates always match exactly.

Assertions worth writing first, in rough order of value:

- **Reconciliation**: one measure per business-critical number, asserted against an externally agreed value with a tight tolerance
- **Invariants**: `empty: true` on "rows that should never exist" queries (orphan keys, negative quantities, duplicate dimension keys, date-table gaps)
- **Shape guards**: `rows:`/`columns:` on queries a report page depends on
- **Not-blank smoke**: `empty: false` on each fact table and headline measure; the cheapest possible post-deploy signal

## Generating and running

```bash
te test init --example                      # commented reference suite
te test init --from-model --model ./model   # one stub per model measure; keep the ones worth asserting
te test list --suite .te-tests              # parse check without a connection
te test run -s ws -d model --auth env --non-interactive --ci github --trx test.trx
te test run --tag integrity                 # subset by tag
te test use ./suites/revenue                # session-scoped active suite (interactive work)
```

`--fail-on error` (default) exits 1 on failures, which is what makes `te test run` a pipeline gate.

## Snapshot regression (refactor guard)

Snapshots capture every measure's value (auto-generated `ROW()` queries, or the suite's queries with `--suite`) so a refactor can prove it changed nothing:

```bash
te test snapshot --save baseline.snapshot.json -s ws -d model
# ...refactor measures, redeploy...
te test snapshot --diff baseline.snapshot.json --tolerance 0.001 -s ws -d model
```

Scope with `--measures "Revenue*"` or `--table Sales`. Snapshots compare a model against its own past; data refreshes between capture and diff will show up as drift, so snapshot workflows fit refactors on a stable dataset, not moving data.

## A/B compare (pre-cutover gate)

`te test compare` runs the same suite against two deployed models and diffs the results; use it before promoting a candidate over prod:

```bash
te test compare --source-a prod-ws/prod-model --source-b test-ws/candidate-model --suite .te-tests --tolerance 0.001
```

`--auth-a`/`--auth-b` allow different credentials per side (e.g. prod read via one SPN, test via another).
