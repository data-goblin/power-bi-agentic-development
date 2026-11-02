---
name: te-cli
description: Expert guidance for the cross-platform Tabular Editor CLI (the `te` binary, in preview) that manages Power BI and Analysis Services semantic models from the terminal on macOS, Linux and Windows. Use when the user mentions the `te` CLI or Tabular Editor CLI, runs a `te` command, or wants to scaffold, inspect, edit, validate, run BPA on, query, deploy, refresh or migrate a semantic model from a terminal or CI pipeline. Also use for DAX regression tests, measure contracts and invariants, data quality and orphan-key checks, snapshot baselines or A/B comparison of two deployed models, even when the user does not name `te`. Not for the legacy Windows-only TabularEditor.exe (TE2).
---

# Tabular Editor CLI (`te`)

To get the `te` CLI yourself (as the agent), see [references/get-te-cli.md](references/get-te-cli.md).

The `te` CLI is a single self-contained binary that loads, edits, validates, deploys, refreshes, and tests semantic models against TMDL/BIM files, Power BI Desktop, and cloud workspaces (Power BI, Fabric, Azure AS, SSAS). It is built on the same TOMWrapper that powers Tabular Editor 3, so model edits behave like the desktop app.

**Always pass `--output-format json`** when driving `te` programmatically. The default text/table output uses tables and ANSI styling that mangle in agent transcripts; JSON is parseable and avoids rendering issues.

**Limited public preview.** Preview builds stop functioning after 2026-12-31. No license is required during preview. Issues and feedback: https://github.com/TabularEditor/CLI

**Not the TE2 CLI.** This is a different product from the legacy Windows-only `TabularEditor.exe` (TE2). If the user invokes TE2 flag syntax (`-D`, `-S`, `-A`, `-B`, `-TMDL`, `-O`, `-C`, `-V`, `-G`), route it through the compat layer (`TE_COMPAT=te2`) or invoke `TabularEditor.exe` directly. See `references/te2-migration.md`.

## When to use this skill

- The user mentions "te CLI", "the new Tabular Editor CLI", or runs a `te <command>` in a terminal
- The user wants to scaffold, inspect, edit, validate, deploy, refresh, query, or test a semantic model from the terminal on any OS
- The user wants to convert TMDL, BIM, or PBIP, run BPA, or format DAX from the command line
- The user wants to set up a DAX regression test suite, snapshot baselines, or A/B-compare two deployed models
- The user is building a CI/CD pipeline (GitHub Actions or Azure DevOps) that validates, tests, or deploys a semantic model to Power BI / Fabric
- The user is migrating CI/CD pipelines from `TabularEditor.exe` (TE2) to `te`

## When NOT to use this skill

- The user explicitly wants to run `TabularEditor.exe` natively (TE2); use that product directly
- The user asks about Tabular Editor 3 desktop UI features (Preferences.json, MacroActions.json, Layouts.json); consult https://docs.tabulareditor.com/
- The user wants help authoring a C# script body or a BPA rule expression itself rather than running it; use the `c-sharp-scripting` and `bpa-rules` skills

## Critical general rules

- First use in a session: run `te --version` and `te auth status`. If not authenticated, ask the user to run `te auth login`.
- Run `te --help` and `te <command> --help` the first time composing a command; flags are still evolving during preview.
- **The model is always a flag, never a trailing path.** Pass `--model <path>` (`-m`) for a local model, or `-s <server> -d <database>` for a deployed one, on every command. `te get Sales/Amount ./model` is rejected with `Unrecognized positional argument`; write `te get Sales/Amount --model ./model`.
- **Properties are `-p Name=Value`.** Read with `te get <path> -p Expression`, write with `te set <path> -p Expression="..."`, repeat `-p` for several properties, or drop the flag on `set` (`te set Sales/Amount Description="Net" FormatString="#,0"`). The old `-q <name> -i <value>` pair no longer exists. **Discover the names first**: `te get <path> --properties --output-format json` lists every property `-p` accepts on that object with its type, writability and allowed values; an unknown name in an error points at the same listing. Clear a property with `--unset <Name>` (or `-p Name=null`); a piped value (`-p Name=-`) is stored verbatim.
- `te connect` state is per-shell-session and does NOT survive across separate Bash tool calls (each call is a fresh shell). Pass `--model` (and `-s`/`-d` for remote) on every command, or set `TE_SESSION=<name>` before the first call to share state.
- **Every mutation is a dry run until `--save`.** `te set`, `te add`, `te remove`, `te move`, `te script`, `te macro run`, and `te bpa run --fix` apply the change in memory, print a before/after diff, and end with `Dry run - nothing saved. Add --save to persist.` Run once bare to check the diff, then re-run with `--save` (unless `interactiveEditMode` is set to `save`).
- **`te deploy` and `te refresh` are dry runs too.** Without `--execute` they connect read-only and print the TMSL they would send. Both ask for confirmation at a terminal, so in CI pass `--execute --force --non-interactive`; an unattended `--execute` without `--force` stops with an error. The deploy target is `--target-server` / `--target-database`; `-s`/`-d` always mean the model you are deploying *from*. `te deploy` exits non-zero when the server accepts the metadata but parks objects with errors, so a green exit means the model is queryable.
- The BPA gate is ON by default for `te deploy` and `te save-as`. Bypass deliberately: `--skip-bpa`, `--fix-bpa`, or `bpa.onDeploy` / `bpa.onSave` config (keys are nested under `bpa.`, not flat).
- Metadata commands (`te list`, `te get`, `te set`, `te add`, `te validate`, `te bpa run`, `te script`) work on a local model via `--model`. Commands that execute DAX or touch data (`te query`, `te vertipaq`, `te refresh`, `te test run`, `te test snapshot`) need a deployed model: pass `-s`/`-d` (or an active connection); `--model` alone errors with "No server specified". `te vertipaq --import <file.vpax>` is the offline exception.
- Quote object names that contain `{ } * ?` or spaces: `te get "Tables/'{foo}'"`, `te get "'Net Sales'[Sales Amount]"`. `KPIs` and `Sets` are container keywords in filter paths, so a table literally named `KPIs` is `te list "'KPIs'"`. Every path the CLI prints (errors, `--paths-only`, JSON `objectPath`) is already quoted and pastes straight back.
- Never put secrets on the command line (visible in `ps` and shell history). Use `--auth env` with `AZURE_CLIENT_ID`/`AZURE_CLIENT_SECRET`/`AZURE_TENANT_ID`, stdin (`-`), or `--auth managed-identity`.
- Avoid destructive operations without explicit direction: `te remove`, `te move`, `te deploy --execute --create-only`, `te save-as --force`, `te set --update-schema --drop-removed-columns`, `te connect --clear`. If a command is blocked by permissions, stop and ask.

## Verb naming (canonical long-form + Unix aliases)

Long-form verbs are canonical: `te list`, `te remove`, `te move`, `te save-as` at the root, and `list`/`remove` in subgroups (`te macro`, `te bpa rules`, `te profile`, `te session`, `te test`). Short Unix-style aliases work everywhere: `ls`, `rm`, `mv`, `save`. `te move` also accepts `rename`. `te add` has no short alias. Model-free helpers live under `te util` (`format-dax`, `format-m`, `migrate`). This skill uses the long forms throughout; the aliases still work if you prefer to type them.

## Staging model (`--save` / `--stage` / `--revert`)

Every mutating command runs through a staging dispatcher: edits (`set`, `add`, `remove`, `move`), TOM (`script`, `macro run`), and BPA `--fix`.

By default edits stage in memory and are discarded on exit. Pass `--save` to persist. The default is configurable with `te config set interactiveEditMode <mode>`:

- `stage` (default): keep changes in memory; persist with explicit `--save`
- `save`: auto-persist after each successful mutation
- `revert`: auto-roll-back after each mutation (safe audit/dry-run style)

Inside `te interactive`, `--save`, `--stage`, and `--revert` are available per command and mutually exclusive, and `save` commits staged edits while `save-as` re-serializes. Leaving the session with staged edits still unsaved asks for confirmation at a terminal and, when input is piped, warns and exits non-zero; `exit --force` discards them deliberately. `--save-to <path>` writes the mutation to a different location without overwriting the source. `--force` on `te set`/`te add`/`te script`/`te save-as` lets a mutation persist even when it introduces NEW DAX validation errors; the default save gate refuses to persist if the mutation introduces new errors (pre-existing errors do not block).

Every mutation prints what changed as a `-`/`+` diff. `--stat` (one line per changed object) and `--name-only` (changed paths, pipeable into `te get`) are shorter views; `te config set mutationOutput stat|name-only|none` sets a standing default. JSON output always carries the full `changes` array regardless.

## Quickstart

```bash
te --version && te auth status          # 0. check install + auth
te auth login                           # 1. authenticate (browser); cached
te init ./my-model                      # 2. scaffold (PowerBI mode, TMDL, compat 1705)
te get . --model ./model                # 3. model summary; then `te list --model ./model`, `te list Sales --model ./model`
te find "Revenue" --in names --model ./model            # 4. search (names | expressions | descriptions | all)
te get Sales/Revenue -p Expression --model ./model      # 5. read a measure's DAX
te bpa run --fail-on error --ci github --model ./model  # 6. BPA gate
te set Sales/Revenue --format Expression --save --model ./model   # 7. format one expression (whole model: see below)
te query "EVALUATE TOPN(5, 'Sales')" -s ws -d model     # 8. query (positional or -q)
te save-as -o ./out --serialization tmdl --model ./model          # 9. save / convert (tmdl|bim|pbip|database.json)
te deploy --model ./model --target-server ws --target-database model             # 10a. dry run: prints the TMSL
te deploy --model ./model --target-server ws --target-database model --execute --force --ci github   # 10b. deploy
te refresh --type full -s ws -d model --execute --force # 11. refresh (omit --execute to see the TMSL; --force skips the confirmation)
```

`te connect <ws> <model>` sets an active connection for interactive terminals, but it does not persist across separate Bash tool calls. In agentic or scripted use, pass `--model`/`-s`/`-d` explicitly every command (or set `TE_SESSION`).

## Common operations

The highest-frequency tasks in their most concise form. Full flags are in `references/command-reference.md`; flags are still moving in preview, so confirm with `te <command> --help`.

1. **Summarize a model (most concise)**: `te get . --model ./model` prints the model root. For a structural inventory, `te list` (tables), `te list Measures` (every measure across the model), `te list Relationships`, `te list KPIs`, `te list Functions`. Add `--output-format json` for a machine-readable dump; every object carries an `objectPath` you can hand back to `te get`.
2. **Search the model (fastest)**: `te find "<text>" --in names --paths-only --model ./model`. Scope `--in` to `names`, `expressions`, `descriptions`, `displayFolders`, `formatStrings`, `annotations`, or `all`; `--in expressions` walks every DAX and M expression. `--paths-only` is the fast, pipeable form. Structural lookups use wildcards (`te list "Sales/*Amount"`) or property filters (`te get Columns --where DataType=String --where IsHidden=true --ls`). Relationships are enumerated with `te list Relationships` (or DAX `EVALUATE INFO.VIEW.RELATIONSHIPS()` for the friendly view with cross-filter direction and active flag).
3. **Query the model** (needs a deployed model: `-s`/`-d` or an active connection; a local `--model` path cannot execute DAX):
   - Positional DAX: `te query "EVALUATE TOPN(10, Sales)" -s ws -d model` (or `-q "<dax>"`; explicit `-q` still wins)
   - From a `.dax` file: `te query --file query.dax -s ws -d model`
   - Save results (format picked by extension): `--output-file out.csv` (csv/tsv/json/dax); machine-readable stdout: `--output-format json`.
4. **Make a change** (dry run; `--save` persists): `te set Sales/Revenue -p Expression="SUM(Sales[Amount])" --save --model ./model`. Also `te add Sales/Margin -t Measure -p Expression="[Revenue]-[COGS]" --save`, `te remove`, `te move`. Read the current value first with `te get Sales/Revenue -p Expression`. Set several properties at once by repeating `-p`.
5. **Make bulk changes**: arbitrary bulk logic in one pass (the model loads once, avoiding ~1-2s per-call startup): `te script --file bulk.csx --save`, or inline `te script --inline "foreach (var m in Model.AllMeasures) m.FormatString = \"#,0\";" --save`. Predefined macros: `te macro run "<name>" --on "Sales/A,Sales/B" --save`. There is no whole-model text replace; use `te find` to locate and `te script` to change with token-level control.
   - AI metadata CRUD: use `scripts/manage-ai-metadata.csx` for non-interactive `CustomInstructions` and Copilot schema `Entities` management; use `scripts/edit-ai-instructions-interactive.csx` or `scripts/edit-ai-schema-interactive.csx` inside TE3 Desktop.
6. **Validate and optimize**:
   - Validate DAX, schema, and relationships: `te validate --errors-only --model ./model`.
   - Best-practice gate: `te bpa run --fail-on warning --model ./model` (`--fix` auto-applies fixes; add `--save` to keep them). Format one expression with `te set <path> --format Expression --save`; format every measure with `te script --inline "Model.AllMeasures.FormatDax();" --save`; format a loose snippet with `te util format-dax "<dax>"`.
   - Size and storage: `te vertipaq --columns --detail --top 20 -s ws -d model` surfaces the largest columns first (VertiPaq stats live in the deployed database; for offline analysis use `--import stats.vpax`); `references/semantic-modeling-practices.md` covers what to do about them.
   - Dead code: `te deps --unused --hidden --model ./model` lists hidden measures and columns nothing references.

## Global options

Abbreviated; the full table (server and database detail, resolution order) is in `references/command-reference.md`.

| Option | Description |
|---|---|
| `-m, --model <path>` | TMDL folder, `.bim`, `database.json` folder, or `.SemanticModel` folder |
| `-s, --server` / `-d, --database` | Workspace/endpoint and semantic model name. On `te deploy` this is the *source*; the target is `--target-server`/`--target-database` |
| `--local` | A locally running Analysis Services instance: Power BI Desktop, Visual Studio, SSAS (Windows only) |
| `--recent [N]` | Reuse a recently used model (no value = picker, `1` = last used) |
| `--auth <method>` | `auto` \| `interactive` \| `spn` \| `env` \| `managed-identity`; unknown values error |
| `--output-format <fmt>` | `text` (default) \| `json` \| `csv` \| `tmsl` (alias `bim`) \| `tmdl`; how STDOUT renders |
| `--error-format <fmt>` | `text` (default) \| `json`; how errors/warnings render on stderr |
| `--non-interactive` | Disable prompts; fail if input missing (set in CI) |
| `--debug` | Debug logs to stderr |

**Note:** `--output-format` (how stdout renders) and `--serialization` (how a model is written to disk on `init`/`save-as`/`--save-to`) are different flags. Do not conflate them.

## Semantic modeling checklist

Driving the CLI correctly is not the same as building a good model. After `te add` creates an object, apply the modeling decision that makes it correct and usable. The highest-value practices, each with its `te` command (add `--model ./model` or `-s`/`-d`):

| Practice | Why | `te` command |
|---|---|---|
| `SummarizeBy` = `None` on key/ID columns | stops Power BI silently summing keys into meaningless totals | `te set Sales/ProductKey -p SummarizeBy=None --save` |
| Hide foreign-key and surrogate-key columns | keys serve relationships, not visuals; keeps the field list clean | `te set Sales/ProductKey -p IsHidden=true --save` |
| Mark the date table | unlocks reliable time intelligence | `te set Date -p DataCategory=Time --save` |
| Single cross-filter direction by default | avoids ambiguous filter paths and double counting | list with `te list Relationships` (or DAX `EVALUATE INFO.VIEW.RELATIONSHIPS()`), read one with `te get "Relationships/<guid>"` (paste the path `--paths-only` prints); enable bidirectional only for a deliberate bridge |
| Format string on every measure | unformatted measures render raw floats | `te set "_Measures/Revenue" -p FormatString="#,0.00" --save` |
| Display folder + description on measures | a flat field pane is unusable past a few dozen measures; descriptions feed tooltips and Copilot | `te set "_Measures/Revenue" -p DisplayFolder=Revenue -p Description="Net revenue" --save` |
| Minimal correct data types; integer surrogate keys | high-cardinality and oversized types bloat VertiPaq | `te set Sales/CustomerKey -p DataType=Int64 --save` |
| Prefer measures over calculated columns | calculated columns cost storage and break some DirectQuery/DirectLake paths | `te add "_Measures/Margin" -t Measure -p Expression="[Revenue]-[COGS]" --save` |
| Calculation groups over measure sprawl | turns N measures x K variants into N + K objects | see `references/semantic-modeling-practices.md` |
| Gate every batch with validate + BPA | catches broken references and antipatterns while the change is fresh | `te validate --model ./model && te bpa run --fail-on warning --model ./model` |

Full rationale, citations, and worked workflows (RLS roles, calculation groups, date tables, VertiPaq tuning): `references/semantic-modeling-practices.md`.

## Command index

Eleven command families. Full flags and examples in `references/command-reference.md`.

- Model I/O: `te save-as` (alias `save`), `te init`
- Editing: `te set` (properties, `--unset`, `--format`, `--update-schema`), `te add`, `te remove`, `te move`
- Inspection: `te get` (`--ls`, `--where`, `--deps`, `--unused`, `--properties`), `te list`, `te find`, `te diff`, `te deps`
- Analysis & quality: `te validate`, `te schemacheck`, `te bpa run`, `te bpa rules`, `te vertipaq`
- Execution: `te query`, `te script`, `te macro`
- Deploy & refresh: `te deploy`, `te refresh` (refresh policies via `te set <table>/RefreshPolicy` and `te refresh --apply-refresh-policy`)
- Testing: `te test` (`run`, `init`, `list`, `spec`, `use`, `snapshot`, `compare`); suite authoring in `references/testing.md`
- Connection & auth: `te connect`, `te auth`, `te profile`
- Configuration: `te config`
- Utilities (never load a model): `te util format-dax`, `te util format-m`, `te util migrate`
- Shell: `te interactive` (model-aware REPL; subcommands work without the `te` prefix), `te session`, `te completion`

## The authoring loop

Run quality gates continuously, not only at deploy:

```bash
te validate --errors-only --model ./model                 # after each batch of edits
te bpa run --fail-on warning --model ./model              # antipattern gate during development
te script --inline "Model.AllMeasures.FormatDax();" --save --model ./model   # consistent DAX layout before commit
```

For build scripts that issue many `te` calls, set `te config set bpa.onSave false` first (skip the per-save BPA pass), run BPA once at the end, and set `te config set spinner false` for cleaner logs. Each invocation has ~1-2s of startup; prefer one `te script` with a C# loop over N `te set` calls for bulk edits.

## Using te with other Power BI CLIs

`te` owns the semantic model. Two sibling CLIs own the layers around it, and the highest-value workflows cross the boundary:

- `pbir` (the Power BI report layer): renaming or moving a model object leaves the report bound to the old `Table.Field`. `te move` cascades DAX references inside the model, but it cannot see report JSON; repair the report bindings separately (`pbir fields replace`, `pbir validate --fields`). See `references/pbir-cli-tandem.md`.
- `fab` (the Fabric / Power BI service): export a model from a workspace, edit and gate it locally with `te`, then deploy over XMLA (`te deploy --execute`) or import it back (`fab import`). See `references/fabric-cli-tandem.md`.

Gate any cross-tool refactor with `te validate` before touching the report or the service, and remember every `te` mutation stages in memory until `--save`.

## Bundled scripts

- `scripts/manage-ai-metadata.csx` - non-interactive `te script` CRUD for
  semantic model AI instructions (`CustomInstructions`) and AI schema
  (`Entities`) stored in culture linguistic metadata.
- `scripts/edit-ai-instructions-interactive.csx` - TE3 Desktop GUI editor for
  semantic model AI instructions.
- `scripts/edit-ai-schema-interactive.csx` - TE3 Desktop GUI editor for
  semantic model AI schema.
- `scripts/manage-ai-metadata-interactive.csx` - original combined TE3 Desktop
  editor prototype.

## References

Bundled (load as needed):

- `references/get-te-cli.md` - agent self-service install of the `te` binary from the public CDN
- `references/command-reference.md` - object path grammar, global options, all command families, authentication, connections/profiles/sessions
- `references/testing.md` - authoring `.test.yaml` suites (assertions, tolerance, tags, matrix), snapshot regression, A/B compare across workspaces
- `references/dax-test-patterns.md` - what to test: measure contracts (additivity, time shift, blank, safe division, bounds), integrity and schema checks, verified suite examples, CI tagging
- `references/semantic-modeling-practices.md` - modeling best practices tied to `te` commands, with sources
- `references/workflows.md` - multi-step recipes (table + M partition, format conversions, deploy, refresh, perspectives, translations, incremental refresh, field parameters)
- `references/gotchas.md` - path/property traps, output shapes, behavior traps
- `references/config-cicd-env.md` - config keys, speed knobs, CI/CD pipelines (GitHub Actions, Azure DevOps, Fabric practices), output formats, exit codes, environment variables
- `references/te2-migration.md` - TE2 compat activation and full flag mapping
- `references/pbir-cli-tandem.md` - using `te` with the `pbir` CLI (rename and refactor propagation, thin reports, validation pairing)
- `references/fabric-cli-tandem.md` - using `te` with the `fab` CLI (export/edit/deploy round-trip, discovery, refresh, promotion)

Authoritative docs:

- Command reference: https://docs.tabulareditor.com/en/features/te-cli/te-cli-commands.html
- Overview: https://docs.tabulareditor.com/en/features/te-cli/te-cli.html
- Authentication: https://docs.tabulareditor.com/en/features/te-cli/te-cli-auth.html
- Automation and structured output: https://docs.tabulareditor.com/en/features/te-cli/te-cli-automation.html
- Findings JSON shape: https://docs.tabulareditor.com/en/features/te-cli/te-cli-findings.html
- CI/CD: https://docs.tabulareditor.com/en/features/te-cli/te-cli-cicd.html
- Known limitations: https://docs.tabulareditor.com/en/features/te-cli/te-cli-limitations.html
- GitHub (issues, releases): https://github.com/TabularEditor/CLI
