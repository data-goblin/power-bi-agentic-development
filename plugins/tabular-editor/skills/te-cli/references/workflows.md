# `te` common workflows

Multi-step recipes for the `te` CLI. Modeling-driven workflows (RLS roles, calculation groups, date tables) live in semantic-modeling-practices.md.

## Common workflows

### Build a new table with an M partition

`te add <Table> -t Table` on a model with no provider data source creates an **MPartition** by default. `--partition-expression "<M>"` delivers the M to that partition. Combine with `--columns` for a one-shot data-bound table:

```bash
te add Sales -t Table \
  --columns "OrderID:Int64,Amount:Decimal,OrderDate:DateTime" \
  --partition-expression "$(cat <<'EOF'
let
    Source = Sql.Database("server", "db"),
    Sales = Source{[Schema="dbo", Item="Sales"]}[Data]
in
    Sales
EOF
)" --model ./model --save
```

Result: one table, one MPartition with the M in place, columns typed. `te get Sales/Partitions/Sales -p sourceType` returns `M`.

**Variants:**

```bash
# Columns + placeholder M (filled later via te set <Table>/Partitions/<Name> -p Expression=…)
te add Sales -t Table --columns "Id:Int64,Amount:Decimal" --model ./model --save

# M only, no explicit column schema (columns auto-discovered at refresh from the M output)
te add Sales -t Table --partition-expression "<M>" --model ./model --save

# Force M explicitly when the model has a legacy provider DS that would otherwise win
te add Sales -t Table --source-type m --columns "..." --partition-expression "<M>" --model ./model --save

# Opt into a legacy Query partition on a modern model (the SQL goes in Expression, not Query)
te add LegacyT -t Table --source-type query -p Expression="SELECT * FROM dbo.Foo" --model ./model --save

# Add one more data column to an existing table (both properties required)
te add Sales/Quantity -t DataColumn -p SourceColumn=Qty -p DataType=Int64 --model ./model --save
```

**From the model's own data source** (no connection flags): when the model already carries a SQL Server, Azure SQL or Fabric SQL data source, the CLI reads the connection off it, discovers the columns and binds the partition in one command. `--data-source "<name>"` disambiguates when the model has several.

```bash
te add Inventory -t Table --source-table dbo.Inventory --model ./model --save
te add TopCustomers -t Table --query "SELECT TOP 100 * FROM dbo.Customers" --model ./model --save
te set Inventory --update-schema --model ./model --save          # later: pick up new/retyped source columns (connection inferred from the model)
te set Inventory --update-schema --data-source "Sales DW" --save # pick the data source when the model has several
te set Inventory --update-schema --drop-removed-columns --save   # also delete columns whose source column is gone (destructive)
```

**Inline-data partitions** (demo models, placeholder tables, calc-group hosts): use `#table({...}, {{...}})` inside a single-quoted heredoc. Example for a `_Measures` placeholder table:

```bash
te add _Measures -t Table --columns "_Measures:String" \
  --partition-expression 'let Source = #table({"_Measures"}, {{""}}) in Source' \
  --model ./model --save
```

**Heuristic for `-p Expression="<value>"` on `-t Table`** (when neither `--source-type` nor `--partition-expression` is set): the value is tokenised as M and reported as M if the first token is `(`, `[`, the `let` keyword, or an identifier starting with `#` (`#table`, `#date`, `#shared`, ...). Everything else (including bare identifiers and SQL-shaped strings) becomes a legacy Query partition, with a stderr note pointing at `--source-type m` if M was meant. Leading comments are skipped. Other `-p` assignments on `-t Table` apply to the **table** (a `-p Query=...` is skipped with a warning); only `Expression` is routed to the partition.

**Pre-validation errors** (fail before mutation):
- `--source-type calculated` paired with `-t Table` → use `-t CalculatedTable -p Expression="<DAX>"`
- `--source-type m` on Compatibility Level < 1400 → upgrade the model
- `--source-type` combined with `--mode directlake` → DL/Entity partitions are picked automatically

`--source-type m` on a model that already has a provider data source is supported (mixed-partition models, as in TE3 desktop).

**Updating an existing partition's M** after creation: `te set Sales/Partitions/Sales -p Expression="<M>" --save`. `Expression` reads and writes the body of any partition kind on `te get` and `te set` (`MExpression` / `Query` still work). To reformat it: `te set Sales/Partitions/Sales --format Expression --save`.

### Convert TMDL ↔ BIM ↔ PBIP

```bash
te save-as --model ./model.bim -o ./tmdl-out                                       # BIM → TMDL folder
te save-as --model ./tmdl-folder -o ./model.bim --serialization bim                # TMDL → BIM
te save-as --model ./model.bim -o ./project --serialization pbip --supporting-files # BIM → PBIP (.platform / definition.pbism)
```

`save` is accepted as an alias in the shell; inside `te interactive`, `save` commits staged edits and `save-as` re-serializes.

### Deploy from local TMDL with BPA gate + CI annotations

`te deploy` is a dry run by default: it connects read-only and prints the TMSL it would send. Review first, then add `--execute`.

```bash
te deploy --model ./model \
  --target-server "powerbi://api.powerbi.com/v1.0/myorg/MyWorkspace" --target-database "MySemanticModel" \
  > deploy.tmsl                        # dry run: TMSL only, nothing changes on the server

te deploy --model ./model \
  --target-server "powerbi://api.powerbi.com/v1.0/myorg/MyWorkspace" --target-database "MySemanticModel" \
  --execute --force --ci github        # BPA gate runs by default; pipeline fails on violations
```

`-s`/`-d` always mean the model **source**; the destination is `--target-server`/`--target-database`. Remote-to-remote copy: `te deploy -s src-ws -d src-model --target-server dst-ws --target-database dst-model --execute`.

For CI without strict BPA gating: add `--skip-bpa` (one-shot) or `te config set bpa.onDeploy false`. To auto-fix instead of failing: `--fix-bpa`.

### Generate TMSL/XMLA without deploying

```bash
te deploy --model ./model --target-server ws --target-database model > deploy.tmsl   # informational output goes to stderr, so the redirect stays clean
```

### Refresh single partition with dry-run safety

```bash
te refresh --partition "Sales.2024" --type full -s ws -d model > refresh.tmsl   # dry run: TMSL only
# Review TMSL, then add --execute to run it (asks to confirm at a terminal; --force skips, and is required unattended)
te refresh --partition "Sales.2024" --type full -s ws -d model --execute --force
```

`--partition` takes `Table.Partition` and cannot be combined with `--table`. Executed refreshes under `--output-format json` carry a `progress` array (and `vertipaq` when `vertipaqOnRefresh` is on).

### Find unused measures and remove with preview

```bash
te deps --unused --hidden --model ./model                               # discover candidates (also: te get --unused --hidden)
te remove Sales/UnusedMeasure --dry-run --model ./model                 # confirm impact
te remove Sales/UnusedMeasure --if-exists --model ./model --save        # idempotent removal
```

### Mirror remote workspace for local editing

```bash
te connect MyWorkspace MyModel -w ./local-mirror                        # remote → local TMDL
# Edit locally, push commits, experiment with `te set`, `te add`, etc.
te save-as                                                              # intended to write to both source (remote) and mirror (local); verify with `te connect --help` before relying on bidirectional mirroring
```

### Bulk DAX format and BPA fix as one batch

```bash
te script --inline "Model.AllMeasures.FormatDax();" --model ./model --save && te bpa run --fix --model ./model --save
```

There is no whole-model M sweep; format each M partition or shared expression with `te set <path> --format Expression --save`. For a single object: `te set Sales/Amount --format Expression --save` (repeatable `--format`; `--long`, `--no-space-after-function` only with a DAX property; `--semicolons` is refused here because stored DAX is always comma-separated). Loose expressions: `te util format-dax "<dax>"` / `te util format-m "<m>"` (`-` reads stdin); `te util format-dax --semicolons` is the only place to format DAX written with semicolons.

### Run a TE3 C# script against a remote model

```bash
te script --file ./scripts/format-all-dax.csx -s ws -d model --save
echo "foreach (var t in Model.Tables) t.Name = t.Name.Replace(\"_\", \" \");" | te script --inline - -s ws -d model --save
te script --file ./scripts/fix.cs --validate                            # compile only, no model or connection needed
```

A bare `.cs`/`.csx` positional is accepted as a file; files and `--inline` snippets run in the order written. A script that calls `Error(...)` makes the run exit non-zero (changes made before the error are still saved under `--save`).

### Snapshot + diff for regression testing

```bash
te test snapshot --output-file baseline.snapshot.json -s ws -d model           # capture baseline
# … make changes, redeploy …
te test snapshot --diff baseline.snapshot.json --tolerance 0.001 -s ws -d model   # detect drift
```

For A/B across two deployed models (e.g. candidate vs prod): `te test compare --source-a prod-ws/model --source-b test-ws/model`. Suite authoring and assertion types: `testing.md`.


## Additional authoring workflows

Modeling-driven recipes (mark a date table, calculation groups, RLS roles) live in semantic-modeling-practices.md, paired with the rationale for each. The recipes below are the remaining structural-object workflows. The `te` CLI is in preview; confirm any flag or path shape below with `te <command> --help` (or `te list <container> --paths-only` to see the exact child-path form) before scripting it in a pipeline.

### Perspectives

Perspectives are saved field-list views. Create the perspective, then add whole tables to it through the `Perspectives/<perspective>/<table>` path (no `-t` needed). Single-object membership (one measure, one column) is not addressable through `te add`; set it from a script.

```bash
te add "Perspectives/Sales View" -t Perspective --model ./model --save
te add "Perspectives/Sales View/Sales" --model ./model --save             # add the Sales table (all its objects) to the perspective
te script --inline 'Model.Tables["_Measures"].Measures["Revenue"].InPerspective["Sales View"] = true;' --model ./model --save
```

`te list "Perspectives/Sales View"` returns the perspective object itself, not its members. Membership is visible in the `te add` diff (each affected object is listed as modified) or from a script (`t.InPerspective["Sales View"]`).

### Translations and cultures

Translations live on a culture object; the per-object translated strings are bracket-indexed properties (`TranslatedNames[<culture>]`, `TranslatedDescriptions[<culture>]`). The culture must exist first: a `te set` against a culture the model does not have reports `No changes.` and exits 0.

```bash
te add Cultures/fr-FR -t Culture --model ./model --save
te set "_Measures/Revenue" -p "TranslatedNames[fr-FR]=Revenu" --model ./model --save
te set "_Measures/Revenue" -p "TranslatedNames[fr-FR]=Revenu" -p "TranslatedDescriptions[fr-FR]=Revenu net" --model ./model --save   # both in one atomic change
```

### Incremental refresh setup

A refresh policy is the `RefreshPolicy` sub-object of a table, managed with `te get`/`te set` like any other property bag. The first `te set` creates it. A policy requires the `RangeStart` and `RangeEnd` `NamedExpression` parameters in the model first; the partition M (or `SourceExpression`) must filter on them.

```bash
te set Sales/RefreshPolicy \
  -p RollingWindowPeriods=5 -p RollingWindowGranularity=Year \
  -p IncrementalPeriods=10 -p IncrementalGranularity=Day \
  --model ./model --save
# other properties: IncrementalPeriodsOffset=<N>, Mode=Import|Hybrid,
#   SourceExpression="<M>" (file: -p SourceExpression=- < src.m, single assignment only),
#   PollingExpression="<M>" (detect data changes)
te get Sales/RefreshPolicy --model ./model                              # inspect (errors when the table has no policy)
te set Sales -p RefreshPolicy=null --model ./model --save               # remove; policy-generated partitions stay behind
te refresh --apply-refresh-policy Sales -s ws -d model --execute --force   # apply on the server: creates/expands partitions AND loads data (--force skips the confirmation)
te script --inline 'Model.Tables["Sales"].ApplyRefreshPolicy();' -s ws -d model --save   # metadata-only equivalent
```

Removing a policy is refused when its generated partitions are the table's only partitions; add an import partition first (`te add Sales/Partitions/Full -t MPartition -p Expression="<M>" --save`).

### Field parameters

A field parameter is a `CalculatedTable` whose DAX uses the `NAMEOF(...)` pattern plus specific annotations that Power BI Desktop expects. Hand-authoring the exact DAX and annotations through `te add`/`te set` is error-prone; prefer the field-parameter macro in the `c-sharp-scripting` skill (run via `te macro run` or `te script`), then verify with `te get <Table> --output-format tmdl`.
