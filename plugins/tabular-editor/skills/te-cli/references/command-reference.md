# `te` command reference

Full command surface for the `te` CLI. Companion to the te-cli skill (SKILL.md). Configuration keys, CI/CD, output formats, and environment variables live in config-cicd-env.md.

## Installation

Download from https://tabulareditor.com (signed in with a TE account). Single self-contained binary; no .NET / runtime install needed.

| Platform | Archive | Install location (suggested) |
|---|---|---|
| Windows x64 / ARM64 | `te-win-x64.zip` / `te-win-arm64.zip` | `%LOCALAPPDATA%\Programs\te` |
| macOS Intel / Apple Silicon | `te-osx-x64.zip` / `te-osx-arm64.zip` | `~/.local/bin` |
| Linux x64 / ARM64 | `te-linux-x64.zip` / `te-linux-arm64.zip` | `~/.local/bin` |

Add the install dir to `PATH`. On macOS, allow first-run network access for Gatekeeper notarization check. Update by overwriting the binary; config and credentials persist.

**Shell completion**:
```bash
te completion bash > /etc/bash_completion.d/te
te completion zsh  > "${fpath[1]}/_te"
te completion pwsh | Out-String | Invoke-Expression
```

**Cross-platform limits**: local SSAS connections (TCP) and Power BI Desktop connections (named pipe) are Windows-only. All cloud workflows work on every platform.

## Authentication

Backed by Azure Identity's full credential chain.

| Method | Flag | When to use |
|---|---|---|
| Interactive browser | `--auth interactive` (default) | Local dev |
| Service principal (secret) | `--auth spn -u <appId> -p <secret> -t <tenant>` | Avoid; secret on cmd line |
| Service principal (cert) | `--auth spn -u <appId> -t <tenant> --certificate <path>` | Cert-based CI |
| Environment vars | `--auth env` (reads `AZURE_CLIENT_ID/SECRET/TENANT_ID`) | **Preferred for CI** |
| Managed identity | `--auth managed-identity` | Azure-hosted runners |

```bash
te auth login                            # browser
te auth login --identity                 # managed identity
te auth status                           # exit 0 if authenticated, 1 otherwise
te auth logout                           # clear cached credentials
```

**Credential cache locations** (all file-mode `0600` / DPAPI on Windows):
- Windows: `%USERPROFILE%\.te-cli\` (DPAPI-encrypted)
- Linux: `~/.te-cli/` (libsecret via Azure.Identity)
- macOS: `~/.te-cli/token-cache.bin`

## Connections and profiles

`te connect` sets a per-terminal active connection so subsequent commands don't need `-s/-d/-m` repeated.

```bash
te connect                               # show active connection (or open picker in interactive)
te connect MyWorkspace MyModel           # remote workspace
te connect ./my-model                    # local TMDL/BIM
te connect --local                       # running Power BI Desktop (Windows)
te connect --clear                       # reset
```

**Workspace mirroring** (bidirectional sync between local TMDL folder ↔ remote workspace):

```bash
te connect Finance "Revenue Model" -w ./revenue-model   # remote primary, mirror to local
te connect ./revenue-model -w Finance "Revenue Model"   # local primary, mirror to remote
# --workspace-format <bim|tmdl|te-folder>  # on-disk format for the mirror
# --workspace-auth <method>                # auth for the remote side when primary is local
```

**Profiles** save named connection + behavior overrides:
```bash
te profile set prod -s MyWorkspace -d MyModel --auto-format true
te profile set dev  -s DevWorkspace -d MyModel --bpa-on-deploy false
te profile list
te profile show prod
te profile remove old
te connect --profile prod
```

## Object path syntax

Backed by a formal grammar (`PathParser`); paths come in two flavors with subtly different rules:

**Object paths**; used by `te get`, `te set`, `te add`, `te rm`, `te mv`. Resolve to **one** object. Wildcards rejected.

**Filter paths**; used by `te ls`, `te find`, `te deps`, `te bpa run --path`. Resolve to a **set** of objects. Wildcards allowed.

### Slash-form (works on both)

- `Sales`; table
- `Sales/Revenue`; measure or column on the Sales table
- `Sales/Measures`, `Sales/Columns`, `Sales/Partitions`, `Sales/Hierarchies`; sub-containers
- `Sales/Geography/Levels`; hierarchy levels
- `Measures/<name>/KPI`; KPI sub-object on a measure (resolves through the KPI wrapper)
- `Roles/<role>/Members`, `Roles/<role>/TablePermissions`; role children
- `Perspectives/<persp>/<table>`; perspective membership (use `te add Perspectives/Default/Sales` to add a table)
- `Tables`, `Measures`, `Roles`, `Perspectives`, `Cultures`, `Hierarchies`, `Annotations`; model-level containers (pivot via `te ls Measures` for cross-table view)
- `Relationships` is **not** enumerable via `te ls`, despite `relationship` appearing in `te ls --type`'s help. The keyword falls through to a literal path match and errors with `No objects match path 'Relationships'`, even when relationships exist (recognized-but-empty containers say `No objects match 'X'` without the word `path`). List relationships with DAX `EVALUATE INFO.VIEW.RELATIONSHIPS()` (or `INFO.RELATIONSHIPS()` on older compat), or `te save` to TMDL and read `relationships.tmdl`. A single relationship is still addressable once you know its name: `te get Relationships/<name>`.

Container-keyword table names (a table called `Tables`, `Roles`, etc.) resolve correctly via the path parser; the parser disambiguates by position.

### DAX-form (object paths)

DAX-style quoting and bracket-suffix follow DAX conventions; doubled quote char escapes itself (`'Bob''s'` = `Bob's`, `[foo]]bar]` = `foo]bar`):

- `'Sales'[Amount]`; same as `Sales/Amount`
- `"Net Sales"[Sales Amount]`; same as `"Net Sales"/"Sales Amount"`, double-quoted form
- `[Total Sales]`; **model-wide measure-or-column lookup** (no table prefix; resolver searches every table)
- `"Sales[ProdKey]->Product[ProdKey]"`; relationship shorthand (used by `te add` only)
- `"Sales 2024"/Revenue`, `"_Measures/Total Revenue"`; quote any segment that contains a space, `/`, `[`, or `]`

### Wildcards (filter paths only)

Single `*` matches any run of characters within one segment (case-insensitive). Multi-segment globs and `?` are not supported.

```bash
te ls Sa*                       # tables starting with "Sa"
te ls Sales/*Amount             # any child of Sales ending in "Amount"
te ls */Amount                  # an "Amount" column/measure across every table
te ls Roles/Re*/Members         # members of every role matching Re*
te bpa run --path "Sales/*"     # run BPA only on objects under Sales
```

Passing a wildcard to an object-path command (`te get Sa*`, `te set Sa*`) fails fast with a parser error; wildcards on those would resolve to many objects, and the command needs exactly one.

## Global options

Work with every command:

| Option | Description |
|---|---|
| `-m, --model <path>` | TMDL folder, `.bim`, or TE folder |
| `-s, --server <endpoint>` | Workspace name, `powerbi://...`, `asazure://...`, `localhost:PORT` |
| `-d, --database <name>` | Semantic model name on workspace |
| `--local` | Connect to running Power BI Desktop (Windows only) |
| `--auth <method>` | `auto` \| `interactive` \| `spn` \| `env` \| `managed-identity` |
| `--output-format <fmt>` | `auto` \| `text` \| `json` \| `csv` \| `tmsl` (alias `bim`) \| `tmdl` (default `auto`: text on TTY, JSON when piped). Controls how stdout is rendered; distinct from `--serialization` which picks the on-disk model format |
| `--recent [N]` | Use recently-used model (no value = picker, `N` = Nth most recent) |
| `--non-interactive` | Disable prompts; fail if input missing; **set in CI** |
| `--debug` | Debug logs to stderr |

**Note:** `--output-format` (how stdout is rendered) and `--serialization` (how models are written to disk on `init`/`save`/etc.) are **two different flags**. Don't conflate them; passing one when the other was meant gives a confusing error or silent wrong output.

## Command reference (10 families)

### Model I/O

| Command | Purpose | Key flags |
|---|---|---|
| `te load <path>` | Load model and show summary | global `-m/-s/-d` |
| `te save` | Save / convert / persist edits | `-o, --output-path <path>`, `--serialization tmdl\|bim\|te-folder\|pbip\|database.json`, `--force`, `--skip-bpa`, `--fix-bpa`, `--bpa-rules <file>` (repeatable, overrides config), `--skip-validation`, `--supporting-files` |
| `te open <path>` | Open in TE3 Desktop (TE3 must be installed) | n/a |
| `te init [path]` | Create new empty model. Path is optional; falls back to global `--model` when omitted | `--compatibility-mode PowerBI\|AnalysisServices` (default `PowerBI`), `--compatibility-level <int>` (alias `--compat`; defaults to 1702 for PowerBI, 1500 for AnalysisServices), `--name <model-name>`, `--serialization tmdl\|bim\|te-folder\|pbip` (default `tmdl`), `--force` |

```bash
te load ./model                                                  # local TMDL folder
te load model.bim                                                # local BIM file
te load -s MyWorkspace -d MyModel                                # remote

te save                                                          # write back to source
te save ./model.bim -o ./tmdl-out                                # convert BIM → TMDL
te save -o ./project --serialization pbip --supporting-files
te save -o ./out -s ws -d model --skip-validation                # fast passthrough

te init ./my-model                                               # PowerBI mode, TMDL, compat 1702 (default)
te init ./my-model --compatibility-mode AnalysisServices         # AS mode, compat 1500
te init ./my-model --compatibility-level 1604                    # specific compat level
te init ./my-model --serialization bim                           # single-file .bim model
te init ./my-model --serialization pbip                          # full Power BI project structure
te --model ./new.bim init                                        # path via global --model
```

### Model Editing

| Command | Purpose | Key flags |
|---|---|---|
| `te set <obj>` | Set property | `-q <prop>` (e.g. `expression`, `formatString`, `description`, `isHidden`), `-i <value>` (or `-` for stdin), `--save`, `--save-to <path>` |
| `te add <obj>` | Add object | `-t <type>` (`Table`, `Measure`, `Column`, `CalculatedColumn`, `CalculatedTable`, `Hierarchy`, `Role`, `Perspective`, `Culture`, `CalculationGroup`, `CalculationItem`, `MPartition`, `Partition`, `EntityPartition`, `PolicyRangePartition`, `KPI`, `NamedExpression`, ...), `-i <value>`, `--if-not-exists` (idempotent), `--save`. Data-bound tables: `--mode import\|directquery\|directlake`, `--source sql\|lakehouse\|warehouse`, `--endpoint`, `--source-table`, `--source-database`, `--columns "Col1:Type,Col2:Type,..."`, `--partition-expression "<M>"`, `--source-type m\|query\|calculated` |
| `te rm <obj>` | Remove object | `--force`, `--if-exists`, `--dry-run`, `--save` |
| `te mv <src> <dst>` | Move/rename | `--save` |
| `te replace <find> <repl>` | Find+replace text | `--in names\|expressions\|descriptions\|displayFolders\|formatStrings\|annotations\|all`, `--regex`, `--case-sensitive`, `--save` (dry-run by default) |

```bash
te set Sales/Amount -q expression -i "SUM(Sales[Amt])" --save
te set Sales -q isHidden -i true --save
te add Sales/Revenue -t Measure -i "SUM(Sales[Amount])" --save
te add Sales -t Table --save                                              # empty M partition (PowerBI default)
te add "Sales[ProdKey]->Product[ProdKey]" --save                          # relationship shorthand
te add Sales/MarketingFlag -t CalculatedColumn -i "..." --if-not-exists --save
te rm Sales/OldMeasure --if-exists --save
te rm Sales/Revenue --dry-run                                             # preview impact
te mv Sales/Revenue Finance/Revenue --save                                # cross-table move
te replace "OldTable" "NewTable" --in expressions --save
te replace "SUM" "SUMX" --regex --in expressions --save
```

#### Common `-q` properties

Property names are case-insensitive and match TOM. When in doubt, run `te get <obj>` to see what's already on the object, or check `te set <obj> -q` for the settable list. The most-used ones:

| Object | Common properties |
|---|---|
| **Measure** | `expression` (DAX), `formatString`, `displayFolder`, `description`, `isHidden` |
| **DataColumn** | `dataType` (`int64`/`string`/`double`/`decimal`/`dateTime`/`boolean`), `sourceColumn`, `summarizeBy` (`none`/`sum`/`count`/`average`/`max`/`min`/`distinctCount`/`automatic`), `isKey`, `isHidden`, `formatString`, `sortByColumn`, `dataCategory`, `displayFolder`, `description` |
| **CalculatedColumn** | `expression` (DAX) plus most DataColumn properties |
| **MPartition** | **`MExpression`** (NOT `expression`; that's what `te get` displays, but `te set` rejects it), `Mode` (`Import`/`DirectQuery`/`DirectLake`/`Default`), `description` |
| **QueryPartition** | `QueryDefinition` (alias `Query`), `Mode`, `description` |
| **Table** | `isHidden`, `dataCategory` (use `Time` to mark a date table), `description`, `name` (rename) |
| **Hierarchy** | `displayFolder`, `description`, `isHidden`; Levels take `column` (the source column name) |
| **ModelRole** | `modelPermission` (`None`/`Read`/`ReadRefresh`/`Refresh`/`Administrator`); TablePermissions take `filterExpression` (DAX) |
| **KPI** (on a Measure path `Measures/<name>/KPI`) | `statusExpression`, `trendExpression`, `targetExpression`, `statusGraphic`, `trendGraphic` |
| **CalculationItem** | `expression` (DAX), `ordinal` (int), `formatStringDefinition` |
| **Annotations / Translations** | `Annotations[<key>]`, `TranslatedNames[<culture>]`, `TranslatedDescriptions[<culture>]`; bracket-indexed property names |

Properties not in the list are still usable; these are the most error-prone and frequently needed ones. **`te get <obj>` is always the authoritative discovery tool** for what an existing object exposes.

### Inspection

| Command | Purpose | Key flags |
|---|---|---|
| `te ls [filter-path]` | List objects, FS-style (filter-path: wildcards allowed) | `--type <type>`, `--paths-only`, `--no-multiline` (collapse multi-line cells; text output only) |
| `te get <obj>` | Get properties (object-path: no wildcards) | `-q <prop>` (single property), `--output-format tmdl\|tmsl\|bim` (emit object as TMDL/TMSL) |
| `te find <text>` | Search across model | `--in names\|expressions\|descriptions\|displayFolders\|formatStrings\|annotations\|all`, `--regex`, `--case-sensitive`, `--paths-only`, `--no-multiline`. **`--in expressions` walks every `IExpressionObject`**; measure DAX, calculated columns, KPI status/trend/target expressions, measure detail-rows, partition M, table-permission filters, calculation-group selection expressions |
| `te diff <m1> <m2>` | Structural diff | exit 0 identical, 2 models differ, 1 error |
| `te deps [obj]` | Dependency analysis | `--unused` (no DAX refs, not in relationships/hierarchies/sort-by/variations/time roles), `--hidden` (narrow to hidden), `--deep`, `--upstream`, `--downstream`, `--max-depth <N>` |

```bash
te ls                                # tables
te ls Sales                          # columns + measures in Sales
te ls Sales/Measures                 # measures only
te ls Measures                       # all measures across model
te ls --type measure --paths-only    # pipeable
te get Sales/Revenue -q expression
te get Model -q description
te find "CALCULATE" --in expressions                # covers DAX, calc-columns, KPI exprs, partition M, role filters, calc-group selection
te find "Revenue" --in names
te find "TODO" --in descriptions --no-multiline     # single-line cells, easy to grep
te find 123 --in expressions --paths-only           # pipeable, e.g. for finding a KPI TargetExpression value
te diff ./model-v1 ./model-v2
te deps "Sales/Revenue"                             # upstream + downstream
te deps --unused                                    # unused everywhere
te deps --unused --hidden                           # hidden + unused
```

### Analysis & Quality

| Command | Purpose | Key flags |
|---|---|---|
| `te validate` | Expressions + schema + TOM errors | `--ci <fmt>` (see below), `--trx <file>`, `--no-multiline`, `--no-warnings`, `--no-antipatterns`, `--errors-only` |
| `te bpa run [model]` | Run BPA (optional positional model path) | `-r/--rules <file-or-url>` (repeatable; URLs supported), `--fix`, `--save`, `--save-to <path>`, `--serialization`, `--fail-on error\|warning`, `--ci`, `--trx`, `--no-defaults`, `--no-model-rules`, `--rule <id>` (repeatable), `--path <filter>` (wildcards OK: `--path "Sales/*"`), `--vpax <file>`, `--vpa-rules`, `--allow-external-rules` (allow URL rules from model annotations), `--no-multiline` |
| `te bpa rules list` | Inspect active rules | `--all` (incl. disabled+ignored), `--ignored`, `--no-multiline` |
| `te vertipaq [path]` | VertiPaq stats (optional positional object path, e.g. `Sales` or `Sales/Amount`) | `--columns`, `--relationships`, `--partitions`, `--all`, `--detail` (encoding/segments breakdown), `--fields <csv>` (custom column set), `--export <vpax>`, `--import <vpax>` (offline), `--obfuscate` (writes `.vpax.dict` sidecar), `--top <N>`, `--stats` (DAX-queried details), `--annotate`, `--save` |
| `te format` | Format DAX or M | `-e <text>` (inline), `-p <obj>` (single), `--lang dax\|m`, `--semicolons` (Euro), `--long` (more line breaks; default is short), `--no-space-after-function`, `-t/--type <kind>` (disambiguate `-p` when path matches multiple), `--save`, `--save-to <path>` |

```bash
te validate ./model --ci github --trx results.trx
te validate ./model --errors-only                   # hide warnings + anti-patterns
te bpa run --fail-on error --ci github
te bpa run --fix --save
te bpa run --rule PERF_UNUSED_HIDDEN_COLUMN
te bpa rules list --all
te vertipaq --all --export stats.vpax
te vertipaq Sales                                    # filter to one table
te vertipaq Sales/Amount                             # filter to one column
te vertipaq --columns --detail                       # encoding/segment breakdown
te vertipaq --fields name,card,size,%tbl,%db,bar     # custom column set
te vertipaq --import stats.vpax                      # offline analysis from VPAX
te format --save                                     # all DAX
te format -p Sales/Amount --save                     # single measure
te format --lang m --save                            # all M
te format -e "SUM ( Sales[Amount] )"                 # inline preview
```

### Execution

| Command | Purpose | Key flags |
|---|---|---|
| `te query` | DAX query | `-q <dax>` or `-f <file.dax>`, `--limit <N>` (default 100), `-o, --output-file <file>` (extension picks format: `.csv\|.tsv\|.json\|.dax`), `--trace`, `--cold`, `--plan`, `--runs <N>` (benchmark), `--no-validate` |
| `te script` | Run C# script (TOM) | `-S <file>` (repeatable, `.cs`/`.csx`), `-e <code>` (inline, `-` = stdin), `--save`, `--save-to`, `--serialization`, `--dry-run`, `--timeout <s>` |
| `te macro <sub>` | TE3 macros | `list`, `run <name-or-id>` (with `--on <obj-paths>`, `--save`), `add`, `set`, `rm`, `sort` |

```bash
te query -q "EVALUATE TOPN(5, 'Sales')" -s ws -d model
te query -f query.dax --output-format json                       # global --output-format controls stdout format
te query -q "EVALUATE Sales" --output-file results.csv           # writes CSV/TSV/JSON/DAX based on extension
te query -q "EVALUATE Sales" --runs 5 --cold --plan
te script -S fix.cs --save
te script -e "Info(Model.Tables.Count)"
echo "Info(Model.Name);" | te script -e -
te macro list
te macro run "Hide all measures"
te macro run "Format DAX" --on "Sales/Revenue,Sales/Margin" --save
```

### Deployment & Refresh

| Command | Purpose | Key flags |
|---|---|---|
| `te deploy` | Deploy model | `-s/-d`, `--deploy-full` (overwrite + connections + partitions + roles + members + shared exprs), `--deploy-connections`, `--deploy-partitions`, `--skip-refresh-policy`, `--deploy-roles`, `--deploy-role-members`, `--deploy-shared-expressions`, `--create-only` (fail if exists), `--xmla <file>` (TMSL only, `-` for stdout), `--skip-bpa`, `--fix-bpa`, `--bpa-rules <file>` (repeatable), `--force` (**required for CI**), `--ci <fmt>`, `-p, --profile <name>` |
| `te refresh` | Trigger refresh | `--type full\|dataonly\|automatic\|calculate\|clearvalues\|defragment\|add` (default `automatic`), `--table <name>` (repeatable), `--partition <Tbl.Part>` (repeatable), `--apply-refresh-policy true\|false` (default true), `--effective-date yyyy-MM-dd`, `--max-parallelism <N>`, `--dry-run` (emit TMSL), `--no-progress`, `--trace [path]` (no value = stderr; with path = log file) |
| `te incremental-refresh <sub> <table>` | Manage IR policies | `show`, `set`, `remove`, `apply` (re-evaluate policy and create/expand partitions) |

```bash
te deploy ./model -s ws -d model --force --ci github
te deploy ./model --xmla script.tmsl                # generate TMSL only
te deploy ./model --xmla -                          # TMSL to stdout
te deploy ./model --profile staging --force
te refresh --type full
te refresh --table Sales --partition "Sales.2024" --type full
te refresh --type full --dry-run > refresh.tmsl
te refresh --type full --trace                      # XMLA trace events to stderr
te refresh --type full --trace refresh.log          # XMLA trace events to log file
te incremental-refresh show Sales
te incremental-refresh apply Sales                  # re-evaluate policy, create/expand partitions
```

### Testing

| Command | Purpose | Key flags |
|---|---|---|
| `te test run` | Run DAX assertion tests | `--suite <path>` (default `.te-tests/`), `--tag <tag>`, `--fail-on error\|warning`, `--ci`, `--trx <file>` |
| `te test init` | Scaffold suite | `--example`, `--from-model --model <path>` |
| `te test spec` | Print assertion format | n/a |
| `te test use <suite>` | Activate suite (session-scoped) | n/a |
| `te test list` | List test cases | n/a |
| `te test snapshot` | Capture model snapshot | n/a |
| `te test compare` | Compare snapshots | n/a |

```bash
te test init --example
te test init --from-model --model ./my-model        # generate stubs from model
te test run --ci github --trx results.trx
te test run --tag revenue
te test snapshot
te test compare
```

### Connection & Auth

(Covered above under [Authentication](#authentication) and [Connections and profiles](#connections-and-profiles).) Full subcommands:

```
te connect [<server> <database>] [--local | -w/--workspace <path-or-server-db> | --workspace-format bim|tmdl|te-folder | --workspace-auth <method> | --force | -p/--profile <name> | --clear]
te auth login [-u <appId>] [-p <secret>|-] [-t <tenant>] [--identity|-I] [--certificate <path>] [--certificate-password <pw>] [--save] [--auth interactive|spn|env|managed-identity]
te auth status
te auth logout
te profile {set|show|list|remove} <name> [...]
te session [show | list | clear | prune [--all] [--dry-run]]
```

#### Sessions

Every shell process gets its own session file under `~/.config/te/sessions/<id>.json`, holding the active connection, active profile, active test suite, and timestamps. Default session ID is derived from the parent shell PID; set `TE_SESSION=<name>` to name a session and share it across multiple shells or scripts. Sessions for dead PIDs are auto-cleaned on each invocation; `te session prune` triggers cleanup manually (or with `--all`, drop every session except the current one).

```bash
te session                              # show current session (id, file, active state)
te session list                         # all session files on this machine
te session clear                        # reset active connection / profile / test suite for this shell
te session prune                        # delete sessions whose shell process is dead
te session prune --dry-run              # preview what would be deleted
te session prune --all                  # delete every session except current (incl. named TE_SESSION ones)
TE_SESSION=ci-deploy te connect ws md   # share session under name "ci-deploy"
```

Why it matters: `te connect`, `te test use`, and `--profile` all mutate the session file, not the global config. Two terminals can hold different active connections without stepping on each other.


> Configuration commands and the full key table: see config-cicd-env.md.

### Shell

| Command | Purpose |
|---|---|
| `te interactive [model]` | Model-aware REPL; prompt is `te [MyModel]>` or `te>`. All subcommands work without `te` prefix. Built-ins: `help`/`?`, `status`/`pwd`, `clear`/`cls`, `exit`/`quit`/`q` |
| `te completion <shell>` | Print completion script (`bash`, `zsh`, `pwsh`) |

The REPL's argv splitter is bracket-aware, so DAX-style refs work without escaping the brackets; handy for paste-from-DAX-editor workflows:

```bash
te interactive
te interactive ./model
te interactive -s MyWorkspace -d MyModel
te> ls Sales
te> ls Sa*                              # wildcard filter-paths
te> get "Sales/Revenue" -q expression
te> get [Total Sales]                   # lone-bracket: model-wide measure/column lookup
te> get 'Sales'[Amount]                 # DAX-quoted form
te> ls Roles/Reader/Members             # role members
te> add Perspectives/Default/Sales      # add Sales table to the Default perspective
te> bpa run --fail-on error
te> exit
```

