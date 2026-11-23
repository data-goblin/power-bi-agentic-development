---
title: A te test suite that reconciles measures to fact rows, and a failing suite that proves the gate
summary: A four-test te test suite that reconciles measures to fact rows, a deliberately failing suite, and their recorded output
kind: recipe
status: current
sources:
  - url: https://docs.tabulareditor.com/en/cli/
tools:
  te: 0.8.1.1
last_updated: 2026-11-23
last_verified: 2026-11-23
review_cadence_days: 90
verified_by:
  - te test list --suite plugins/tabular-editor/wiki/examples/dax-tests/suite
  - te test list --suite plugins/tabular-editor/wiki/examples/dax-tests/failing-suite
skills: [tabular-editor/te-cli]
---

# A te test suite that reconciles measures to fact rows

Format and flags are in the te-cli skill (`references/testing.md`, `te test spec`). This page shows one working suite and how a team proves its gate can fail.

```dirtree
examples/dax-tests/
  suite/invoices.test.yaml            4 tests, all pass
  failing-suite/failure.test.yaml     1 test that must fail
```

The names (`Invoices`, `Products`, `[Invoice Lines]`, `[Turnover (Quantity)]`) come from the SpaceParts demo model; replace them with your own. `te test list` parses both suites without a connection and is the offline check. `te test run` needs a deployed model, so the runs below were captured against a service model with te 0.8.1.1 on 2026-11-23 and are not part of `verified_by`.

## The suite

[invoices.test.yaml](examples/dax-tests/suite/invoices.test.yaml) asserts, in order:

```yaml
presence:       [Invoice Lines] > 0                                   gt on a ROW() column
row count:      [Invoice Lines] - COUNTROWS(Invoices) = 0             exact value 0
tolerance:      [Turnover (Quantity)] - SUM(fact column), tolerance_abs: 0.000001
per group:      SUMMARIZECOLUMNS by Products[Type], FILTER to rows that differ; expect empty: true
```

Reconcile by subtraction and expect 0, so the expected value never goes stale when the data refreshes. The last test is the filter-context check: the measure must agree with the fact table inside every product type, and the query returns only the offending groups, so `empty: true` is the pass condition and a failure lists nothing to read but the test name.

```text
  PASS  Invoice data is present                   18,459,441
  PASS  Invoice lines reconcile to fact rows      0
  PASS  Turnover quantity reconciles to fact quantity  0
  PASS  Measures reconcile within every product type

  4 passed (4 total) in 8.7s
```

Exit code 0.

## The deliberate failure

[failure.test.yaml](examples/dax-tests/failing-suite/failure.test.yaml) expects `[Invoice Lines]` to be below 0. Expected output:

```text
  FAIL  Invoice lines cannot be negative          Expected < 0, got 18459441

  1 failed (1 total) in 8.2s
```

Exit code 1. With `--output-format json` the finding is `{"severity":"error","source":"test","code":"TEST_FAIL","object":"Invoice lines cannot be negative"}` and `testSummary` reads `passed 0, failed 1, errored 0, skipped 0, invalidSuites 0`.

Run this suite in CI after the real one and assert exactly that shape: exit code 1, `failed` equal to 1, and `errored`, `skipped` and `invalidSuites` all 0. A query typo or a lost connection gives `errored` or `invalidSuites` instead of `failed`, so the check tells a working gate apart from a broken one. Keep the failing suite in its own directory so `te test run --suite suite` never picks it up.
