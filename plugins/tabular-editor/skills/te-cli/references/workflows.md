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
)" -m ./model --save
```

Result: one table, one MPartition with the M in place, columns typed. `te get Sales/Partitions/Sales -q sourceType` returns `M`.

**Variants:**

```bash
# Columns + placeholder M (filled later via te set <Table>/Partitions/<Name> -q MExpression …)
te add Sales -t Table --columns "Id:Int64,Amount:Decimal" -m ./model --save

# M only, no explicit column schema (columns auto-discovered at refresh from the M output)
te add Sales -t Table --partition-expression "<M>" -m ./model --save

# Force M explicitly when the model has a legacy provider DS that would otherwise win
te add Sales -t Table --source-type m --columns "..." --partition-expression "<M>" -m ./model --save

# Opt into a legacy Query partition on a modern model
te add LegacyT -t Table --source-type query -q query -i "SELECT * FROM dbo.Foo" -m ./model --save
```

**Inline-data partitions** (demo models, placeholder tables, calc-group hosts): use `#table({...}, {{...}})` inside a single-quoted heredoc. Example for a `_Measures` placeholder table:

```bash
te add _Measures -t Table --columns "_Measures:String" \
  --partition-expression 'let Source = #table({"_Measures"}, {{""}}) in Source' \
  -m ./model --save
```

**Heuristic for `-q expression -i "<value>"`** (when neither `--source-type` nor `--partition-expression` is set): the M.Analyzer lexer tokenises the value and reports M if the first token is `(`, `[`, the `let` keyword, or an identifier starting with `#` (`#table`, `#date`, `#shared`, ...). Everything else (including bare identifiers and SQL-shaped strings) reports as Query, with a stderr hint pointing at `--source-type m` if the user meant M. Leading comments are skipped.

**Pre-validation errors** (fail before mutation):
- `--source-type calculated` paired with `-t Table` → use `-t CalculatedTable`
- `--source-type m` on Compatibility Level < 1400 → upgrade the model
- `--source-type` combined with `--mode directlake` → DL/Entity partitions are picked automatically

**Note:** `--source-type m` on a model that already has a provider data source is now supported (matches TE3 desktop's mixed-partition support); the CLI no longer rejects that combination.

**Updating an existing partition's M** after creation: `te set Sales/Partitions/Sales -q MExpression -i "<M>" --save` (note `MExpression`, not `expression`, despite `te get` displaying the property as `expression`).

### Convert TMDL ↔ BIM ↔ PBIP

```bash
te save ./model.bim -o ./tmdl-out                                       # BIM → TMDL folder
te save ./tmdl-folder -o ./model.bim --serialization bim                # TMDL → BIM
te save ./model.bim -o ./project --serialization pbip --supporting-files # BIM → PBIP (.platform / definition.pbism)
```

### Deploy from local TMDL with BPA gate + CI annotations

```bash
te deploy ./model \
  -s "powerbi://api.powerbi.com/v1.0/myorg/MyWorkspace" -d "MySemanticModel" \
  --force --ci github                  # BPA gate runs by default; pipeline fails on violations
```

For CI without strict BPA gating: add `--skip-bpa` (one-shot) or `te config set bpa.onDeploy false`. To auto-fix instead of failing: `--fix-bpa`.

### Generate TMSL/XMLA without deploying

```bash
te deploy ./model -s ws -d model --xmla deploy.tmsl
te deploy ./model -s ws -d model --xmla - > deploy.tmsl                 # to stdout
```

### Refresh single partition with dry-run safety

```bash
te refresh --table Sales --partition "Sales.2024" --type full --dry-run > refresh.tmsl
# Review TMSL, then drop --dry-run to execute
```

### Find unused measures and remove with preview

```bash
te deps --unused --hidden                                               # discover candidates
te remove Sales/UnusedMeasure --dry-run                                 # confirm impact
te remove Sales/UnusedMeasure --if-exists --save                        # idempotent removal
```

### Mirror remote workspace for local editing

```bash
te connect MyWorkspace MyModel -w ./local-mirror                        # remote → local TMDL
# Edit locally, push commits, experiment with `te set`, `te add`, etc.
te save                                                                 # intended to write to both source (remote) and mirror (local); verify with `te connect --help` before relying on bidirectional mirroring
```

### Bulk DAX format and BPA fix as one batch

```bash
te format --save && te bpa run --fix --save
```

### Run a TE3 C# script against a remote model

```bash
te script -S ./scripts/format-all-dax.csx -s ws -d model --save
echo "foreach (var t in Model.Tables) t.Name = t.Name.Replace(\"_\", \" \");" | te script -e - --save
```

### Snapshot + diff for regression testing

```bash
te test snapshot --save baseline.snapshot.json -s ws -d model           # capture baseline
# … make changes, redeploy …
te test snapshot --diff baseline.snapshot.json --tolerance 0.001 -s ws -d model   # detect drift
```

For A/B across two deployed models (e.g. candidate vs prod): `te test compare --source-a prod-ws/model --source-b test-ws/model`. Suite authoring and assertion types: `testing.md`.


## Additional authoring workflows

Modeling-driven recipes (mark a date table, calculation groups, RLS roles) live in semantic-modeling-practices.md, paired with the rationale for each. The recipes below are the remaining structural-object workflows. The `te` CLI is in preview; confirm any flag or path shape below with `te <command> --help` (or `te list <container>` to see the exact child-path form) before scripting it in a pipeline.

### Perspectives

Perspectives are saved field-list views. Create the perspective, then add tables and objects to it through the `Perspectives/<perspective>/...` path.

```bash
te add "Perspectives/Sales View" -t Perspective -m ./model --save
te add "Perspectives/Sales View/Sales" -m ./model --save                 # add the Sales table to the perspective
te add "Perspectives/Sales View/_Measures/Revenue" -m ./model --save     # add a single measure
te list "Perspectives/Sales View"                                        # confirm membership
```

### Translations and cultures

Translations live on a culture object; the per-object translated strings are bracket-indexed properties (`TranslatedNames[<culture>]`, `TranslatedDescriptions[<culture>]`).

```bash
te add Cultures/fr-FR -t Culture -m ./model --save
te set "_Measures/Revenue" -q "TranslatedNames[fr-FR]" -i "Revenu" -m ./model --save
te set "_Measures/Revenue" -q "TranslatedDescriptions[fr-FR]" -i "Revenu net" -m ./model --save
```

### Incremental refresh setup

`te incremental-refresh` manages the policy on a table (`show`, `set`, `remove`, `apply`). A policy requires the `RangeStart` and `RangeEnd` `NamedExpression` parameters in the model first; the partition M (or `--source-expression`) must filter on them.

```bash
te incremental-refresh set Sales \
  --rolling-window-periods 5 --rolling-window-granularity year \
  --incremental-periods 10 --incremental-granularity day \
  -m ./model --save
# other flags: --incremental-offset <N>, --mode import|hybrid,
#   --source-expression "<M>" / --source-expression-file <file.m>,
#   --polling-expression "<M>" / --polling-expression-file <file.m>  (detect data changes)
te incremental-refresh show Sales -m ./model
te incremental-refresh apply Sales -s ws -d model    # re-evaluate the policy, create/expand partitions on the server
```

### Field parameters

A field parameter is a `CalculatedTable` whose DAX uses the `NAMEOF(...)` pattern plus specific annotations that Power BI Desktop expects. Hand-authoring the exact DAX and annotations through `te add`/`te set` is error-prone; prefer the field-parameter macro in the `c-sharp-scripting` skill (run via `te macro run` or `te script`), then verify with `te get <Table> --output-format tmdl`.
