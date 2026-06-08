---
name: te-cli
version: 26.24
description: CLI syntax reference for the cross-platform Tabular Editor CLI (`te`, built on Tabular Editor 3, currently in preview); subcommands for load/save, navigation, object CRUD, validation, BPA, DAX query, deploy, refresh, and C# scripting. Automatically invoke when the user mentions the `te` CLI, "Tabular Editor CLI", "TE3 CLI", te subcommands (te load, te deploy, te bpa run, te validate, te query, te script), or asks to "deploy a model from macOS or Linux", "run Tabular Editor from the command line cross-platform", "migrate from TabularEditor.exe to te", "use the new Tabular Editor CLI".
---

# Tabular Editor CLI (`te`)

Cross-platform command-line tool for Power BI and Analysis Services semantic models. The executable is `te`. It is built on .NET 8 and wraps TOMWrapper, the same abstraction layer that powers Tabular Editor 3, so model edits behave consistently with the desktop app.

This is a different product from `TabularEditor.exe` (the free, Windows-only TE2 CLI). For TE2 flag syntax see the sibling `te2-cli` skill.

## Preview status

`te` is in public preview until Q4 2026. It is the actively developed successor to the TE2 CLI; expect commands and flags to evolve before general availability. The TE2 CLI (`TabularEditor.exe`) remains supported and stable for existing pipelines.

Download per-platform preview binaries (macOS, Linux, Windows) from the downloads page: https://tabulareditor.com/download-tabular-editor-cli

## Mental model

Unlike the single-invocation TE2 CLI, `te` is a subcommand tool with optional persistent state:

- Each operation is its own subcommand (`te deploy`, `te bpa run`, `te validate`), rather than one invocation carrying every flag
- `te connect` persists an active connection across subsequent commands, so a server and database do not need repeating
- Most commands accept a model as the first positional argument or via `--model`; live targets use `--server`/`--database`, `--recent`, or the active connection
- Chain operations either with separate invocations (combine with `&&` for fail-fast) or inside a single `te script`

## Quick start

```bash
# Authenticate once; credentials are cached
te auth login

# Load and inspect a model on disk
te load ./model
te ls ./model
te get ./model Sales/Revenue

# Validate expressions and run the Best Practice Analyzer
te validate ./model
te bpa run ./model -r rules.json

# Add a measure with DAX, then persist
te add Sales/TotalRevenue -t Measure ./model -i "SUM(Sales[Revenue])" --save

# Deploy to Power BI
te deploy powerbi://api.powerbi.com/v1.0/myorg/Workspace MyModel ./model

# Format all DAX in a model
te format ./model --save

# Execute a C# script
te script ./model -s fix-formatting.csx --save
```

## Commands

### Model I/O

| Command | Description |
|---|---|
| `te load <model>` | Load a model and display a summary |
| `te save <model> <output>` | Save in a different format (BIM, TMDL, TE folder); can download from a live workspace via `-s`/`-d` |
| `te open <model>` | Open the model in Tabular Editor 3 desktop |

### Navigation and query

| Command | Description |
|---|---|
| `te ls [model]` | List objects with filesystem-like navigation |
| `te get <path> [model]` | Read properties of model objects |
| `te find <text> [model]` | Search text across model objects |
| `te replace <text> <replacement> [model]` | Find and replace text across objects |
| `te connect <server>` | Connect to a live server and inspect databases; sets the active connection |
| `te query <dax> [model]` | Execute DAX against deployed models |

### Object manipulation

| Command | Description |
|---|---|
| `te add <path> -t <type> [model]` | Add objects (measures, tables, relationships, roles, ...) |
| `te rm <path> [model]` | Remove objects with dependency checking |
| `te mv <source> <dest> [model]` | Move or rename objects |
| `te set <path> [model]` | Set properties on objects |

### Analysis and validation

| Command | Description |
|---|---|
| `te validate [model]` | Validate DAX expressions and relationship integrity |
| `te bpa run [model]` | Run Best Practice Analyzer rules |
| `te bpa rules` | List and manage BPA rules from all sources |
| `te vertipaq [model]` | Analyze VertiPaq storage statistics |
| `te deps <path> [model]` | Show measure dependency trees |
| `te diff <model-a> <model-b>` | Compare two models for structural differences |

### Execution and deployment

| Command | Description |
|---|---|
| `te deploy <server> <database> [model]` | Deploy to Analysis Services, Power BI, or Fabric |
| `te refresh <server> <database>` | Trigger a data refresh on a deployed model |
| `te script [model] -s <file>` | Execute C# scripts against a model |
| `te incremental-refresh` | Configure incremental refresh policies |

### Macros, config, and auth

| Command | Description |
|---|---|
| `te macro list / run / add / set / rm / sort` | Manage and run macros from TE3's MacroActions.json |
| `te config show / paths / init` | Inspect or create CLI configuration |
| `te auth login / status / logout` | Authenticate, check state, or clear cached credentials |
| `te migrate` | Reference guide for migrating from TE2 CLI flags |

## Global options

| Option | Description |
|---|---|
| `--model <path>` | Model path (TMDL folder, .bim, TE folder) |
| `--output-format <fmt>` | Stdout format: `text` (default), `json`, `csv`, `tmsl` (alias `bim`), `tmdl`; not every command supports every format |
| `--error-format <fmt>` | Stderr format for errors, warnings, and hints: `text` (default) or `json` |
| `--server <endpoint>` | Server connection string |
| `--database <name>` | Database name |
| `--local` | Use a local SSAS instance (Windows only) |
| `--auth <method>` | Auth method: `browser`, `spn`, `env`, `mi` |

## Configuration

The CLI reads optional config from `~/.config/te/config.json` (or the path in `$TE_CONFIG`). Key fields: `autoFormat`, `validateOnMutation`, `vertipaqOnRefresh`, a `bpa` block (`rules`, `onDeploy`, `onSave`, `onMutation`, `builtInRules`, `disabledBuiltInRuleIds`), and `formatOptions`. Run `te config init` to scaffold defaults and `te config paths` to see every resolved file location.

The CLI does not auto-detect a TE3 install. User file paths (macros, BPA rules) resolve in priority order: command-line flag, then environment variable (`TE_MACROS_PATH`, `TE_BPA_RULES`), then the config file.

## Post-mutation behavior

After any model edit (`te add`, `te set`, `te mv`, `te replace`, `te macro run`):

- TOM errors are always surfaced
- DAX validation runs by default (`validateOnMutation: true`); it is semantic analysis of expressions
- Auto-format is off by default (`autoFormat: false`); when on it uses the in-house DAX formatter (the same one TE3 desktop uses), unless `formatOptions.useSqlBiDaxFormatter: true` routes through daxformatter.com
- Save is blocked when a mutation introduces new DAX validation errors; pass `--force` to override. Pre-existing errors in the loaded model do not block; the gate only catches errors that this command introduces

## BPA gate

`te deploy` and `te save` run BPA checks before executing. The gate is controlled by config: `bpa.onDeploy`, `bpa.onSave`, and `bpa.onMutation` toggle when it runs; `bpa.rules` lists rule files or URLs; `bpa.builtInRules` includes the built-in set; `bpa.disabledBuiltInRuleIds` excludes specific rules (managed by `te bpa rules disable / enable`). Override per invocation with the `--skip-bpa` flag or a `.te-bpa.json` file in the model directory.

## Cross-platform support

| Capability | macOS / Linux | Windows |
|---|---|---|
| BIM/TMDL load and save | Yes | Yes |
| BPA analysis | Yes | Yes |
| Deploy to Power BI / Azure AS | Yes | Yes |
| C# scripting | Yes | Yes |
| DAX queries (cloud) | Yes | Yes |
| Auth (browser, SPN, env, MI) | Yes | Yes |
| Local SSAS (TCP) | No | Yes |
| Power BI Desktop connection | No | Yes |

## Coming from the TE2 CLI

Existing `TabularEditor.exe` pipelines map onto `te` subcommands flag by flag. A single TE2 invocation that scripts, analyzes, and deploys becomes several `te` commands (or one `te script`). For the complete flag-by-flag mapping, behavioral differences (for example `-O` overwrite is the default in `te`), and CI annotation equivalents, consult `references/te2-to-te3-migration.md`. The built-in `te migrate` command also translates a TE2 command string into the equivalent `te` commands.

## References

- **`references/te2-to-te3-migration.md`** - full TE2 to TE3 flag-by-flag migration and compatibility reference
- [Downloads (preview binaries)](https://tabulareditor.com/download-tabular-editor-cli)

To retrieve current XMLA and deployment docs, use `microsoft_docs_search` + `microsoft_docs_fetch` (MCP) if available, otherwise `mslearn search` + `mslearn fetch` (CLI).
