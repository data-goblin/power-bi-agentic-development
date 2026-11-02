# DAX test patterns and measure contracts

Companion to `testing.md`, which covers the `.test.yaml` format and the `te test` commands. This file covers what to test. Every pattern here passed `te test run` against a deployed Power BI model (te 0.8.1, November 2026). Replace the table, column and measure names with the ones in your model.

## Contents

- Measure contracts
- Contract patterns
- Integrity and schema patterns
- Considerations
- Suite layout and CI
- Sources

## Measure contracts

A measure contract is a set of properties that must stay true for every filter context, independent of the data. The term is not an established standard; it is the most useful way to decide what to test. Contracts survive data refreshes, so they run on every deploy. Exact values do not survive a refresh, so use them only for reconciliation against a figure finance has signed off.

For each important measure, write down:

- Additivity: is the total the sum of its parts on each dimension? (No for distinct counts, ratios and semi-additive balances)
- Time shift: does the prior-year measure for year N equal the base measure for year N-1?
- Blank behavior: is the result BLANK, not 0, where there is no data? A 0 makes empty rows show in visuals
- Safe division: does a ratio return BLANK, not an error, when the denominator is blank or 0?
- Sign and bounds: can the value be negative? Must a percentage stay between 0 and 1?
- Never errors: does the measure evaluate for every member of every dimension a report slices by?

Each answer becomes one test. Tag them `contract`.

Read each measure with `te get "Table/Measure" -p Expression` before you write its contract. In a test run that skipped this step, 8 of 42 generated tests failed although the measures were correct:

- A currency measure that multiplies by `MAX('Exchange Rate'[Rate])` is not additive across dates. The total uses one rate, and each year uses its own rate. Test its additivity only on dimensions that do not change the rate, such as product or customer
- A YTD measure that stops at a cutoff date (the last date with data, or today's day of the year in prior years) does not equal the full-year total. It is also not BLANK for a future year. Assert bounds instead: YTD is not more than the full year, and the cutoff date is in the selected year. Do not copy the measure's own formula into the test; that test passes by definition
- A prior-year measure without a future-period guard returns last year's value for a year with no data. Assert BLANK only when the expression has a guard

Run the new suite once and look at each failure. Decide whether the measure or the test assumption is wrong before you change anything.

## Contract patterns

Use an absolute tolerance for differences that must be 0. A relative `tolerance` divides by the expected value, so it cannot pass when the expected value is 0. Floating-point sums differ by about 0.0001 on a large model, so an exact 0 fails.

```yaml
suite: Revenue contracts
defaults:
  tags: [contract]
tests:
  - name: Revenue is additive across product categories
    query: |
      EVALUATE ROW(
        "Diff", [Revenue] - SUMX(VALUES(Product[Category]), [Revenue])
      )
    tolerance_abs: 0.01
    expect:
      Diff: 0

  - name: Revenue PY equals prior year Revenue
    query: |
      EVALUATE ROW(
        "Diff",
          CALCULATE([Revenue PY], 'Date'[Year] = 2021)
          - CALCULATE([Revenue], 'Date'[Year] = 2020)
      )
    tolerance_abs: 0.01
    expect:
      Diff: 0

  - name: Revenue is BLANK for a year without sales
    query: |
      EVALUATE ROW("IsBlank", ISBLANK(CALCULATE([Revenue], 'Date'[Year] = 2030)))
    expect:
      IsBlank: true

  - name: Margin percent does not error when Revenue is blank
    query: |
      EVALUATE ROW("M", CALCULATE([Margin %], 'Date'[Year] = 2030))
    expect:
      rows: 1

  - name: Revenue is never negative by {dim}
    matrix:
      dim: ["Product[Category]", "Customer[Segment]", "'Date'[Year]"]
    query: |
      EVALUATE FILTER(SUMMARIZECOLUMNS({dim}, "R", [Revenue]), [R] < 0)
    expect:
      empty: true

  - name: Revenue YTD stays within the year in {y}
    matrix:
      y: [2019, 2021]
    query: |
      EVALUATE
      CALCULATETABLE(
        ROW(
          "Excess", COALESCE([Revenue YTD], 0) - COALESCE([Revenue], 0),
          "CutoffYear", YEAR([Revenue Cutoff Date])
        ),
        'Date'[Year] = {y}
      )
    expect:
      Excess: { lte: 0 }
      CutoffYear: {y}

  - name: FY2021 Revenue matches the signed-off figure
    tags: [contract, reconciliation]
    query: |
      EVALUATE ROW("Revenue", CALCULATE([Revenue], 'Date'[Year] = 2021))
    tolerance: 0.0001
    expect:
      Revenue: 45413788565.40
```

The `matrix` test expands to one test per dimension, and each result line names the dimension. A query that errors fails the test, so the same test also proves that the measure evaluates on each dimension.

Reconcile a measure against a signed-off figure, not against a `SUM` of the source column. In the verification model, `[Turnover]` divides by a budget rate and multiplies by an exchange rate. A plain `SUM` of the source columns was off by 143 billion. The test was wrong, not the measure. Read the measure first: `te get "Sales/Revenue" -p Expression -s ws -d model`.

## Integrity and schema patterns

```yaml
suite: Model integrity
defaults:
  tags: [integrity]
tests:
  - name: No sales rows without a customer
    query: |
      EVALUATE ROW(
        "Orphans", COALESCE(CALCULATE(COUNTROWS(Sales), ISBLANK(Customer[CustomerKey])), 0)
      )
    expect:
      Orphans: 0

  - name: Customer key is unique
    query: |
      EVALUATE ROW("Dupes", COUNTROWS(Customer) - DISTINCTCOUNT(Customer[CustomerKey]))
    expect:
      Dupes: 0

  - name: Report-facing Product columns keep name and type
    tags: [schema]
    query: |
      EVALUATE
      FILTER(
        SELECTCOLUMNS(INFO.VIEW.COLUMNS(), "Table", [Table], "Column", [Name], "Type", [DataType]),
        [Table] = "Product" && [Column] IN { "Product Name", "Category", "Subcategory" } && [Type] = "Text"
      )
    expect:
      rows: 3
```

- Orphan keys: rows with a key that has no match in the dimension go to the dimension's blank row. Filter on `ISBLANK` of the dimension key to count them
- Wrap `COUNTROWS` in `COALESCE(..., 0)`. With no matching rows, `COUNTROWS` returns BLANK, and a BLANK fails every comparison assertion with `Cannot compare non-numeric value ''`
- Schema contracts: a renamed or retyped column breaks every report visual that uses it. `INFO.VIEW.COLUMNS()`, `INFO.VIEW.MEASURES()` and `INFO.VIEW.RELATIONSHIPS()` work in a `te test` query. Assert the exact row count of the columns that reports depend on. `INFO.VIEW.COLUMNS()` returns `DataType` as `Text`, `Integer`, `Number`, `Currency`, `Date` or `True/False`, not the Power BI Desktop names such as "Whole Number". The other `INFO.*` functions need admin permission on the model
- For source drift (columns dropped or retyped in the data source), use `te schemacheck`, not a DAX test

## Considerations

- `defaults:` accepts only `tolerance` and `tags`. A `tolerance_abs` under `defaults:` is ignored without a warning. Put `tolerance_abs` on each test
- Do not use `DEFINE MEASURE` to test a measure. The query-scoped definition replaces the deployed measure, so the test passes even when the deployed measure is wrong
- `te test` has no option to run a test under an RLS role or effective user. A `Roles=` value in the `-s` connection string had no effect in the verification run. Test row-level security outside `te test`, for example with "View as" in the Power BI service or with the role's filter expression as a query
- A failed test shows the actual value. Before you change the expectation, find out whether the measure or the test is wrong
- `te test list --suite .te-tests` validates the YAML without a connection. Run it before `te test run`
- Exact-value tests need stable data. Run them against a fixed test dataset or a dated period that no longer changes, and give a number signed off by the business owner

## Suite layout and CI

```
.te-tests/
  smoke.test.yaml        # tags: [smoke]; not-empty checks on facts and headline measures
  contracts.test.yaml    # tags: [contract]; additivity, time shift, blank, bounds
  integrity.test.yaml    # tags: [integrity, schema]; orphans, uniqueness, INFO.VIEW
  reconciliation.test.yaml  # tags: [reconciliation]; signed-off figures
```

- On each pull request, after deploy to a test workspace: `te test run --tag smoke` and `--tag contract`
- Before promotion to production: the full suite, then `te test compare` against the production model
- Gate the pipeline on the exit code, and publish `--trx` results. See `config-cicd-env.md`

## Sources

- John Kerski, DAX Query View testing pattern: tests as `.dax` files in source control, a fixed dataset for exact values, schema tests through `INFO` functions. https://sessionize.com/s/jkerski/dax-query-view-testing-pattern/92544
- PQL.Assert, DAX user-defined functions for test assertions. https://www.red-gate.com/simple-talk/data-analytics/powerbi/never-ship-a-broken-semantic-model-again-how-to-build-automated-tests-in-power-bi-with-user-defined-functions/
- INFO DAX functions (Microsoft Learn). https://learn.microsoft.com/en-us/dax/info-functions-dax
- Semantic link measure evaluation in Fabric notebooks. https://learn.microsoft.com/fabric/data-science/tutorial-power-bi-measures
