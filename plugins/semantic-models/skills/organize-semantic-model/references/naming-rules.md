# House naming decisions

Title Case, spaces, acronyms in capitals, no abbreviations a business user would not recognise. Agree the vocabulary before renaming: key metric words (Revenue, Turnover, Sales), any documented standard, the prior-period convention, the unit convention.

## Decisions

```yaml
tables: no DIM_, FACT_, stg_, RAW_ prefixes; FP_ (field parameter) and CG_ (calculation group) allowed when hidden from users and the AI schema; __Measures style tables allowed
symbols: no emoji, no $$$; "#" only for counts (# Customers)
measure name order: [Aggregation] [Base] [Period] ([Unit])
aggregation: leading, standard abbreviation: MTD Turnover 1YP, YTD Net Sales
period: nYP (1YP, 2YP, 1MP), before the unit: Selling Margin 1YP (%)
unit: in parentheses: (%), (Quantity), (Value) (default, often omitted), (EUR)
comparison: "vs" plus period or target, then the unit: Turnover vs 1YP (%); pick "vs" or "vs." once, and one delta word or symbol
hidden key columns: [Table Name] Key
display folders: numbered prefixes only when alphabetical order is wrong, e.g. 1. Measures, 2. Facts, 3. Keys
```

## Detection

Technical prefixes: `table (DIM|FACT|dim|fact|STG|stg|RAW|raw)_`. Programming case: snake_case, CamelCase, UPPER_CASE. Run them as BPA rules (`te bpa run -r <rules.json> --no-defaults`) rather than by eye; rule shape is in the `bpa-rules` skill.

## Applying renames

- `te mv <old> <new> --save` renames and rewrites dependent DAX; check a dependent measure after
- TMDL on disk without `te`: rename the declaration, then every `[Old]` and `'Table'[Old]` in tables, relationships, functions, roles, perspectives and cultures
- Reports: `pbir fields replace "Report.Report" --from "Sales.Old" --to "Sales.New"`
