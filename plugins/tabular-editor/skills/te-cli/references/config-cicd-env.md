# `te` configuration, CI/CD, and environment

Companion to the te-cli skill (SKILL.md).

### Configuration

| Command | Purpose |
|---|---|
| `te config show [--output-format json]` | Show all settings |
| `te config paths` | Resolved file paths (macros, BPA rules, config) |
| `te config init [--force]` | Create default config |
| `te config set <key> <value>` | Update setting |
| `te license …` | **Hidden during preview.** Subcommands (`activate`, `status`, `deactivate`) are parseable so existing scripts don't fail at parse time, but any invocation prints *"`te license` is not available in this preview build"* and exits 1. Don't pipeline this. |
| `te migrate [-A] [--output-format text\|json]` | TE2 → new-CLI flag mapping (interactive lookup or full table) |

**Config file**: `~/.config/te/config.json` (Windows: `%USERPROFILE%\.config\te\config.json`). Resolution order: `$TE_CONFIG` → default path → built-in defaults.

**Configurable keys** (the keys accepted by `te config set`):

| Key | Type | Default | Purpose |
|---|---|---|---|
| `macros` | path | _(none)_ | Override path to a `MacroActions.json` file |
| `queryLog` | path | _(none)_ | Path to the DAX query log file |
| `te3ExePath` | path | _(none)_ | Override path to the TE3 desktop executable (for `te open`) |
| `autoFormat` | bool | `false` | Apply DAX Formatter after mutations |
| `validateOnMutation` | bool | `true` | Verify `Table[Column]` references after edits |
| `vertipaqOnRefresh` | bool | `false` | Capture VertiPaq stats post-refresh |
| `bpa.rules` | string[] | _(none)_ | Path(s)/URL(s) to BPA rule file(s); repeatable; comma-separated on `te config set` |
| `bpa.onMutation` | bool | `false` | Run BPA after every mutation |
| `bpa.onDeploy` | bool | `true` | **BPA gate before deploy** (bypass: `--skip-bpa`) |
| `bpa.onSave` | bool | `true` | **BPA gate before save** (bypass: `--skip-bpa`) |
| `bpa.builtInRules` | bool | `true` | Include built-in default rules in scans |
| `bpa.disabledBuiltInRuleIds` | string[] | _(none)_ | Suppress specific built-in rule IDs |
| `formatOptions.useSemicolons` | bool | `false` | Use Euro separator (`;`) in DAX output |
| `formatOptions.shortFormat` | bool | `true` | Compact DAX layout (vs `--long`) |
| `formatOptions.skipSpaceAfterFunction` | bool | `false` | `SUM(x)` instead of `SUM (x)` |
| `formatOptions.useSqlBiDaxFormatter` | bool | `false` | Use SQLBI's online formatter instead of the in-house one |
| `interactiveEditMode` | enum | `stage` | Default for mutating commands: `stage` (in-memory only), `save` (auto-persist), `revert` (auto-roll-back). Overridden per-command by `--save`/`--stage`/`--revert` |
| `hidePreviewNotice` | bool | `false` | Suppress yellow preview banner |
| `spinner` | bool | `true` | Animated progress (disable for CI) |
| `debug` | bool | `false` | Debug logs to stderr |
| `disableTelemetry` | bool | `false` | Opt out of anonymous usage telemetry |

**Note:** BPA keys are **nested under `bpa.`**; `te config set bpa.onDeploy false`, not `bpaOnDeploy`. Same for `formatOptions.*`. Active connection / profile / test-suite are **session-scoped** (see `te session`) and explicitly rejected by `te config set`; use `te connect`, `te profile`, `te test use` instead.

**Speed knobs for batch / demo / CI runs**: each `te` invocation has ~1-2 s of process startup + model load. For pipelines that issue many sequential `te` calls (build scripts, live demos, mass-edit loops), set these once before the run:

```bash
te config set bpa.onSave false       # skip the BPA gate on every --save; run BPA once at the end instead
te config set spinner false          # disable the animated progress widget (cleaner CI logs, slightly faster)
te config set hidePreviewNotice true # suppress the yellow preview banner
```

`bpa.onSave: false` is by far the biggest win; without it, BPA runs on every saved mutation, which on a typical model-build script means dozens of redundant passes.

**Project-local BPA gate**: drop a `.te-bpa.json` in repo root (or set via `TE_BPA_CONFIG`) to override gate behavior per project.


## CI/CD integration

### GitHub Actions

```yaml
- name: Validate model
  env:
    AZURE_CLIENT_ID:     ${{ secrets.AZURE_CLIENT_ID }}
    AZURE_CLIENT_SECRET: ${{ secrets.AZURE_CLIENT_SECRET }}
    AZURE_TENANT_ID:     ${{ secrets.AZURE_TENANT_ID }}
  run: |
    te validate ./model --ci github --trx validate.trx --non-interactive

- name: BPA gate
  run: te bpa run --rules ./rules/BPARules.json --fail-on error --ci github --non-interactive

- name: Deploy
  run: |
    te deploy ./model \
      -s "${{ vars.WORKSPACE }}" \
      -d "${{ vars.SEMANTIC_MODEL }}" \
      --auth env --force --ci github --non-interactive

- name: Run tests
  run: te test run --ci github --trx test.trx --non-interactive

- name: Publish TRX
  if: always()
  uses: dorny/test-reporter@v1
  with:
    name: TE tests
    path: '*.trx'
    reporter: dotnet-trx
```

### Azure DevOps Pipelines

Same commands, swap `--ci github` for `--ci azdo` (or `vsts`/`azure-devops`; all aliases). Pipeline annotations come back as native `##vso[...]` markers; `--trx` integrates with the `PublishTestResults@2` task.

### Patterns

- **Always pass** `--non-interactive` and `--auth env` (with `AZURE_CLIENT_*` env vars) and `--force` (on `te deploy`)
- **Stable annotations**: `--ci azdo` or `--ci github` on `validate`, `bpa run`, `deploy`, `test run`, `script`
- **Test publishing**: `--trx <file>` on `validate`, `bpa run`, `test run` for VSTEST-compatible XML
- **Promotion (dev → test → prod)**: build once, deploy with `--profile dev`, `--profile test`, `--profile prod` against the same TMDL artifact
- **Disable spinner in CI**: `te config set spinner false` in setup step

## Output formats and exit codes

**`--output-format`** (global stdout format):
- `auto` (default): text on TTY, JSON when stdout is piped/redirected
- `text`: forces human-readable
- `json`: always valid JSON to stdout; errors/warnings to stderr (won't contaminate)
- `csv`: tabular results (only `query`, `bpa run`, `vertipaq`)
- `tmsl` (alias `bim`): emit the resolved object(s) as TMSL/BIM JSON; supported on `te get` and `te ls`
- `tmdl`: emit the resolved object as TMDL; supported on `te get` (single named object only) and `te ls`

```bash
te get Sales --output-format tmdl           # Sales table as TMDL
te get "Sales/Revenue" --output-format bim  # Single measure as TMSL fragment
te ls Tables --output-format bim            # All tables as TMSL/BIM
te ls Measures --output-format tmdl         # Every measure across the model, in TMDL
```

**`--ci` formats** (orthogonal to `--output-format`; emits CI-system logging commands to stderr on `validate`, `bpa run`, `deploy`, `test run`, `script`):

| Value | Effect |
|---|---|
| `vsts`, `azdo`, `azure-devops` | Azure DevOps: `##vso[task.logissue type=error/warning;...]message` + `##vso[task.complete result=...]` summary |
| `github`, `gh` | GitHub Actions: `::error file=…,line=…::message` / `::warning::message` |
| anything else | No CI output |

Errors and warnings are accumulated, so a non-zero exit code reflects total error count for the run.

**Exit codes**:
- `0`; success
- `1`; generic failure: invalid args, validation errors, auth failure, BPA gate
- `2`; `te diff` only: models differ

```bash
# JSON-safe pipeline
te ls --type measure --output-format json | jq -r '.[].path'

# Bash conditional on diff
if te diff old.bim new.bim --output-format json > /dev/null; then
  echo "Identical"
elif [ $? -eq 2 ]; then
  echo "Models differ"
fi
```

## Environment variables

| Var | Purpose |
|---|---|
| `TE_CONFIG` | Override config file path (otherwise `~/.config/te/config.json`) |
| `TE_DEBUG` | Set `1` or `true` for debug logging to stderr |
| `TE_COMPAT` | Set `te2` to force legacy compat mode |
| `TE_SESSION` | Name the current session (instead of parent-PID-derived ID). Lets multiple shells share active state; named sessions are never auto-cleaned |
| `TE_MACROS_PATH` | Override path to a `MacroActions.json` (highest priority for `te macro`) |
| `TE_BPA_RULES` | Override path to a BPA rules file (precedence: explicit `--rules` > `TE_BPA_RULES` > `bpa.rules` config > CWD `BPARules.json`) |
| `TE_BPA_CONFIG` | Override path to a `.te-bpa.json` gate-config (for deploy/save BPA gating) |
| `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`, `AZURE_TENANT_ID` | SPN credentials (used with `--auth env`) |

