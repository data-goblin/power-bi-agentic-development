---
name: te-cli
version: 26.24
description: Expert guidance for the cross-platform Tabular Editor CLI (the `te` binary, currently in preview) that manages Power BI / Analysis Services semantic models from the terminal on macOS, Linux, and Windows. Use when the user mentions the `te` CLI or "Tabular Editor CLI" (not the "2"), or runs a `te <command>` to scaffold, inspect, edit, validate, run BPA on, query, deploy, refresh, test, or migrate a semantic model. Not for the legacy Windows-only `TabularEditor.exe` (TE2).
---

# Tabular Editor CLI (`te`)

To get the `te` CLI yourself (as the agent), see [references/get-te-cli.md](references/get-te-cli.md).

The `te` CLI is a single self-contained binary that loads, edits, validates, deploys, refreshes, and tests semantic models against TMDL/BIM files, Power BI Desktop, and cloud workspaces (Power BI, Fabric, Azure AS, SSAS). It is built on the same TOMWrapper that powers Tabular Editor 3, so model edits behave like the desktop app.

**Always pass `--output-format json`** when driving `te` programmatically. The default text/table output uses tables and ANSI styling that mangle in agent transcripts; JSON is parseable and avoids rendering issues.

**Limited public preview.** Preview builds stop functioning after 2026-09-30. No license is required during preview. Issues and feedback: https://github.com/TabularEditor/CLI

**Not the TE2 CLI.** This is a different product from the legacy Windows-only `TabularEditor.exe` (TE2). If the user invokes TE2 flag syntax (`-D`, `-S`, `-A`, `-B`, `-TMDL`, `-O`, `-C`, `-V`, `-G`), route it through the compat layer or invoke `TabularEditor.exe` directly. See `references/te2-migration.md`.

## When to use this skill

- The user mentions "te CLI", "the new Tabular Editor CLI", or runs a `te <command>` in a terminal
- The user wants to scaffold, inspect, edit, validate, deploy, refresh, query, or test a semantic model from the terminal on any OS
- The user wants to convert TMDL, BIM, or PBIP, run BPA, or format DAX from the command line
- The user is migrating CI/CD pipelines from `TabularEditor.exe` (TE2) to `te`

## When NOT to use this skill

- The user explicitly wants to run `TabularEditor.exe` natively (TE2); use that product directly
- The user asks about Tabular Editor 3 desktop UI features (Preferences.json, MacroActions.json, Layouts.json); consult https://docs.tabulareditor.com/
- The user wants help authoring a C# script body or a BPA rule expression itself rather than running it; use the `c-sharp-scripting` and `bpa-rules` skills

## Critical general rules

- First use in a session: run `te --version` and `te auth status`. If not authenticated, ask the user to run `te auth login`.
- Run `te --help` and `te <command> --help` the first time composing a command; flags are still evolving during preview.
- `te connect` state is per-shell-session and does NOT survive across separate Bash tool calls (each call is a fresh shell). Pass `-m <model>` (and `-s`/`-d` for remote) on every command, or set `TE_SESSION=<name>` before the first call to share state.
- MPartition path asymmetry: `te add` for an M partition uses `<Table>/<Partition>`, but every other command (`te rm`, `te get`, `te ls`, `te mv`, `te set`) uses `<Table>/Partitions/<Partition>`.
- Mutations stage in memory by default. `te set`, `te add`, `te rm`, `te mv`, `te replace`, `te format`, `te script`, `te macro run`, `te incremental-refresh set/remove` need `--save` to persist (unless `interactiveEditMode` is set to `save`).
- The BPA gate is ON by default for `te deploy` and `te save`. Bypass deliberately: `--skip-bpa`, `--fix-bpa`, or `bpa.onDeploy` / `bpa.onSave` config (keys are nested under `bpa.`, not flat).
- In CI: pass `--non-interactive` and `--force`. `te deploy` prompts with `n` as the safe default and hangs pipelines without `--force`.
- Never put secrets on the command line (visible in `ps` and shell history). Use `--auth env` with `AZURE_CLIENT_ID`/`AZURE_CLIENT_SECRET`/`AZURE_TENANT_ID`, stdin (`-`), or `--auth managed-identity`.
- Avoid destructive operations without explicit direction: `te rm`, `te mv`, `te deploy --create-only`, `te save --force`, `te connect --clear`. If a command is blocked by permissions, stop and ask.

## Staging model (`--save` / `--stage` / `--revert`)

Every mutating command runs through a staging dispatcher: edits (`set`, `add`, `rm`, `mv`, `replace`), DAX/M (`format`), TOM (`script`, `macro run`), refresh policy, and BPA `--fix`.

By default edits stage in memory and are discarded on exit. Pass `--save` to persist. The default is configurable with `te config set interactiveEditMode <mode>`:

- `stage` (default): keep changes in memory; persist with explicit `--save`
- `save`: auto-persist after each successful mutation
- `revert`: auto-roll-back after each mutation (safe audit/dry-run style)

Inside `te interactive`, `--save`, `--stage`, and `--revert` are available per command and mutually exclusive. `--save-to <path>` writes the mutation to a different location without overwriting the source. `--force` on `te script` / `te save` lets a mutation persist even when it introduces NEW DAX validation errors; the default save gate refuses to persist if the mutation introduces new errors (pre-existing errors do not block).

## Quickstart

```bash
te --version && te auth status          # 0. check install + auth
te auth login                           # 1. authenticate (browser); cached
te init ./my-model                      # 2. scaffold (PowerBI mode, TMDL, compat 1702)
te load ./model                         # 3. load + summary; then `te ls`, `te ls Sales`
te find "Revenue" --in names -m ./model # 4. search (names | expressions | descriptions | all)
te get Sales/Revenue -q expression -m ./model      # 5. read a measure's DAX
te bpa run --fail-on error --ci github -m ./model   # 6. BPA gate
te format --save -m ./model             # 7. format all DAX
te query -q "EVALUATE TOPN(5, 'Sales')" -s ws -d model    # 8. query
te save -o ./out --serialization tmdl -m ./model    # 9. save / convert (tmdl|bim|pbip|te-folder)
te deploy ./model -s ws -d model --force --ci github      # 10. deploy
te refresh --type full -s ws -d model   # 11. refresh
```

`te connect <ws> <model>` sets an active connection for interactive terminals, but it does not persist across separate Bash tool calls. In agentic or scripted use, pass `-m`/`-s`/`-d` explicitly every command (or set `TE_SESSION`).

## Common operations

The highest-frequency tasks in their most concise form. Full flags are in `references/command-reference.md`; flags are still moving in preview, so confirm with `te <command> --help`.

1. **Summarize a model (most concise)**: `te load ./model` prints a model summary. For a structural inventory, `te ls` (tables), `te ls Measures` (every measure across the model). Relationships do not list via `te ls` (a known gap, see `references/gotchas.md`); enumerate them with `te query -q "EVALUATE INFO.VIEW.RELATIONSHIPS()"`. Add `--output-format json` for a machine-readable dump.
2. **Search the model (fastest)**: `te find "<text>" --in names --paths-only -m ./model`. Scope `--in` to `names`, `expressions`, `descriptions`, `displayFolders`, ...; `--in expressions` walks every DAX and M expression. `--paths-only` is the fast, pipeable form. Structural lookups use wildcards (`te ls "Sales/*Amount"`). Relationships are not `te ls`-enumerable (known gap); list them with `te query -q "EVALUATE INFO.VIEW.RELATIONSHIPS()"`.
3. **Query the model**:
   - Inline DAX: `te query -q "EVALUATE TOPN(10, Sales)" -m ./model`
   - From a `.dax` file: `te query -f query.dax -m ./model`
   - Save results (format picked by extension): `--output-file out.csv` (csv/tsv/json/dax); machine-readable stdout: `--output-format json`.
4. **Make a change** (stages in memory; `--save` persists): `te set Sales/Revenue -q expression -i "SUM(Sales[Amount])" --save`. Also `te add`, `te rm`, `te mv`. Read the current value first with `te get Sales/Revenue -q expression`.
5. **Make bulk changes**:
   - Text find/replace across the whole model: `te replace "Old" "New" --in expressions --save` (previews unless `--save`).
   - Arbitrary bulk logic in one pass (the model loads once, avoiding ~1-2s per-call startup): `te script -S bulk.csx --save`, or inline `echo '<C# foreach over Model.AllMeasures>' | te script -e - --save`. Predefined macros: `te macro run "<name>" --on "Sales/A,Sales/B" --save`.
6. **Validate and optimize**:
   - Validate DAX, schema, and relationships: `te validate -m ./model --errors-only`.
   - Best-practice gate: `te bpa run --fail-on warning -m ./model` (`--fix` auto-applies fixes); format DAX with `te format --save -m ./model`.
   - Size and storage: `te vertipaq --columns --detail --top 20 -m ./model` surfaces the largest columns first; `references/semantic-modeling-practices.md` covers what to do about them.

## Global options

Abbreviated; the full table (including `--recent`, server and database detail) is in `references/command-reference.md`.

| Option | Description |
|---|---|
| `-m, --model <path>` | TMDL folder, `.bim`, or TE folder |
| `-s, --server` / `-d, --database` | Workspace/endpoint and semantic model name |
| `--local` | Running Power BI Desktop (Windows only) |
| `--auth <method>` | `auto` \| `interactive` \| `spn` \| `env` \| `managed-identity` |
| `--output-format <fmt>` | `auto` \| `text` \| `json` \| `csv` \| `tmsl` (alias `bim`) \| `tmdl`; how STDOUT renders |
| `--non-interactive` | Disable prompts; fail if input missing (set in CI) |
| `--debug` | Debug logs to stderr |

**Note:** `--output-format` (how stdout renders) and `--serialization` (how a model is written to disk on `init`/`save`) are different flags. Do not conflate them.

## Semantic modeling checklist

Driving the CLI correctly is not the same as building a good model. After `te add` creates an object, apply the modeling decision that makes it correct and usable. The highest-value practices, each with its `te` command:

| Practice | Why | `te` command |
|---|---|---|
| `summarizeBy` = `none` on key/ID columns | stops Power BI silently summing keys into meaningless totals | `te set Sales/ProductKey -q summarizeBy -i none --save` |
| Hide foreign-key and surrogate-key columns | keys serve relationships, not visuals; keeps the field list clean | `te set Sales/ProductKey -q isHidden -i true --save` |
| Mark the date table | unlocks reliable time intelligence | `te set Date -q dataCategory -i Time --save` |
| Single cross-filter direction by default | avoids ambiguous filter paths and double counting | list with `te query -q "EVALUATE INFO.VIEW.RELATIONSHIPS()"` (`te ls` cannot enumerate relationships; see gotchas), read one with `te get Relationships/<name>` (the `->` shorthand is for `te add` only); enable bidirectional only for a deliberate bridge |
| Format string on every measure | unformatted measures render raw floats | `te set "_Measures/Revenue" -q formatString -i "#,0.00" --save` |
| Display folder + description on measures | a flat field pane is unusable past a few dozen measures; descriptions feed tooltips and Copilot | `te set "_Measures/Revenue" -q displayFolder -i "Revenue" --save` |
| Minimal correct data types; integer surrogate keys | high-cardinality and oversized types bloat VertiPaq | `te set Sales/CustomerKey -q dataType -i int64 --save` |
| Prefer measures over calculated columns | calculated columns cost storage and break some DirectQuery/DirectLake paths | `te add "_Measures/Margin" -t Measure -i "[Revenue]-[COGS]" --save` |
| Calculation groups over measure sprawl | turns N measures x K variants into N + K objects | see `references/semantic-modeling-practices.md` |
| Gate every batch with validate + BPA | catches broken references and antipatterns while the change is fresh | `te validate -m ./model && te bpa run --fail-on warning -m ./model` |

Full rationale, citations, and worked workflows (RLS roles, calculation groups, date tables, VertiPaq tuning): `references/semantic-modeling-practices.md`.

## Command index

Ten command families. Full flags and examples in `references/command-reference.md`.

- Model I/O: `te load`, `te save`, `te open`, `te init`
- Editing: `te set`, `te add`, `te rm`, `te mv`, `te replace`
- Inspection: `te ls`, `te get`, `te find`, `te diff`, `te deps`
- Analysis & quality: `te validate`, `te bpa run`, `te vertipaq`, `te format`
- Execution: `te query`, `te script`, `te macro`
- Deploy & refresh: `te deploy`, `te refresh`, `te incremental-refresh`
- Testing: `te test`
- Connection & auth: `te connect`, `te auth`, `te profile`, `te session`
- Configuration: `te config`, `te migrate`, `te completion`
- Shell: `te interactive` (model-aware REPL; subcommands work without the `te` prefix)

## The authoring loop

Run quality gates continuously, not only at deploy:

```bash
te validate -m ./model --errors-only           # after each batch of edits
te bpa run --fail-on warning -m ./model         # antipattern gate during development
te format --save -m ./model                     # consistent DAX layout before commit
```

For build scripts that issue many `te` calls, set `te config set bpa.onSave false` first (skip the per-save BPA pass), run BPA once at the end, and set `te config set spinner false` for cleaner logs. Each invocation has ~1-2s of startup; prefer one `te script` with a C# loop over N `te set` calls for bulk edits.

## Using te with other Power BI CLIs

`te` owns the semantic model. Two sibling CLIs own the layers around it, and the highest-value workflows cross the boundary:

- `pbir` (the Power BI report layer): renaming or moving a model object leaves the report bound to the old `Table.Field`. Rename in the model (`te mv`, then `te replace --in expressions --save`), then repair the report bindings (`pbir fields replace`, `pbir validate --fields`). See `references/pbir-cli-tandem.md`.
- `fab` (the Fabric / Power BI service): export a model from a workspace, edit and gate it locally with `te`, then deploy over XMLA (`te deploy`) or import it back (`fab import`). See `references/fabric-cli-tandem.md`.

Gate any cross-tool refactor with `te validate` before touching the report or the service, and remember every `te` mutation stages in memory until `--save`.

## References

Bundled (load as needed):

- `references/command-reference.md` - object path grammar, global options, all 10 command families, authentication, connections/profiles/sessions
- `references/semantic-modeling-practices.md` - modeling best practices tied to `te` commands, with sources
- `references/workflows.md` - multi-step recipes (table + M partition, format conversions, deploy, refresh, perspectives, translations, incremental refresh, field parameters)
- `references/gotchas.md` - path/property asymmetries, output shapes, behavior traps
- `references/config-cicd-env.md` - config keys, speed knobs, CI/CD (GitHub Actions, Azure DevOps), output formats, exit codes, environment variables
- `references/te2-migration.md` - TE2 compat activation and full flag mapping
- `references/pbir-cli-tandem.md` - using `te` with the `pbir` CLI (rename and refactor propagation, thin reports, validation pairing)
- `references/fabric-cli-tandem.md` - using `te` with the `fab` CLI (export/edit/deploy round-trip, discovery, refresh, promotion)

Authoritative docs:

- Command reference: https://docs.tabulareditor.com/en/features/te-cli/te-cli-commands.html
- Overview: https://docs.tabulareditor.com/en/features/te-cli/te-cli.html
- CI/CD: https://docs.tabulareditor.com/en/features/te-cli/te-cli-cicd.html
- Known limitations: https://docs.tabulareditor.com/en/features/te-cli/te-cli-limitations.html
- GitHub (issues, releases): https://github.com/TabularEditor/CLI
