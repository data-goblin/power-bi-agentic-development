# TE2 to TE3 CLI migration and compatibility

Mapping between the Tabular Editor 2 CLI (`TabularEditor.exe`) and the cross-platform Tabular Editor CLI (`te`). Use this when porting existing CI/CD pipelines or translating a single TE2 invocation into `te` subcommands.

## Architecture differences

| Aspect | TE2 CLI (`TabularEditor.exe`) | TE3 CLI (`te`) |
|---|---|---|
| Paradigm | Single command, all flags | Subcommands (`te deploy`, `te bpa run`, ...) |
| State | Stateless; everything on one invocation | Stateful; `te connect` persists the active connection |
| Model loading | Positional args: `file`, or `server database` | `--model`, `--server`/`--database`, `--recent`, or active connection |
| Platform | Windows only | macOS, Linux, Windows |
| Auth | Integrated Windows + `-L user pass` | `--auth browser|spn|env|mi` |
| Output | Console + CI annotations | `--output-format text|json|csv|tmsl|tmdl` plus `--error-format`, with CI annotations |
| Chaining | All operations in one invocation | Separate invocations, or `te script` for chaining |

### TE2 invocation pattern

```bash
TabularEditor.exe Model.bim -S script.csx -A rules.json -D server database -O -C -P -R -M -V -T results.trx
```

### TE3 equivalent (multiple invocations)

```bash
te script --model Model.bim -s script.csx --save
te bpa run --model Model.bim -r rules.json --ci vsts --trx results.trx --fail-on error
te deploy --model Model.bim -s server -d database --deploy-connections --deploy-partitions --deploy-roles --deploy-role-members
```

## Flag-by-flag migration

### Model loading

| TE2 | TE2 long | TE3 equivalent | Status | Notes |
|---|---|---|---|---|
| `file` (positional) | | `--model <path>` or positional | Supported | `te` accepts the model as the first positional arg on most commands |
| `server database` (positional) | | `-s <server> -d <database>` | Supported | Or set an active connection with `te connect` |
| `-L` | `-LOCAL` | `--local` | Supported | Windows only; auto-detects PBI Desktop instances |
| `-L user pass` | `-LOGIN user pass` | `--auth env` + env vars | Changed | `te` reads `AZURE_USERNAME`/`AZURE_PASSWORD` instead of inline credentials |

### Script execution

| TE2 | TE2 long | TE3 equivalent | Status | Notes |
|---|---|---|---|---|
| `-S script.csx` | `-SCRIPT` | `te script -s script.csx` | Supported | |
| `-S script1 script2` | `-SCRIPT` | `te script -s script1.csx -s script2.csx` | Supported | Repeat `-s` instead of space-separating |
| `-S "inline code;"` | `-SCRIPT` | `te script -e "inline code;"` | Supported | `-e` for expressions, `-s` for files |
| (stdin) | | `te script -e -` | New | `te` can read a script from stdin |

### Schema validation

| TE2 | TE2 long | TE3 equivalent | Status | Notes |
|---|---|---|---|---|
| `-SC` | `-SCHEMACHECK` | `te validate` | Supported | Separate command in `te` |

### Best Practice Analyzer

| TE2 | TE2 long | TE3 equivalent | Status | Notes |
|---|---|---|---|---|
| `-A` | `-ANALYZE` | `te bpa run` | Supported | Uses built-in plus model rules by default |
| `-A rules.json` | `-ANALYZE` | `te bpa run -r rules.json` | Supported | `-r` is repeatable for multiple rule files |
| `-A https://...` | `-ANALYZE` | `te bpa run -r https://...` | Supported | URLs work with `-r` |
| `-AX` | `-ANALYZEX` | `te bpa run --no-model-rules` | Supported | Excludes model annotation rules |
| `-AX rules.json` | `-ANALYZEX` | `te bpa run -r rules.json --no-model-rules` | Supported | |

### Build and save formats

| TE2 | TE2 long | TE3 equivalent | Status | Notes |
|---|---|---|---|---|
| `-B output.bim` | `-BIM` / `-BUILD` | `te save -o output.bim --serialization bim` | Supported | |
| `-B output.bim id` | `-BIM` | `te save -o output.bim --serialization bim` | Partial | Database ID override not yet exposed as a flag |
| `-F output/` | `-FOLDER` | `te save -o output/ --serialization te-folder` | Supported | TE folder format (database.json) |
| `-TMDL output/` | | `te save -o output/ --serialization tmdl` | Supported | TMDL is the default format in `te` |

### CI output formats

| TE2 | TE2 long | TE3 equivalent | Status | Notes |
|---|---|---|---|---|
| `-V` | `-VSTS` | `--ci vsts` | Supported | On `te bpa run`, `te deploy`, `te validate` |
| `-G` | `-GITHUB` | `--ci github` | Supported | On `te bpa run`, `te deploy`, `te validate` |
| `-T results.trx` | `-TRX` | `--trx results.trx` | Supported | On `te bpa run`, `te validate` |

### Deployment

| TE2 | TE2 long | TE3 equivalent | Status | Notes |
|---|---|---|---|---|
| `-D server database` | `-DEPLOY` | `te deploy -s server -d database` | Supported | |
| `-D` (no args, save back) | `-DEPLOY` | `te save` | Supported | Different command in `te` |
| `-O` | `-OVERWRITE` | (default) | Changed | `te` deploys as CreateOrAlter by default; use `--create-only` for create-only |
| `-C` | `-CONNECTIONS` | `--deploy-connections` | Supported | |
| `-C plch1 val1 ...` | `-CONNECTIONS` | `--deploy-connections` | Gap | Connection-string placeholder replacement not yet implemented |
| `-P` | `-PARTITIONS` | `--deploy-partitions` | Supported | |
| `-Y` | `-SKIPPOLICY` | `--skip-refresh-policy` | Supported | Valid only with `--deploy-partitions` |
| `-R` | `-ROLES` | `--deploy-roles` | Supported | Default: true, as in TE2 |
| `-M` | `-MEMBERS` | `--deploy-role-members` | Supported | |
| `-X xmla.tmsl` | `-XMLA` | `--xmla xmla.tmsl` | Supported | Use `-` for stdout |
| `-W` | `-WARN` | (implicit) | Changed | `te` always outputs warnings |
| `-E` | `-ERR` | (implicit) | Changed | `te` returns exit code 1 on errors by default |

### Help

| TE2 | TE3 equivalent | Notes |
|---|---|---|
| `-?` / `/?` / `-H` / `HELP` | `te --help` or `te <command> --help` | Per-command help in `te` |

## Known gaps during preview

These TE2 behaviors are not yet at full parity in the `te` preview:

- TE2 compatibility mode that parses a full TE2-style single-line invocation
- Connection-string placeholder replacement (`-C plch1 val1 ...`) during deploy
- Database ID override on save (`-B output.bim myDatabaseId`)
- A single invocation that scripts, analyzes, and deploys together; `te` runs these as separate commands or one `te script`

## Capabilities beyond TE2

`te` adds functionality the TE2 CLI never had:

- Persistent connections (`te connect`)
- Data refresh with progress and XMLA trace (`te refresh`)
- DAX query execution with benchmarking and query plans (`te query`)
- VertiPaq analysis, VPAX export/import (`te vertipaq`)
- Direct object CRUD (`te add`, `te rm`, `te mv`, `te set`, `te get`)
- Find and bulk replace across expressions (`te find`, `te replace`)
- DAX and M formatting with save (`te format`)
- Dependency trees (`te deps`) and structural diff (`te diff`)
- Workspace download (`te save -s <ws> -d <model>`)
- Macro execution (`te macro`)
- BPA auto-fix (`te bpa run --fix`) and deploy/save gating (`--skip-bpa`)
- Machine-readable output (`--output-format json|csv`) on most commands
- Incremental refresh policy management (`te incremental-refresh`)
- Persistent config and multi-method auth with token caching (`te config`, `te auth`)

## `te migrate`

`te migrate` translates a TE2 command string into the equivalent `te` commands and warns about behavioral differences. Example:

```bash
te migrate "-S fix.csx -A rules.json -B output.bim -D server db -O -C -P -R -M -V -T results.trx"
```

Output is a numbered list of equivalent `te script`, `te bpa run`, and `te deploy` commands, plus notes such as "`-O` (overwrite) is the default in `te`; use `--create-only` to change".
