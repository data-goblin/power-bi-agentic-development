# `te` command reference

Full command surface for the `te` CLI. Companion to the te-cli skill (SKILL.md). Configuration keys, CI/CD, output formats, and environment variables live in config-cicd-env.md. `te <command> --help` is authoritative for flags; this file is the curated map.

## Installation

Download from https://tabulareditor.com (signed in with a TE account), or pull the archive from the public CDN (no auth; useful for scripted installs and CI): `https://cdn.tabulareditor.com/files/latest/cli/<archive>`. The CDN serves GET only; HEAD requests return 404, so probe with a ranged GET if you must check availability. Single self-contained binary; no .NET / runtime install needed.

| Platform | Archive | Install location (suggested) |
|---|---|---|
| Windows x64 / ARM64 | `te-win-x64.zip` / `te-win-arm64.zip` | `%LOCALAPPDATA%\Programs\te` |
| macOS Intel / Apple Silicon | `te-osx-x64.tar.gz` / `te-osx-arm64.tar.gz` | `~/.local/bin` |
| Linux x64 / ARM64 | `te-linux-x64.tar.gz` / `te-linux-arm64.tar.gz` | `~/.local/bin` |

```bash
curl -fsSL "https://cdn.tabulareditor.com/files/latest/cli/te-linux-x64.tar.gz" | tar xz -C ~/.local/bin te
chmod +x ~/.local/bin/te
```

Add the install dir to `PATH`. On macOS the binary is signed and notarized; allow first-run network access so Gatekeeper can fetch the ticket. Update by overwriting the binary; config and credentials persist. `latest` is the only published channel during preview; there is no version-pinned URL, so cache or commit the binary if a pipeline needs reproducible builds. No license is required during preview.

**Shell completion** (`bash`, `zsh`, `powershell` (alias `pwsh`), `fish`):
```bash
te completion bash > ~/.local/share/bash-completion/completions/te
te completion zsh  > ~/.zfunc/_te
te completion pwsh | Out-String | Invoke-Expression        # PowerShell; add to $PROFILE
te completion fish > ~/.config/fish/completions/te.fish
```

**Cross-platform limits**: `--local` (Power BI Desktop, Visual Studio workspaces, standalone SSAS) is Windows-only. All cloud workflows work on every platform.

## Authentication

Backed by Azure Identity's full credential chain. `--auth` is a global option (every command that connects honours it); unknown values are rejected.

| Method | Flag | When to use |
|---|---|---|
| Automatic | `--auth auto` (default) | Tries env credentials, then cached login, then browser |
| Interactive browser | `--auth interactive` | Local dev |
| Service principal (secret) | `--auth spn -u <appId> -p <secret> -t <tenant>` | Avoid secrets on the cmd line; `-p -` reads stdin |
| Service principal (cert) | `--auth spn -u <appId> -t <tenant> --certificate <path>` | Cert-based CI |
| Environment vars | `--auth env` (reads `AZURE_CLIENT_ID/SECRET/TENANT_ID`) | **Preferred for CI** |
| Managed identity | `--auth managed-identity` | Azure-hosted runners |

```bash
te auth login                                              # browser
echo "$AZURE_CLIENT_SECRET" | te auth login -u "$AZURE_CLIENT_ID" -p - -t "$AZURE_TENANT_ID"   # SPN, secret via stdin, cached
te ls -s <server> -d <db> --auth env                        # SPN from AZURE_CLIENT_* env vars, nothing cached
te auth login --identity                                   # managed identity (alias -I)
te auth status                                             # exit 0 if authenticated, 1 otherwise
te auth logout                                             # clear every cached record
```

**Credential storage**: OS-native secure store by default (Windows DPAPI, Linux libsecret, macOS Keychain); a `0600` file fallback under `~/.te-cli/` is chosen only when no keystore is available (headless Linux). Browser and SPN logins share one cache. `--debug` prints which backend was selected.

## Connections and profiles

`te connect` sets a per-terminal active connection so subsequent commands don't need `-s/-d/-m` repeated. State lives in the session file (see [Sessions](#sessions)), not global config.

```bash
te connect                               # show active connection
te connect MyWorkspace MyModel           # remote workspace
te connect MyWorkspace                   # list models in the workspace
te connect ./my-model                    # local TMDL/BIM/.SemanticModel
te connect --local                       # pick a local Analysis Services instance (Windows): PBI Desktop, VS workspace, SSAS
te connect --local MyModel               # match an instance (report window title) or database name
te connect --clear                       # reset (also drops any workspace mirror)
```

**Workspace mirroring** (every `--save` writes to both sides; local first, then remote):

```bash
te connect Finance "Revenue Model" -w ./revenue-model   # remote primary, mirror to local folder
te connect ./revenue-model -w Finance "Revenue Model"   # local primary, initial deploy + redeploy on save
# --workspace-format tmdl|bim|database.json  (bim accepts tmsl; default inferred from the path)
# --workspace-auth <method>                # auth for the remote side when primary is local
# --force                                  # required when the target already exists
```

**Profiles** save a named connection plus behaviour overrides; `te connect --profile <name>` activates one, `--profile <name>` on `te deploy` uses one for a single call:
```bash
te profile set prod -s MyWorkspace -d MyModel --description "Production"
te profile set dev  --model ./model --bpa-on-deploy false --validate-on-mutation false
te profile set staging --from-active                     # snapshot the current active connection
# other overrides: --auto-format, --bpa-on-mutation, --vertipaq-on-refresh, --spinner (true|false|null to clear)
te profile list / show prod / remove old                 # list also accepts ls; remove accepts rm
te connect --profile prod
```

## Object path syntax

One grammar for every command. Two flavours:

**Object paths** (`<path>`); used by `te set`, `te add`, `te remove`, `te move`, `te deps`, `te macro run --on`, and `te get` with `-p`, `--deps` or `--properties`. Resolve to **one** object. `*` rejected; DAX bracket-suffix allowed.

**Filter paths** (`<path-filter>`); used by `te list`, plain `te get` (a wildcard or container path lists every match, no `--ls` needed), `te get --ls`, `te get --where`, `te bpa run --path`. Resolve to a **set**. `*` allowed; bracket-suffix rejected.

A path is a slash-separated sequence of segments. Empty input and `.` mean the model root (`te get .`).

### Reserved characters and quoting

Reserved: `/ [ ] ' " * ? { }`. A segment containing any of `* ? { }` **must be quoted** (unquoted use errors and shows the quoted form); quote spaces, `/`, `[`, `]` too. DAX quoting rules: single quotes in table position, double quotes for a child name, doubled quote escapes itself (`'Bob''s'`), doubled `]` inside brackets (`[foo]]bar]`).

```bash
te get "Tables/'{foo}'"                  # table literally named {foo}
te get 'Sales/"my*name"'                 # child literally named my*name
te list "Sales/'*literal*'"              # quoted * matches literally, not as a wildcard
te get "'Net Sales'[Sales Amount]"       # DAX form with spaces
```

Mixed-quote forms assume bash or PowerShell; cmd.exe cannot express them. **Every path the CLI prints** (`--paths-only`, `objectPath` in JSON, errors, "did you mean" hints) is canonically quoted and pastes straight back into another command.

### Slash-form

- `Sales`; table. `Sales/Revenue`; measure or column on it. `Sales/Measures/Revenue`; same, container-scoped (disambiguates when kinds share a name)
- `Sales/Measures`, `Sales/Columns`, `Sales/Hierarchies`, `Sales/Partitions`, `Sales/Calendars`, `Sales/CalculationItems`, `Sales/KPIs`, `Sales/Sets`; table sub-containers
- `Sales/Geography/Levels/Year`; hierarchy level. `Sales/Revenue/KPI`; a measure's KPI. `Sales/Sets/<name>`; a calculated set (container form only). `Sales/Calendars/<name>`
- `Sales/RefreshPolicy`; incremental-refresh policy sub-object
- `Roles/<role>/Members/<member>`, `Roles/<role>/TablePermissions/<table>` (alias `Permissions`)
- `Perspectives/<persp>/<table>`; perspective membership (`te add Perspectives/Default/Sales`)
- `Relationships/{guid}`; the form the CLI prints; the display name is also accepted on `te get`
- Model-level containers: `Tables`, `Measures`, `Columns`, `Hierarchies`, `Partitions`, `KPIs`, `Sets`, `Relationships`, `Roles`, `Perspectives`, `Cultures`, `DataSources`, `Expressions`, `CalculationGroups`, `Functions`, `Annotations`

Container keywords win over object names in filter paths: `te list KPIs` lists KPIs, not a table named KPIs. Quote to force the literal (`te list "'KPIs'"`, `te list 'Sales/"Sets"'`). In object paths a *table* named `KPIs`/`Sets` still resolves bare; a measure or column named `Sets` under a table must be double-quoted.

### DAX-form (object paths)

- `'Sales'[Amount]` = `Sales/Amount`; the bracket biases toward columns/measures over hierarchies and partitions
- `[Total Sales]`; **model-wide** measure-or-column lookup (measures win)
- `"Sales[ProdKey]->Product[ProdKey]"`; relationship shorthand (`te add` only)

### Wildcards (filter paths only)

Single `*` matches any run of characters within one segment (case-insensitive). `?` is reserved and not a wildcard. N segments give N-level results; the only auto-expansion is a bare, non-wildcard table name (`te list Sales` shows its children, `te list Sa*` shows matching tables).

```bash
te list Sa*                     # tables starting with "Sa"
te list Sales/*Amount           # children of Sales ending in "Amount"
te list */Amount                # an "Amount" column/measure across every table
te list Roles/Re*/Members       # members of every role matching Re*
te bpa run --path "Sales/*"     # BPA only on the tables the filter touches
```

### `-t/--type` has two meanings

On single-object commands (`get`, `set`, `remove`, `move`, `deps`) it **disambiguates** a path that matches several kinds (`te get Sales/Date -t Hierarchy` when a column and hierarchy share the name; values `Measure`, `Column`, `CalculatedColumn`, `Hierarchy`, `Calendar`, `Partition`, `CalculationItem`). On `te list` and `te get --ls/--where` it **filters** by kind (lower-case `table`, `measure`, `column`, `hierarchy`, `partition`, `relationship`, `role`, `perspective`, `culture`, `calculationitem`, `kpi`, `set`, `function`). On `te add` it names the type to create.

## Global options

Work with every command, before or after the subcommand. **The model is never a positional argument**; a stray trailing path is rejected.

| Option | Description |
|---|---|
| `-m, --model <path>` | TMDL folder, `.bim`, `database.json` folder, or `.SemanticModel` folder |
| `-s, --server <endpoint>` | Workspace name, `powerbi://...`, `asazure://...`, `host[:port]`, `SERVER\INSTANCE`, MSOLAP connection string. A dotted name is treated as a server (warning); use `Name.Workspace` or the `powerbi://` URL for a dotted workspace |
| `-d, --database <name>` | Semantic model name on the workspace / database on the server |
| `--local` | Locally running Analysis Services instance (Windows only) |
| `--auth <method>` | `auto` (default) \| `interactive` \| `spn` \| `env` \| `managed-identity` |
| `--output-format <fmt>` | `text` (default) \| `json` \| `csv` \| `tmsl` (alias `bim`) \| `tmdl`. `tmsl`/`tmdl` only on `te get`/`te list`; commands reject formats they don't support |
| `--error-format <fmt>` | `text` (default) \| `json`; stderr format for errors/warnings/hints, independent of `--output-format` |
| `--recent [N]` | Recently used model (no value = picker, `N` = Nth most recent) |
| `--non-interactive` | Disable prompts; fail if input missing; **set in CI** |
| `--debug` | Debug logs to stderr |

Model resolution order: `--recent` → `--local` → `-s/-d` → `--model` → active `te connect`. `--output-format` (stdout rendering) and `--serialization` (on-disk model format on `init`/`save-as`/mutations) are **different flags**. `-s`/`-d` always mean the model source, including on `te deploy`.

## Command reference (10 families)

### Model I/O

| Command | Purpose | Key flags |
|---|---|---|
| `te save-as` (alias `save`) | Re-serialize / convert / write back | `-o, --output-path <path>` (omit = write back to source), `--serialization tmdl\|bim\|database.json\|pbip` (`bim` accepts `tmsl`; with `-o` inferred from the path), `--force`, `--skip-bpa`, `--fix-bpa`, `--bpa-rules <file>` (repeatable), `--skip-validation`, `--supporting-files` |
| `te init [path]` | Create empty model (path optional; falls back to `--model`) | `--compatibility-mode PowerBI\|AnalysisServices` (default `PowerBI`), `--compatibility-level <int>` (alias `--compat`; default 1705 PowerBI / 1500 AS), `--name`, `--serialization` (default `tmdl`), `--force` |

```bash
te save-as --model ./model.bim -o ./tmdl-out                     # convert BIM → TMDL
te save-as --model ./model.bim                                   # re-serialize in place (normalize)
te save-as -o ./project --serialization pbip --supporting-files
te save-as -o ./out -s ws -d model --skip-validation             # fast download of a remote model
te init ./my-model                                               # PowerBI mode, TMDL, compat 1705
te init ./my-model --compatibility-mode AnalysisServices         # AS mode, compat 1500
te init ./my-model --serialization bim                           # single-file .bim
te --model ./new.bim init                                        # path via global --model
```

`te init` is idempotent (`Already exists`, exit 0; JSON `{"created": false, "reason": "already_exists"}`). Every command loads the model implicitly; `te get .` and `te list` give a summary.

### Model Editing

All mutating commands (`set`, `add`, `remove`, `move`, `script`, `macro run`, `bpa run --fix`) are **dry runs without `--save`** (`Dry run - nothing saved. Add --save to persist.`); `--save-to <path>` writes elsewhere; `--force` saves despite new DAX validation errors. They print a before/after diff of every changed object; `--stat` (one line per object + property count), `--name-only` (paths only, pipeable into `te get`) and `--diff` (default) pick the view, `te config set mutationOutput diff|stat|name-only|none` sets the standing default. JSON always carries the full `changes[]` (see [Changes JSON](#changes-json)).

| Command | Purpose | Key flags |
|---|---|---|
| `te set <path> [Name=Value ...]` | Set properties / format / sync schema | `-p, --property Name=Value` (repeatable; bare `Name=Value` after the path also works; everything after the first `=` is the value; `Name=-` reads stdin verbatim, one assignment only; `Name=` sets an empty string; `Name=null` clears any property that can hold nothing, strings included), `--unset <Name>` (repeatable; the spelled-out form of `Name=null`; numbers, booleans and enums are refused), `--format <Property>` (repeatable; DAX or M detected; `--long`, `--no-space-after-function` only with `--format` on DAX; `--semicolons` is **refused** with `--format`, stored DAX is always comma-separated), `--update-schema [--drop-removed-columns] [--data-source <name>]` with the schema-source flags, `-t <kind>`, `--save`, `--save-to`, `--serialization`, `--force`, `--stat\|--name-only\|--diff` |
| `te add <path>` | Add object | `-t <type>` (`Table`, `CalculatedTable`, `CalcGroup`, `Measure`, `CalculatedColumn`, `DataColumn`, `Hierarchy`, `Level`, `Calendar`, `CalcItem`, `KPI`, `Partition`, `MPartition`, `EntityPartition`, `PolicyRangePartition`, `Expression`, `Function`, `Perspective`, `Culture`, `ProviderDataSource`, `StructuredDataSource`, `Role`, `TablePermission`, `Member`), `-p Name=Value` (repeatable; expression as `-p Expression=...` or `--file <path>` or `-p Expression=-`), `--if-not-exists`, `--save`. Tables: `--mode import\|directquery\|dual\|directlake`, `--source-table schema.table`, `--query "SELECT ..."`, `--data-source <name>`, `--source sql\|lakehouse\|warehouse`, `--endpoint`, `--connection-string`, `--source-database`, `--columns "Id:Int64,Name:String"`, `--partition-expression "<M>"`, `--source-type m\|query\|calculated` |
| `te remove <path>` (alias `rm`) | Remove object | `--force` (skip dependents check), `--if-exists`, `--dry-run`, `-t <kind>`, `--save` |
| `te move <src> <dst>` (aliases `mv`, `rename`) | Move/rename | `-t <kind>`, `--save` |

```bash
te set Sales/Amount -p Expression="SUM(Sales[Amt])" --save
te set Sales/Amount Description="Net amount" FormatString="#,0" --save         # bare assignments
te set Sales -p IsHidden=true --save
te set Sales/Amount -p "Annotations[Tabular Editor]=automated" -p "TranslatedNames[fr-FR]=Montant" --save
te set . -p Database.CompatibilityLevel=1702 --save                             # nested property on the model root
cat measure.dax | te set Sales/Amount -p Expression=- --save                    # value from stdin
te set Sales/Amount --format Expression --format DetailRowsExpression --save    # format in place
te set "Sales/Partitions/Sales" --format Expression --save                      # M partition (no DAX-only flags)
te set Sales/Amount -p SourceColumn=amount_v2 --save                            # remap a renamed source column
te set "Sales/Total Sales" --unset Description --unset DisplayFolder --save     # clear properties (= -p Description=null)
te set Sales --update-schema --save                                             # sync columns with the source (connection inferred from the model)
te set Sales --update-schema --data-source "Sales DW" --save                    # pick the data source when the model has several
te add Sales/Revenue -t Measure -p Expression="SUM(Sales[Amount])" -p FormatString="#,0" --save
te add "Sales/Measures/Margin" -t Measure -p Expression="[Revenue]-[COGS]" --save   # container-form path
te add Sales/Quantity -t DataColumn -p SourceColumn=Qty -p DataType=Int64 --save   # both -p required
te add "Sales/Partitions/Q1" -t MPartition -p Expression="let ... in ..." --save
te add Inventory -t Table --source-table dbo.Inventory --save                   # from the model's own data source
te add TopCustomers -t Table --query "SELECT TOP 100 * FROM dbo.Customers" --save
te add Products -t Table --save                                                 # empty table
te add "Sales[ProdKey]->Product[ProdKey]" --save                                # relationship shorthand
te add Sales/Flag -t CalculatedColumn -p Expression="Sales[Amount] > 1000" --if-not-exists --save
te add Roles/Reader -t Role --save
te add "Roles/Reader/Members/CONTOSO\jdoe" -t Member --save
te add "Roles/Reader/TablePermissions/Sales" -t TablePermission -p FilterExpression="[Region] = \"EU\"" --save
te remove Sales/OldMeasure --if-exists --save
te remove Sales/Revenue --dry-run                                               # lists dependents, changes nothing
te move Sales/Revenue Finance/Revenue --save                                    # cross-table move
te move Sales/Date Sales/CalendarDate -t Hierarchy --save                       # disambiguate from the column
te move "Sales/Partitions/Old" "Sales/Partitions/New" --save
```

`--update-schema` adds new source columns (type detected), retypes drifted ones, keeps every existing column property; missing source columns only warn unless `--drop-removed-columns` (a rename looks like drop + add: remap with `-p SourceColumn=` first). Refused on calculated tables and calculation groups; cannot combine with `-p` or `--format`. With no connection flags the connection is inferred from the model: the data source the table's partitions are bound to, the connection in the table's own query, or the model's single usable data source; `--data-source <name>` chooses when several would do, and explicit `--source sql --endpoint ... --source-database ...` / `--connection-string` always wins. `--source-table` defaults to the partition's binding (falling back to the table name). `te add -t Table --source-table` with no connection flags reads the model's own data source the same way (SQL Server / Azure SQL / Fabric SQL); on a legacy provider source the partition is a SQL query unless `--source-type m`. Both refuse cleanly and create nothing when no source can be worked out, when the source's password is not stored, or when the source table cannot be found; the error names the table it looked for. `--query` works with an inferred connection too and is refused together with `--columns`, `--mode directlake`, or an inline expression.

#### Incremental refresh policies

A table's policy is the `RefreshPolicy` sub-object; the first `te set` creates it. Properties: `Mode` (`Import`/`Hybrid`), `RollingWindowPeriods`/`RollingWindowGranularity`, `IncrementalPeriods`/`IncrementalGranularity`, `IncrementalPeriodsOffset`, `SourceExpression`, `PollingExpression`.

```bash
te get Sales/RefreshPolicy                                              # errors if the table has none
te set Sales/RefreshPolicy -p RollingWindowPeriods=5 -p RollingWindowGranularity=Year -p IncrementalPeriods=1 -p IncrementalGranularity=Day --save
te set Sales/RefreshPolicy -p SourceExpression=- --save < src.m
te set Sales -p RefreshPolicy=null --save                               # remove; generated partitions stay (refused if they are the only ones)
te refresh --apply-refresh-policy Sales --execute --force                # apply on the server (loads data); --force skips the confirmation
te script --inline "Model.Tables[\"Sales\"].ApplyRefreshPolicy();" --save   # metadata-only partition generation
```

#### Common `-p` properties

Names are PascalCase as `te get` prints them, case-insensitive on input, and both spellings are accepted where the grid label and the TOM name differ (`Hidden` / `IsHidden`); dotted paths (`KPI.StatusGraphic`) and indexers (`Annotations[key]`) work. **`te get <path> --properties`** is the authoritative list for one object: every name `-p` accepts with type, access, description and allowed values (`--all` adds internal bookkeeping properties; `--output-format json` for scripts). `te get <obj>` also prints a `Settable:` line with the properties `te set` accepts (`SortByColumn` included) and a pointer to `--properties`; an unknown name on `te get -p` / `te set -p` gets a `Did you mean` hint plus the `--properties` command for that object.

| Object | Common properties |
|---|---|
| **Measure** | `Expression`, `FormatString`, `DisplayFolder`, `Description`, `IsHidden`, `DetailRowsExpression`, `FormatStringExpression`, `Name` |
| **DataColumn** | `DataType` (`Int64`/`String`/`Double`/`Decimal`/`DateTime`/`Boolean`), `SourceColumn`, `SummarizeBy` (`None`/`Sum`/`Count`/`Average`/`Max`/`Min`/`DistinctCount`/`Default`), `IsKey`, `IsHidden`, `FormatString`, `SortByColumn` (`null` to clear), `DataCategory`, `DisplayFolder`, `IsAvailableInMDX` |
| **CalculatedColumn** | `Expression` plus most DataColumn properties |
| **Partition** (any kind) | `Expression` reads and writes the partition's body on `te get`, `te set` and `te add` alike (`MExpression` and `Query` still work as aliases); `--format Expression` formats it. `Mode` (`Import`/`DirectQuery`/`DirectLake`/`Default`), `Description` |
| **Table** | `IsHidden`, `DataCategory` (`Time` marks a date table), `Description`, `Name`, `RefreshPolicy=null`, `ExcludeFromModelRefresh` |
| **Hierarchy / Level** | `DisplayFolder`, `Description`, `IsHidden`; Levels take `Column` |
| **ModelRole / TablePermission** | `ModelPermission` (`None`/`Read`/`ReadRefresh`/`Refresh`/`Administrator`); `FilterExpression` |
| **KPI** (`<table>/<measure>/KPI`) | `StatusExpression`, `TrendExpression`, `TargetExpression`, `StatusGraphic`, `TrendGraphic` |
| **CalculationItem** | `Expression`, `Ordinal`, `FormatStringExpression` |
| **Model** (`.`) | `Description`, `Culture`, `Collation`, `DiscourageImplicitMeasures`, `Database.CompatibilityLevel` |
| **Annotations / Translations** | `Annotations[<key>]`, `TranslatedNames[<culture>]`, `TranslatedDescriptions[<culture>]` |

### Inspection

`te get` is the single read pipeline; `te list` (= `get --ls`) and `te deps` (= `get --deps` / `get --unused`) are shortcuts.

| Command | Purpose | Key flags |
|---|---|---|
| `te get [path]` | Properties of one object; or select/analyze sets | `-p <Property>` (project one), `--properties [--all]` (list the names `-p` accepts on that object; text/json only; needs one object; excludes `-p`, `--ls`, `--where`, `--deps`, `--unused`), `--where Prop=Value` (repeatable AND, case-insensitive, `*` wildcard, exact otherwise; with no path it filters the **top-level tables**, so name a container for other kinds), `--ls`, `--deps[=upstream\|downstream]`, `--deep`, `--max-depth <N>` (default 10), `--unused`, `--hidden`, `-t <kind>`, `--paths-only`, `--no-multiline`, `--output-format tmdl\|tmsl\|bim\|json\|csv`. No path = list the model; `.` = model root; a wildcard or container path lists every match |
| `te list [filter]` (alias `ls`) | FS-style listing | `--type <kind>`, `--paths-only`, `--no-multiline`, `--output-format bim` (TMSL of the matches; `tmdl` is `te get` only) |
| `te find <text>` | Text search | `--in names\|expressions\|descriptions\|displayFolders\|formatStrings\|annotations\|all`, `--regex`, `--case-sensitive`, `--paths-only`, `--no-multiline`. The pattern is a **literal, case-insensitive substring** unless `--regex` (`te find "Gross*"` looks for a literal `*`); an invalid regex is refused naming the flag. `--in expressions` covers every expression property: measure DAX, calc columns/tables, KPI status/trend/target, detail rows, partition M, role filters, calc-group selection expressions. JSON reports the scope searched and the matching mode alongside the matches |
| `te diff <left> <right>` | Structural diff of two model paths | exit 0 identical, 1 differ, 2 error; JSON uses the [Changes JSON](#changes-json) shape. An object present in only one model is listed with its contents (a new table's columns/measures/partitions, a new role's filters), each as its own entry, and the summary counts include them |
| `te deps [path]` | Dependency analysis | `--upstream`, `--downstream`, `--deep`, `--max-depth`, `-t`, `--unused` (no DAX refs, not in relationships/hierarchies/sort-by/variations/alternate-of/calendars), `--hidden`. JSON entries and tree nodes carry `objectPath`, `object` (bare name), `objectType` |

```bash
te list                                       # tables
te list Sales                                 # children of Sales
te list Sales/Measures --paths-only           # pipeable
te list Measures --output-format json         # every object leads with objectPath
te list KPIs / te list Sales/KPIs / te list Sets / te list Functions
te list --type relationship --paths-only      # Relationships/{guid} per line
te list Tables --output-format bim > tables.json
te get Sales/Revenue -p Expression
te get "[Total Sales]" -p Expression          # model-wide lookup
te get Sales/Revenue --output-format json     # {objectPath, type, properties: {...}}
te get "Sa*"                                  # every table matching the wildcard (no --ls needed)
te get Sales/Revenue --properties             # names -p accepts, with types and allowed values
te get Sales --output-format tmdl             # whole table as TMDL
te get . -p Description                       # model-level property
te get Measures --where "Name=*margin*" --ls --paths-only
te get Columns --where DataType=String --where IsHidden=true --ls
te get Sales --ls -t Measure                  # -t filters here
te get Sales/Revenue --deps downstream --deep --max-depth 3
te get --unused --hidden                      # prune candidates
te find "CALCULATE" --in expressions --paths-only | xargs -I{} te get {} -p Expression
te diff ./model-v1 ./model-v2 --output-format json
```

Empty `--where` and `te find` results exit 0 and say what was searched, how the pattern was matched, and which command widens the search (JSON prints `[]`). A filter on a property no object in scope has is an error. Unknown objects get a "did you mean" list of full `Table/Object` paths (tables, measures, columns and hierarchies); a single-quoted name is read as a table, and the hint points at `Table/Object` or `"[Object]"` for anything else. Every path a refusal prints exists in your model and resolves as printed.

### Analysis & Quality

| Command | Purpose | Key flags |
|---|---|---|
| `te validate` | Expressions + relationship integrity + TOM errors + name collisions | `--ci vsts\|github` (aliases `azdo`, `azure-devops`, `gh`; `none` = off; other values rejected), `--trx <file>`, `--errors-only` (= `--no-warnings --no-antipatterns`), `--server-only`, `--no-multiline`. CSV output rejected. Every finding shows its code in the text tables. `TE0012` (duplicate name within a table) and `TE0013` (measure name repeated across tables) are errors that also block `te save-as` unless `--force`/`--skip-validation`; `TE0014` warns that a TMDL folder has no `database.tmdl` (compatibility level substituted; still exits 0) |
| `te schemacheck [table]` | Source schema drift: added, retyped and missing source columns, per table. Never writes the model | `--ci vsts\|github`, `--trx <file>`, `--fail-on error\|warning` (default `error`). Added/retyped column = warning (exit 0), missing source column or unreadable legacy query = error (exit 1). Checks legacy SQL query, M and Direct Lake / Fabric tables; calculated tables, calculation groups, skip-annotated tables and sources it cannot read are listed as **Not checked** and never fail the run. Connection comes from the table's own data source; one table accepts the `te add -t Table` source flags (`--source-table` alone overrides only the name). Honours TE2's annotations (`TabularEditor_SkipSchemaCheck`, `TabularEditor_IgnoreSourceColumnAdded`, `TabularEditor_IgnoreDataTypeChange`, `TabularEditor_IgnoreMissingSourceColumn`, model-level `TabularEditor_SchemaCheckNoWarnings`). Read-only counterpart of `te set <table> --update-schema` |
| `te bpa run` | Run BPA | `-r/--rules <file-or-url>` (repeatable; replaces the user-rule layer), `--no-defaults`, `--no-model-rules`, `--allow-external-rules`, `--rule <id>` (repeatable), `--path <filter>`, `--vpax <file>`, `--fail-on error\|warning` (default `error`), `--ci`, `--trx`, `--fix`, `--save`, `--save-to`, `--serialization`, `--stat\|--name-only\|--diff`, `--no-multiline`. Text output has a `Rule ID` column |
| `te bpa rules <sub>` | Manage rules | `list` (alias `ls`; `--all`, `--disabled`, `--ignored`, `--no-defaults`), `add <id>` (`--name`, `--scope`, `--expression` (`-` = stdin), `--category`, `--severity 1\|2\|3`, `--description`, `--fix-expression`), `set <id> -p name=value` (repeatable; `name`, `expression`, `scope`, `category`, `severity`, `description`, `fixExpression`), `remove <id>` (alias `rm`), `ignore <id>` / `unignore <id>` (model annotation), `init [--force]`, `disable <id>` / `enable <id>` (built-ins; writes `bpa.disabledBuiltInRuleIds`). All take `--rules-file <path>` or `--model-rules` |
| `te vertipaq [path]` | VertiPaq stats (needs a deployed model, or `--import`) | `--columns`, `--relationships`, `--partitions`, `--all`, `--detail`, `--fields <csv>`, `--top <N>`, `--stats`, `--export <vpax>`, `--import <vpax>` (offline), `--obfuscate`, `--annotate`, `--push` (writes the prepared annotations to the workspace; requires `--annotate`, refused with `--import`). Unknown path errors with candidates |

```bash
te validate --model ./model --ci github --trx results.trx
te validate --errors-only --output-format json
te schemacheck --model ./model --ci vsts --trx schema.trx       # drift gate; --fail-on warning fails on any drift
te schemacheck Sales --output-format json
te bpa run --fail-on error --ci github --output-format json
te bpa run --fix --save --stat
te bpa run --rule TE3_BUILT_IN_SET_ISAVAILABLEINMDX_FALSE --path Sales
te bpa rules list --all --no-multiline
te bpa rules disable TE3_BUILT_IN_DATE_TABLE_EXISTS
te bpa rules add MEASURE_NEEDS_DESCRIPTION --name "Measures need a description" --scope Measure --expression "not IsHidden and string.IsNullOrEmpty(Description)" --severity 2
te bpa rules set MEASURE_NEEDS_DESCRIPTION -p severity=3
te vertipaq Sales/Amount -s ws -d model
te vertipaq --all --export stats.vpax -s ws -d model
te vertipaq --import stats.vpax --columns --detail
```

BPA rule layers: user rules (exactly one source wins: `--rules` → `TE_BPA_RULES` → `bpa.rules` config), built-in defaults (exactly TE3's built-in set, `TE3_BUILT_IN_*`; skipped with `--no-defaults` or `bpa.builtInRules=false`, individually via `bpa.disabledBuiltInRuleIds`), model-embedded rules (`--no-model-rules` to skip). Each ID is evaluated once. `bpa rules set`/`remove` refuse built-in IDs: disable the built-in and add a copy under a new ID. The `VPA_*` rules are not built-ins; supply them from your own rules file together with `--vpax`.

**Formatting** has no standalone command: `te set <path> --format <Property> --save` for an expression in the model, `te util format-dax` / `te util format-m` for loose text, `te script --inline "Model.AllMeasures.FormatDax();" --save` for a whole-model DAX sweep (no single-command equivalent for all M). `autoFormat` config formats only the objects a mutation changed.

#### Findings JSON

`te validate`, `te bpa run`, `te test run` and `te query` (on validation errors) emit one document: `command`, `durationMs`, `summary {errors, warnings, info, total}`, `findings[]` with `severity` (`error|warning|info`), `source` (`validate|bpa|test|query`), `code` (message ID / rule ID / `TEST_FAIL` etc.), `message`, `object`, `objectType` (closed vocabulary: `Measure`, `Column`, `Table`, `KPI`, `Member`, `BpaRule`, `Query`, ...), `fixable`; plus `objectPath` (validate/bpa, resolvable by `te get`), `expressionPosition {property, lineNumber, column}` (optional), `ruleName`/`category` (bpa). Extras: `valid` (validate); `model`, `rulesEvaluated`, `violations`, `ruleErrors`, `ignoredRules`, and `fix {changes, fixed, fixErrors, skipped, ...}` under `--fix` (bpa); `suites`, `invalidSuites`, `testSummary` (test). CI annotations carry the code (`code=` vsts, `title=` github); info findings are `::notice::`, not warnings.

#### Changes JSON

Mutating commands and `te diff` share one shape: `changes[]` of `{objectPath, objectType, changeKind (created|deleted|modified|moved), movedFromObjectPath?, properties: [{property, before, after}]}`; property names are PascalCase (`IsHidden`), object types match `-t` names (`KPI`, `Member`), partitions are `Sales/Partitions/Sales`, roles `Roles/Reader`, relationships `Relationships/{guid}`. Mutations also report `status` (`staged`/`saved`/...).

### Execution

| Command | Purpose | Key flags |
|---|---|---|
| `te query [dax]` | DAX query (needs `-s/-d`, `--local` or active connection) | positional or `-q <dax>` (`-q -` = stdin; bare redirected stdin is read when no query given), `--file <file.dax>`, `--limit <N>` (default 100), `-o, --output-file <file>` (`.csv\|.tsv\|.json\|.dax`), `--no-validate`, `--trace`, `--cold`, `--plan` (needs `--trace`), `--runs <N>` |
| `te script [files]` | C# script(s) via the TE3 scripting host | `--file <path>` (repeatable) or bare `.cs`/`.csx` positionals, `--inline "<code>"` (repeatable; `-` = stdin), `--validate` (compile only; no model needed), `--save`, `--save-to`, `--serialization`, `--force`, `--stat\|--name-only\|--diff`. Sources run in the order written. Exits non-zero when a script calls `Error(...)` (changes are still saved with `--save`). Refused on Windows when the `DisableCSharpScripts` administrator policy is set, and a script that leaves the model (files, network, processes, `#r`, direct server commands) is refused under `BlockUnsafeScripts` with `blockedByPolicy: true` in JSON (see config-cicd-env.md) |
| `te macro <sub>` | TE3 macros (`MacroActions.json`; `--macros <file>` → `TE_MACROS_PATH` → `macros` config → `./MacroActions.json`) | `list` (alias `ls`), `run <name-or-id>` (`--on <path>`, `--save`, `--save-to`, `--force`), `add <name>` (`-e "<code>"` or `-s <file.cs>`, `--tooltip`, `--contexts`, `--enabled`), `set <name-or-id> -p name=value` (`name`, `execute`, `enabled`, `tooltip`, `validContexts`; `-` = stdin), `remove` (alias `rm`), `sort`, `init [--force]` |

```bash
te query "EVALUATE TOPN(5, 'Sales')" -s ws -d model --output-format json
te query --file query.dax -s ws -d model -o results.csv
te query "EVALUATE Sales" -s ws -d model --runs 5 --cold --plan
te script fix.cs --model ./model --save
te script setup.cs --inline "Info(\"done\");" cleanup.csx --save     # in order
te script --inline "Info(Model.Tables.Count.ToString());"            # Info takes a string
echo "Info(Model.Name);" | te script --inline -
te script --file fix.cs --validate                                   # offline lint, no model
te macro run "Hide all measures" --save
te macro run "Format DAX" --on "Sales/Revenue" --save
te macro add MyMacro -e "Info(Selected.Measure.Name);" --contexts Measure --tooltip "Print name"
te macro set MyMacro -p tooltip="Updated" -p enabled="Selected.Measures.Any()"
```

Scripts see `TECLI` defined (TE3 defines `TE3`); `SelectMeasure()`/`SelectTable()`/`SelectObject(s)()` throw in the CLI; add `using System.Data/IO/Text/Text.RegularExpressions;` explicitly.

### Deployment & Refresh

**Both are dry runs by default**: they connect read-only and print the exact TMSL to stdout (informational text goes to stderr, so `> file` stays clean). `--execute` performs the operation.

| Command | Purpose | Key flags |
|---|---|---|
| `te deploy` | Deploy the model (`-m`, `-s/-d`, `--local`, or active connection) to a target | `--target-server <ws-or-endpoint>`, `--target-database <name>` (required when the source is remote; a local source falls back to the active connection), `--execute`, `--force` (skip the confirmation; **required in CI** together with `--non-interactive`), `--deploy-full`, `--deploy-connections`, `--deploy-partitions`, `--skip-refresh-policy`, `--deploy-roles`, `--deploy-role-members`, `--deploy-shared-expressions`, `--create-only`, `--skip-linguistic-metadata` (keep the target's AI instructions, AI data schema and Q&A synonyms; also with `--deploy-full`), `--skip-bpa`, `--fix-bpa`, `--bpa-rules <file>`, `--ci vsts\|github` (aliases `azdo`, `azure-devops`, `gh`), `-p, --profile <name>`. **Fails (exit non-zero, JSON `success: false`, reason in `error`) when the server accepts the metadata but parks objects with errors**; unprocessed objects are not a failure |
| `te refresh` | Refresh a deployed model | `--type full\|dataonly\|automatic\|calculate\|clearvalues\|defragment\|add` (default `automatic`), `--table <name>` (repeatable), `--partition Table.Partition` (repeatable, without `--table`), `--apply-refresh-policy true\|false\|<table>` (default: applied when a targeted table has a policy and type/scope allow it; off on Power BI Desktop), `--effective-date yyyy-MM-dd`, `--max-parallelism <N>`, `--execute` (asks for confirmation at a terminal, `n` default), `--force` (skip it; **required unattended**: redirected output, `--output-format json` or `--non-interactive` without `--force` is an error), `--no-progress`, `--trace [path]` (server-clock timings; stale `te-refresh-*` traces older than an hour are cleaned up) |

```bash
te deploy --model ./model --target-server ws --target-database model              # dry run: TMSL to stdout
te deploy --model ./model --target-server ws --target-database model > deploy.tmsl
te deploy --model ./model --target-server ws --target-database model --execute --force --ci github --non-interactive
te deploy --model ./model --target-server MY.SERVER.COM --target-database model --execute --force   # on-prem SSAS
te deploy -s src-ws -d src-model --target-server dst-ws --target-database copy --execute          # remote to remote
te deploy --local --target-server ws --target-database model --execute            # publish a Desktop model
te deploy --model ./model --profile staging --execute --force
te refresh --type full -s ws -d model                                             # dry run
te refresh --type full -s ws -d model --execute                                   # asks to confirm at a terminal
te refresh --type full -s ws -d model --execute --force --non-interactive         # CI form
te refresh --table Sales --type full --execute --force
te refresh --apply-refresh-policy Sales --effective-date 2026-03-01 --execute --force
te refresh --type full --execute --force --trace refresh.log --output-format json # JSON has progress[] and vertipaq[]
```

The BPA gate runs before `--execute` on deploy (and before `te save-as`); `bpa.onDeploy`/`bpa.onSave` config, `--skip-bpa`, `--fix-bpa`. `-p` on `te deploy` is `--profile`, not `--property`. Deploying a model onto itself is refused. `te deploy` JSON always includes the resolved `server` and `database`.

### Testing

Suite authoring (`.test.yaml`, assertions, tolerance, matrix expansion) is in testing.md. `run`, `snapshot` and `compare` execute DAX, so they need a deployed model.

| Command | Purpose | Key flags |
|---|---|---|
| `te test run` | Run DAX assertion tests | `--suite <path>` (default `.te-tests/`), `--tag <tag>`, `--fail-on error\|warning`, `--ci`, `--trx <file>`. Suites are validated before connecting; JSON is the findings envelope with `suites`, `invalidSuites`, `testSummary` |
| `te test init` | Scaffold suite | `--path <dir>`, `--example`, `--from-model` |
| `te test spec` | Print the test file format reference | n/a |
| `te test use [suite]` | Activate suite for the session; no arg clears | n/a |
| `te test list` (alias `ls`) | List tests without running | `--suite <path>` |
| `te test snapshot` | Capture / diff measure snapshots | `-o, --output-file <file>`, `--diff <baseline>`, `--tolerance <rel>`, `--measures <glob>`, `--table <name>`, `--suite <path>` |
| `te test compare` | A/B-compare two deployed models | `--source-a ws/model`, `--source-b ws/model`, `--auth-a`, `--auth-b`, `--suite`, `--tolerance` |

```bash
te test init --example
te test init --from-model --model ./my-model
te test run -s ws -d model --ci github --trx results.trx --output-format json
te test run --tag revenue
te test snapshot --output-file baseline.snapshot.json -s ws -d model
te test snapshot --diff baseline.snapshot.json --tolerance 0.01 -s ws -d model
te test compare --source-a prod-ws/model --source-b dev-ws/model --suite .te-tests
```

### Connection & Auth

Covered above; full synopsis:

```
te connect [<server> [<database>]] [--local] [-w/--workspace <path-or-server-db>] [--workspace-format tmdl|bim|database.json] [--workspace-auth <method>] [--force] [-p/--profile <name>] [--clear]
te auth login [-u <appId>] [-p <secret>|-] [-t <tenant>] [-I/--identity] [--certificate <path>] [--certificate-password <pw>]
te auth status | te auth logout
te profile {set|show|list|remove} <name> [...]
te session [show | list | clear | prune [--all] [--dry-run]]
```

#### Sessions

Each shell process gets a session file under `~/.config/te/sessions/<id>.json` holding the active connection, profile and test suite. The ID derives from the parent shell PID; set `TE_SESSION=<name>` to name a session and share it across shells or scripted tool calls. Dead-PID sessions are auto-cleaned on every invocation.

```bash
te session                              # current session (id, file, active state)
te session list
te session clear                        # reset connection / profile / suite for this shell
te session prune [--dry-run]            # delete sessions whose shell is dead
te session prune --all                  # every session except the current one
TE_SESSION=ci-deploy te connect ws model
```

`te connect`, `te test use` and `--profile` mutate the session file, not the global config; two terminals can hold different active connections. Configuration commands and keys: config-cicd-env.md.

### Utilities

`te util` never loads a model; `--model`, `-s/-d`, `--local`, `--recent` and `--auth` are rejected on it.

| Command | Purpose | Key flags |
|---|---|---|
| `te util format-dax <expr>` | Format loose DAX to stdout (`-` = stdin) | `--semicolons` (DAX **written with** semicolons; selects the dialect for input and output, so comma DAX fails under it; the only place the flag exists), `--long`, `--no-space-after-function`. JSON: `success`, `formatted`, `errors` |
| `te util format-m <expr>` | Format loose M to stdout (`-` = stdin) | none. A malformed expression fails non-zero and returns the original unchanged |
| `te util migrate [-FLAG]` | TE2 CLI flag → `te` mapping (full table or one flag) | `--output-format json` |

```bash
te util format-dax "SUM ( Sales[Amount] )"
cat query.dax | te util format-dax - --long
te util format-m "let a = 1 in a"
te util migrate -A
```

### Shell

| Command | Purpose |
|---|---|
| `te interactive` | Model-aware REPL (`te [MyModel]>`); also what bare `te` on a TTY launches (`launchInteractiveMode` config). Subcommands are typed without the `te` prefix and help renders them that way. Built-ins: `help`/`?`, `status`/`pwd`, `save`, `revert`, `clear`/`cls`, `exit`/`quit`/`q` (asks to confirm when staged edits are unsaved; `exit --force` discards them; Ctrl+D on an empty line also exits; Ctrl+C discards the half-typed line). Flags: `--no-banner`, `--echo`, `--batch` (exit non-zero on first failure; default when stdin is piped), `--no-batch` |
| `te completion <shell>` | Completion script for `bash`, `zsh`, `powershell` (alias `pwsh`), `fish` |

Inside the REPL, mutations **stage in memory**: `save` (no arguments) commits staged edits to the source, `revert` discards them, `save-as` re-serializes to another format/location; per-command `--save`/`--stage`/`--revert` override the `interactiveEditMode` default. The argv splitter is bracket-aware, so DAX-style refs need no escaping.

```bash
te interactive --model ./model
te interactive -s MyWorkspace -d MyModel
te> list Sa*
te> get "Sales/Revenue" -p Expression
te> get [Total Sales]
te> set Sales/Revenue -p FormatString="#,0"
te> add Perspectives/Default/Sales
te> bpa run --fail-on error
te> save
te> exit
```

**Batch mode** (redirected stdin): commands line-by-line, `#` comments, stops on the first failing command (unless `--no-batch`). End a mutating batch with `save`: reaching end of input with staged edits unsaved prints a warning naming them and exits non-zero (`exit --force` to discard on purpose):

```bash
te interactive --model ./model --no-banner --echo < script.te
cat <<'EOF' | te interactive --model ./model
# add a measure, then verify
add "_Measures/Revenue" -t Measure -p Expression="SUM(Sales[Amount])" --save
get "_Measures/Revenue" -p Expression
EOF
```
