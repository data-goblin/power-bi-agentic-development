# `te` configuration, CI/CD, and environment

Companion to the te-cli skill (SKILL.md).

### Configuration

| Command | Purpose |
|---|---|
| `te config list [--output-format json]` | List all settings (alias `te config ls`; JSON strips null fields, parse tolerantly) |
| `te config paths` | Resolved file paths for macros and BPA rules (JSON emits explicit `null` for "resolved to nothing") |
| `te config init [--force]` | Create default config |
| `te config set <key> <value>` | Update setting (`-p key=value` also works; `null` clears; comma-separated for arrays; unknown key exits 1 and lists valid keys) |
| `te util migrate [-A] [--output-format json]` | TE2 → new-CLI flag mapping (full table, or single-flag lookup). Model-free; see `te2-migration.md` |

**Config file**: `~/.config/te/config.json` (Windows: `%USERPROFILE%\.config\te\config.json`). Resolution order: `$TE_CONFIG` → default path → built-in defaults. `te config set` auto-creates the file if missing. The CLI never reads a TE3 desktop install path; macros and BPA rules must be configured explicitly (or created with `te macro init` / `te bpa rules init`).

**Configurable keys** (every key except `formatVersion` is settable via `te config set`, nested keys via dotted paths):

| Key | Type | Default | Purpose |
|---|---|---|---|
| `macros` | path | `null` | Path to a `MacroActions.json` file used by every `te macro` command |
| `queryLog` | path | `null` | Log file where every `te query` appends query text + execution metadata (`~` supported) |
| `autoFormat` | bool | `false` | After a mutation, format the DAX of **only the objects that mutation changed**, but every DAX expression property they hold (expression, format string expression, detail rows, KPI target/status/trend, calc-group and table-permission expressions). Never touches M or SQL partition queries. Always uses the built-in formatter (`formatOptions.useSqlBiDaxFormatter` does not apply) |
| `validateOnMutation` | bool | `true` | After `add`/`set`/`move`/`macro run`, verify every `Table[Column]` reference still resolves |
| `mutationOutput` | enum | `diff` | How `add`/`set`/`move`/`remove`/`script`/`bpa run --fix` print the change set in text: `diff`, `stat`, `name-only`, `none` (`none` is config-only). Per-command `--diff`/`--stat`/`--name-only` override. JSON always carries the full `changes[]` |
| `vertipaqOnRefresh` | bool | `false` | After a successful `full`/`dataonly`/`automatic`/`add` refresh, run VertiPaq analysis on the refreshed tables (text and the JSON `vertipaq` array) |
| `bpa.rules` | string[] | `null` | Ordered path(s)/URL(s) to BPA rule files; `bpa run` and the gate load every existing entry; comma-separated on `te config set` |
| `bpa.onMutation` | bool | `false` | Scoped BPA (affected table only) after `set`/`add`/`move`/`remove`/`macro run` |
| `bpa.onDeploy` | bool | `true` | **BPA gate before `te deploy`** (bypass `--skip-bpa`, auto-fix `--fix-bpa`) |
| `bpa.onSave` | bool | `true` | **BPA gate before `te save-as`** (bypass `--skip-bpa` or `--force`) |
| `bpa.builtInRules` | bool | `true` | Include TE3's built-in rule set (the only built-ins; no `VPA_*` rules). `false` = only `bpa.rules` files + model-embedded rules |
| `bpa.disabledBuiltInRuleIds` | string[] | `null` | Built-in rule IDs excluded everywhere (gate and `bpa run`). Manage with `te bpa rules disable <id>` / `te bpa rules enable <id>` rather than editing |
| `formatOptions.shortFormat` | bool | `false` | Prefer compact single-line layout over the default multi-line layout |
| `formatOptions.skipSpaceAfterFunction` | bool | `false` | `SUM(x)` instead of `SUM (x)` |
| `formatOptions.useSqlBiDaxFormatter` | bool | `false` | Route explicit `te set --format` / `te util format-dax` and `te query` rendering through daxformatter.com (needs internet). Ignored by `autoFormat`. There is no separator key: config-driven formatting is always comma-dialect; `--semicolons` exists only on `te util format-dax` |
| `interactiveEditMode` | enum | `stage` | Default for mutations inside `te interactive`: `stage` (in memory until `save`), `save` (persist after every command), `revert` (discard unless `--save`/`--stage`). Per-command `--save`/`--stage`/`--revert` override |
| `launchInteractiveMode` | enum | `auto` | Whether bare `te` launches the REPL: `auto` (only when stdin, stdout and stderr are all TTYs), `always`, `never`. `--non-interactive` or `TE_INTERACTIVE` force it for one invocation |
| `hidePreviewNotice` | bool | `false` | Suppress the yellow preview banner (ignored within 14 days of expiry) |
| `spinner` | bool | `true` | Animated progress (disable for CI; also `NO_SPINNER=1` or auto-off when `CI=true`) |
| `debug` | bool | `false` | Always enable debug logging to stderr (same as `--debug`) |
| `disableTelemetry` | bool | `false` | Opt out of anonymous usage telemetry (command name, exit code, duration; never model content) |
| `profiles` | object | `{}` | Saved connection profiles; manage with `te profile set/remove/list`, never by hand |

**Notes:** BPA keys are **nested under `bpa.`**; `te config set bpa.onDeploy false`, not `bpaOnDeploy`. Same for `formatOptions.*`. Active connection / test-suite state is **session-scoped** (see `te session`) and not a config key; use `te connect`, `te test use`. Profiles can override `autoFormat`, `validateOnMutation`, `mutationOutput`, `bpa.onMutation`, `bpa.onDeploy`, `bpa.onSave`, `vertipaqOnRefresh`, `spinner`, `interactiveEditMode` while active (`te profile set dev --bpa-on-deploy false --validate-on-mutation false`).

**Administrator policies (Windows)**: `te` honours the same registry policies as Tabular Editor 3, read from `Software\Policies\Tabular Editor ApS` (optional `TECLI` subkey for CLI-only values) and the older `Software\Policies\Kapacity\Tabular Editor`, HKLM before HKCU. `DisableCSharpScripts` refuses `te script` and `te bpa run --fix`; `DisableMacros` refuses every `te macro` command; `DisableBpaDownload` refuses BPA rules given as URLs (files and built-ins unaffected); `DisableTelemetry` overrides `disableTelemetry`; `BlockUnsafeScripts` refuses scripts and macros that reach outside the model (files, network, processes, `#r`, direct server commands) in `te script`, `te script --validate`, `te macro run` and `te bpa run --fix`, while model-only scripts still run (JSON carries `blockedByPolicy: true`). Each refusal names the policy and exits non-zero, so a pipeline that depends on a disabled feature fails visibly. Policies for features the CLI does not have (updates, error reports, DAX Optimizer, AI assistant, MCP) do nothing. Docs: https://docs.tabulareditor.com/en/references/policies.html

**Speed knobs for batch / demo / CI runs**: each `te` invocation has ~1-2 s of process startup + model load. For pipelines that issue many sequential `te` calls (build scripts, live demos, mass-edit loops), set these once before the run:

```bash
te config set bpa.onSave false       # skip the BPA gate on every save-as; run te bpa run once at the end instead
te config set spinner false          # disable the animated progress widget (cleaner CI logs, slightly faster)
te config set hidePreviewNotice true # suppress the yellow preview banner
te config set mutationOutput stat    # one line per changed object instead of a full diff on every mutation
```

`bpa.onSave: false` is by far the biggest win; without it, BPA runs on every `te save-as`, which on a typical model-build script means dozens of redundant passes. (Ordinary `--save` on `te set`/`te add` is not gated unless `bpa.onMutation` is on.)

**Project-local BPA gate**: drop a `.te-bpa.json` in repo root (or point `TE_BPA_CONFIG` at one) to override gate behavior per project. Per-invocation rule override for the gate: `--bpa-rules <path>` (repeatable) on `te deploy` / `te save-as`.

**Path resolution** (macros and BPA rules): command flag (`--macros`, `--rules` on `bpa run`, `--bpa-rules` on deploy/save-as, `--rules-file` on `bpa rules`) → env var (`TE_MACROS_PATH`, `TE_BPA_RULES`) → config (`macros`, first existing `bpa.rules[]` entry). `te config paths` shows what resolved.


## CI/CD integration

The shape that works for Power BI / Fabric semantic models: **two pipelines, one artifact**. A PR-validation pipeline that never touches a workspace (validate + BPA gate on the TMDL in the repo), and a deployment pipeline that promotes the same TMDL artifact through workspaces (dev → test → prod), running the regression test suite against each workspace after deploy. Keep the model source (TMDL folder) and the test suite (`.te-tests/`) in the same repo so a PR that changes a measure also shows the test change.

**Preview caveat**: during the limited public preview the binary stops functioning after **2026-12-31**, and commands, flags, output shapes and exit codes may change between preview builds. No license is required during preview. Evaluate in non-production pipelines and plan to refresh the vendored binary (and re-check flags) on each preview build.

### One-time service setup (Fabric / Power BI)

- Create an Entra ID app registration (service principal) with a client secret or certificate; put the credentials in the pipeline's secret store (GitHub environment secrets / ADO variable group or Key Vault)
- Tenant admin portal: allow service principals to use Fabric APIs, and enable the **XMLA endpoint read-write** setting on the capacity (`te deploy` and `te query`/`te test run` go over XMLA)
- Add the service principal as a **Member/Admin on each target workspace** (Viewer cannot deploy; also note any Edit-level identity bypasses RLS, so keep the deploy SPN out of consumer workspaces' viewer paths)
- Workspace-per-environment (dev/test/prod workspaces on capacity) is the promotion unit; the model name stays constant across them

### Getting `te` onto a runner

The download at tabulareditor.com sits behind sign-in, so a pipeline cannot script it; the public CDN archive (`https://cdn.tabulareditor.com/files/latest/cli/<archive>`, GET only, see the Installation section in `command-reference.md`) is the scriptable alternative. The pinned, reproducible option is to commit the **extracted** binary for the runner's OS/arch into the repo (e.g. `tools/te/te` for Linux, `tools/te/te.exe` for Windows; ~70 MB, consider Git LFS) and put that folder on `PATH`:

```yaml
# GitHub Actions (Linux runner)
- name: Set up te CLI
  run: |
    chmod +x ./tools/te/te
    echo "$GITHUB_WORKSPACE/tools/te" >> $GITHUB_PATH
```

```yaml
# Azure DevOps (Windows agent)
- powershell: Write-Host "##vso[task.prependpath]$(Build.SourcesDirectory)\tools\te"
  displayName: Set up te CLI
```

Committing the binary pins the version; upgrading is a commit that replaces the file. See the Installation section in `command-reference.md` for the archive names per platform.

### GitHub Actions

PR validation (no workspace access, no secrets needed):

```yaml
on: pull_request
jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Set up te CLI
        run: |
          chmod +x ./tools/te/te
          echo "$GITHUB_WORKSPACE/tools/te" >> $GITHUB_PATH
      - name: Validate model
        run: te validate --model ./model --ci github --trx validate.trx --non-interactive
      - name: BPA gate
        run: te bpa run --model ./model --rules ./rules/BPARules.json --fail-on error --ci github --trx bpa.trx --non-interactive
      - name: Lint C# scripts (no model needed)
        run: te script --file ./scripts/fix.csx --validate
      - name: Publish results
        if: always()
        uses: dorny/test-reporter@v1
        with: { name: TE checks, path: '*.trx', reporter: dotnet-trx }
```

Deploy + post-deploy tests (on merge to main; use a GitHub `environment` per workspace so prod gets its approval gate):

```yaml
on: { push: { branches: [main] } }
jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: dev          # then a second job with environment: prod, needs: deploy
    env:
      AZURE_CLIENT_ID:     ${{ secrets.AZURE_CLIENT_ID }}
      AZURE_CLIENT_SECRET: ${{ secrets.AZURE_CLIENT_SECRET }}
      AZURE_TENANT_ID:     ${{ secrets.AZURE_TENANT_ID }}
    steps:
      - uses: actions/checkout@v4
      # ... set up te (as above) ...
      - name: Deploy
        run: |
          te deploy --model ./model \
            --target-server "${{ vars.WORKSPACE }}" --target-database "${{ vars.SEMANTIC_MODEL }}" \
            --auth env --execute --force --ci github --non-interactive
      - name: Refresh
        run: |
          te refresh -s "${{ vars.WORKSPACE }}" -d "${{ vars.SEMANTIC_MODEL }}" \
            --type full --execute --force --auth env --non-interactive --no-progress
      - name: Regression tests
        run: |
          te test run -s "${{ vars.WORKSPACE }}" -d "${{ vars.SEMANTIC_MODEL }}" \
            --auth env --ci github --trx test.trx --non-interactive
      - name: Publish TRX
        if: always()
        uses: dorny/test-reporter@v1
        with: { name: TE tests, path: '*.trx', reporter: dotnet-trx }
```

### Azure DevOps Pipelines

Same commands, swap `--ci github` for `--ci vsts` (`azdo` / `azure-devops` are accepted aliases). Annotations come back as native `##vso[...]` markers. Structure as two stages (Validate on PR via branch policy build validation, Deploy on main) with a variable group per environment:

```yaml
variables:
  - group: te-fabric-dev        # AZURE_CLIENT_ID / AZURE_CLIENT_SECRET / AZURE_TENANT_ID, WORKSPACE, MODEL
pool: { vmImage: windows-latest }
steps:
  - checkout: self
  - powershell: Write-Host "##vso[task.prependpath]$(Build.SourcesDirectory)\tools\te"
    displayName: Set up te CLI
  - script: te validate --model ./model --ci vsts --trx validate.trx --non-interactive
    displayName: Validate
  - script: te bpa run --model ./model --fail-on error --ci vsts --trx bpa.trx --non-interactive
    displayName: BPA gate
  - script: te deploy --model ./model --target-server "$(WORKSPACE)" --target-database "$(MODEL)" --auth env --execute --force --ci vsts --non-interactive
    displayName: Deploy
    env: { AZURE_CLIENT_ID: $(AZURE_CLIENT_ID), AZURE_CLIENT_SECRET: $(AZURE_CLIENT_SECRET), AZURE_TENANT_ID: $(AZURE_TENANT_ID) }
  - script: te test run -s "$(WORKSPACE)" -d "$(MODEL)" --auth env --ci vsts --trx test.trx --non-interactive
    displayName: Regression tests
    env: { AZURE_CLIENT_ID: $(AZURE_CLIENT_ID), AZURE_CLIENT_SECRET: $(AZURE_CLIENT_SECRET), AZURE_TENANT_ID: $(AZURE_TENANT_ID) }
  - task: PublishTestResults@2
    condition: always()
    inputs: { testResultsFormat: VSTest, testResultsFiles: '*.trx' }
```

Use ADO **environments with approval checks** (or stage approvals) for the prod stage, mirroring the GitHub `environment` gate.

### Patterns

- **Model is always `--model`** (or `-s`/`-d` for a deployed model). `te deploy ./model` is an error; write `te deploy --model ./model`. `-s`/`-d` always mean the model *source*; the deploy destination is `--target-server`/`--target-database`
- **Deploy and refresh are dry runs by default**: they print the TMSL they would send and touch nothing. **Always pass `--execute --force`** on the steps that must act; both `te deploy --execute` and `te refresh --execute` ask for confirmation, and an unattended run without `--force` stops with an error
- **A green exit means a usable model**: `te deploy` exits non-zero when the server accepts the metadata but parks objects with errors (JSON `success: false`, reason in `error`), and `te script` exits non-zero when a script calls `Error(...)`
- **Always pass** `--non-interactive` and `--auth env` (with `AZURE_CLIENT_*` env vars mapped at step/job level, never echoed)
- **Gate before deploy, test after deploy**: `validate` + `bpa run` need only the repo artifact; `test run` needs the deployed model, so it doubles as the smoke test of the deployment itself
- **Offline script lint**: `te script --file x.csx --validate` compiles without a model or credentials
- **Stable annotations**: `--ci vsts` or `--ci github` on `validate`, `bpa run`, `deploy`, `test run` (`azdo`, `azure-devops`, `gh` are aliases; a mistyped value is rejected before the command runs, so it cannot silently emit nothing)
- **Test publishing**: `--trx <file>` on `validate`, `bpa run`, `test run` for VSTEST-compatible XML
- **Promotion (dev → test → prod)**: build once, deploy the same TMDL artifact per environment; parameterize only `--target-server`/`--target-database` (or `te deploy --profile <name>`; in CI prefer explicit flags plus per-environment variable groups)
- **Remote-to-remote promotion** without a repo artifact: `te deploy -s src-ws -d model --target-server dst-ws --target-database model --execute --force`
- **Pre-cutover A/B check**: `te test compare --source-a prod-ws/model --source-b test-ws/model --suite .te-tests` shows result drift between current prod and the candidate before promoting (see `testing.md`)
- **Refresh in pipelines**: `--execute --force --non-interactive` always; `--table`/`--partition` with `--type full`, `--apply-refresh-policy <table> --effective-date yyyy-MM-dd` for incremental policies; drop `--execute` to emit reviewable TMSL as a pipeline artifact (`te refresh -s ws -d m --type full > refresh.tmsl`, `te deploy --model ./model --target-server ws --target-database m > deploy.tmsl`)
- **Cleaner logs**: `te config set spinner false` in the setup step (or rely on `CI=true`); `--no-progress` on `te refresh`
- **Secrets**: never inline in the command (leaks into logs and `ps`); pipe with `-p -` if you must log in (`echo "$SECRET" | te auth login -u $ID -p - -t $TENANT`, cached for the rest of the job); never log `te auth status` output

## Output formats and exit codes

**`--output-format`** (global stdout format; default is always `text`, there is no auto-switch when piped):
- `text` (default): human-readable
- `json`: always valid JSON to stdout; errors/warnings/progress/banner go to stderr (won't contaminate). Add `--error-format json` for `{"error","hint"}` objects on stderr
- `csv`: tabular results (`query`, `bpa run`, `bpa rules`, `vertipaq`, `validate`, `test`, `refresh`, `profile list`, `session list`, `find`, `get`, `list`)
- `bim` (alias `tmsl`): emit the resolved object(s) as BIM/TMSL JSON; supported on `te get` and `te list`
- `tmdl`: emit the resolved object as TMDL; supported on `te get` (single object)

```bash
te get Sales --output-format tmdl             # Sales table as TMDL
te get "Sales/Revenue" --output-format bim    # Single measure as TMSL fragment
te list Tables --output-format bim            # All tables as BIM/TMSL
```

**Findings JSON** (one shape for `te validate`, `te bpa run`, `te test run`, and `te query` when its pre-execution DAX validation fails). Always exactly one document:

```json
{ "command": "bpa run", "durationMs": 510,
  "summary": { "errors": 1, "warnings": 0, "info": 0, "total": 1 },
  "findings": [ { "severity": "error", "source": "bpa", "code": "TE3_BUILT_IN_SET_ISAVAILABLEINMDX_FALSE",
                  "message": "...", "object": "'Budget Rate'[Rate]", "objectType": "Column",
                  "objectPath": "Budget Rate/Rate", "ruleName": "...", "category": "Performance", "fixable": true } ] }
```

- `severity` ∈ `error|warning|info`; `source` ∈ `validate|bpa|test|query`; `code` is stable (validation message ID, BPA rule ID, `TEST_FAIL`/`TEST_ERROR`/`TEST_SUITE_INVALID`)
- `objectPath` (validate/bpa only) pastes straight into `te get`/`te set`; `expressionPosition {property, lineNumber, column}` (validate/query) is absent when unknown
- Extras: `validate` adds `valid`; `bpa run` adds `model`, `rulesEvaluated`, `violations`, `ruleErrors`, `ignoredRules` and, with `--fix`, a `fix` key (`changes`, `fixed`, `fixErrors`, `skipped`; failure reason in `fix.error`); `test run` adds `suites`, `invalidSuites`, `testSummary`
- Mutating commands and `te diff` share a separate `changes[]` shape: `{objectPath, objectType, changeKind (created|deleted|modified|moved), movedFromObjectPath?, properties: [{property, before, after}]}`

**`--ci` formats** (orthogonal to `--output-format`; emits CI logging commands to stderr on `validate`, `bpa run`, `deploy`, `test run`):

| Value | Effect |
|---|---|
| `vsts`, `azdo`, `azure-devops` | Azure DevOps: `##vso[task.logissue type=error/warning;code=<code>;...]message`, info findings as plain log lines, `##vso[task.complete result=...]` summary (info-only runs report **Succeeded**) |
| `github`, `gh` | GitHub Actions: `::error title=<code>,line=…,col=…::message` / `::warning …::` / `::notice …::` for info findings |
| `none` or empty | Explicitly no CI output |
| anything else | Rejected before the command runs, listing the accepted values |

Errors and warnings are accumulated, so a non-zero exit code reflects total error count for the run.

**Exit codes**:
- `0`: success
- `1`: generic failure: invalid arguments, command failed, validation errors, auth failure, BPA gate failed at severity >= error (`--fail-on warning` lowers the bar on `bpa run`/`test run`), a `te script` run where a script called `Error(...)`, a `te deploy` the server accepted with object errors, `te refresh --execute` unattended without `--force`. On `te diff`: differences found
- `2`: `te diff` only: an error occurred while comparing, so the difference status is unknown

```bash
# JSON-safe pipeline (every listed object carries objectPath as its first key)
te list --type measure --output-format json | jq -r '.[].objectPath'

# Bash conditional on diff (0 = identical, 1 = differ, 2 = error)
te diff old.bim new.bim > /dev/null
case $? in
  0) echo "Identical" ;;
  1) echo "Models differ" ;;
  *) echo "Diff failed" >&2; exit 1 ;;
esac
```

## Environment variables

| Var | Purpose |
|---|---|
| `TE_CONFIG` | Override config file path (otherwise `~/.config/te/config.json`); honored by every `te config` operation |
| `TE_DEBUG` | Set `1` for debug logging to stderr (same as `--debug` / `debug: true`) |
| `TE_COMPAT` | Set `te2` to force TE2 compatibility mode (see `te2-migration.md`) |
| `TE_SESSION` | Name the current session (instead of the per-terminal ID). Lets multiple shells share active-connection state, or isolates parallel CI matrix jobs; inspect with `te session` |
| `TE_INTERACTIVE` | Override `launchInteractiveMode` for one invocation: `auto`, `always`, `never` |
| `NO_SPINNER` | `1` or `true` disables the progress spinner (alternative to `spinner: false`) |
| `CI` | Auto-detected; `1`/`true` disables the spinner and switches to plain output. Most runners set it |
| `TE_MACROS_PATH` | Override path to a `MacroActions.json` (precedence: `--macros` > `TE_MACROS_PATH` > `macros` config) |
| `TE_BPA_RULES` | Override BPA rules file/URL list (precedence: `--rules` > `TE_BPA_RULES` > `bpa.rules` config) |
| `TE_BPA_CONFIG` | Override path to the `.te-bpa.json` gate config read by `te deploy` / `te save-as` |
| `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`, `AZURE_TENANT_ID` | SPN credentials (used with `--auth env`, and first in the `auto` chain) |
| `AZURE_CLIENT_CERTIFICATE_PATH` | PEM/PKCS12 certificate for certificate-based SPN auth (with `AZURE_CLIENT_ID` + `AZURE_TENANT_ID`) |
| `AZURE_AUTHORITY_HOST` | Authority host for sovereign clouds (`login.microsoftonline.us`, `login.partner.microsoftonline.cn`) |

`--auth` accepts exactly `auto`, `interactive`, `spn`, `env`, `managed-identity`; any other value is an error.
