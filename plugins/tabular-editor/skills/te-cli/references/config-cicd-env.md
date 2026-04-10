# `te` configuration, CI/CD, and environment

Companion to the te-cli skill (SKILL.md).

### Configuration

| Command | Purpose |
|---|---|
| `te config list [--output-format json]` | List all settings (previously `te config show`; renamed for verb consistency with `te list`) |
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
| `launchInteractiveMode` | enum | `Auto` | Controls whether invoking `te` with no subcommand launches the interactive REPL: `Auto` (launch on a TTY, print help when stdout is piped/redirected), `Never` (always print help), `Always` (always launch the REPL) |
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

The shape that works for Power BI / Fabric semantic models: **two pipelines, one artifact**. A PR-validation pipeline that never touches a workspace (validate + BPA gate on the TMDL in the repo), and a deployment pipeline that promotes the same TMDL artifact through workspaces (dev → test → prod), running the regression test suite against each workspace after deploy. Keep the model source (TMDL folder) and the test suite (`.te-tests/`) in the same repo so a PR that changes a measure also shows the test change.

### One-time service setup (Fabric / Power BI)

- Create an Entra ID app registration (service principal) with a client secret or certificate; put the credentials in the pipeline's secret store (GitHub environment secrets / ADO variable group or Key Vault)
- Tenant admin portal: allow service principals to use Fabric APIs, and enable the **XMLA endpoint read-write** setting on the capacity (`te deploy` and `te query`/`te test run` go over XMLA)
- Add the service principal as a **Member/Admin on each target workspace** (Viewer cannot deploy; also note any Edit-level identity bypasses RLS, so keep the deploy SPN out of consumer workspaces' viewer paths)
- Workspace-per-environment (dev/test/prod workspaces on capacity) is the promotion unit; the model name stays constant across them

### Installing `te` on a runner

The binary is on a public CDN (no auth): see the Installation section in `command-reference.md`. One step on a Linux runner:

```yaml
- name: Install te CLI
  run: |
    mkdir -p "$HOME/.local/bin"
    curl -fsSL "https://cdn.tabulareditor.com/files/cli/latest/te-linux-x64.tar.gz" | tar xz -C "$HOME/.local/bin" te
    chmod +x "$HOME/.local/bin/te"
    echo "$HOME/.local/bin" >> $GITHUB_PATH
```

Only `latest` is published during preview; commit the binary (or cache it) if you need reproducible runs, and plan around the 2026-09-30 preview expiry.

### GitHub Actions

PR validation (no workspace access, no secrets needed):

```yaml
on: pull_request
jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Install te CLI
        run: |
          mkdir -p "$HOME/.local/bin"
          curl -fsSL "https://cdn.tabulareditor.com/files/cli/latest/te-linux-x64.tar.gz" | tar xz -C "$HOME/.local/bin" te
          chmod +x "$HOME/.local/bin/te" && echo "$HOME/.local/bin" >> $GITHUB_PATH
      - name: Validate model
        run: te validate ./model --ci github --trx validate.trx --non-interactive
      - name: BPA gate
        run: te bpa run ./model --rules ./rules/BPARules.json --fail-on error --ci github --trx bpa.trx --non-interactive
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
      # ... install te (as above) ...
      - name: Deploy
        run: |
          te deploy ./model -s "${{ vars.WORKSPACE }}" -d "${{ vars.SEMANTIC_MODEL }}" \
            --auth env --force --ci github --non-interactive
      - name: Refresh
        run: te refresh -s "${{ vars.WORKSPACE }}" -d "${{ vars.SEMANTIC_MODEL }}" --type full --auth env --non-interactive --no-progress
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

Same commands, swap `--ci github` for `--ci azdo` (or `vsts`/`azure-devops`; all aliases). Annotations come back as native `##vso[...]` markers. Structure as two stages (Validate on PR via branch policy build validation, Deploy on main) with a variable group per environment:

```yaml
variables:
  - group: te-fabric-dev        # AZURE_CLIENT_ID / AZURE_CLIENT_SECRET / AZURE_TENANT_ID, WORKSPACE, MODEL
steps:
  - script: |
      mkdir -p "$HOME/.local/bin"
      curl -fsSL "https://cdn.tabulareditor.com/files/cli/latest/te-linux-x64.tar.gz" | tar xz -C "$HOME/.local/bin" te
      chmod +x "$HOME/.local/bin/te"
      echo "##vso[task.prependpath]$HOME/.local/bin"
    displayName: Install te CLI
  - script: te validate ./model --ci azdo --trx validate.trx --non-interactive
    displayName: Validate
  - script: te bpa run ./model --fail-on error --ci azdo --trx bpa.trx --non-interactive
    displayName: BPA gate
  - script: te deploy ./model -s "$(WORKSPACE)" -d "$(MODEL)" --auth env --force --ci azdo --non-interactive
    displayName: Deploy
    env: { AZURE_CLIENT_ID: $(AZURE_CLIENT_ID), AZURE_CLIENT_SECRET: $(AZURE_CLIENT_SECRET), AZURE_TENANT_ID: $(AZURE_TENANT_ID) }
  - script: te test run -s "$(WORKSPACE)" -d "$(MODEL)" --auth env --ci azdo --trx test.trx --non-interactive
    displayName: Regression tests
    env: { AZURE_CLIENT_ID: $(AZURE_CLIENT_ID), AZURE_CLIENT_SECRET: $(AZURE_CLIENT_SECRET), AZURE_TENANT_ID: $(AZURE_TENANT_ID) }
  - task: PublishTestResults@2
    condition: always()
    inputs: { testResultsFormat: VSTest, testResultsFiles: '*.trx' }
```

Use ADO **environments with approval checks** (or stage approvals) for the prod stage, mirroring the GitHub `environment` gate.

### Patterns

- **Always pass** `--non-interactive`, `--auth env` (with `AZURE_CLIENT_*` env vars mapped at step/job level, never echoed), and `--force` on `te deploy`
- **Gate before deploy, test after deploy**: `validate` + `bpa run` need only the repo artifact; `test run` needs the deployed model, so it doubles as the smoke test of the deployment itself
- **Stable annotations**: `--ci azdo` or `--ci github` on `validate`, `bpa run`, `deploy`, `test run`, `script`
- **Test publishing**: `--trx <file>` on `validate`, `bpa run`, `test run` for VSTEST-compatible XML
- **Promotion (dev → test → prod)**: build once, deploy the same TMDL artifact per environment; parameterize only `-s`/`-d` (or use `te profile` locally; in CI prefer explicit flags plus per-environment variable groups)
- **Pre-cutover A/B check**: `te test compare --source-a prod-ws/model --source-b test-ws/model --suite .te-tests` shows result drift between current prod and the candidate before promoting (see `testing.md`)
- **Partition-level refresh in pipelines**: `--table`/`--partition` with `--type full`, or `--dry-run` to emit reviewable TMSL as a pipeline artifact
- **Cleaner logs**: `te config set spinner false` in the setup step; `--no-progress` on `te refresh`
- **Secrets**: never inline in the command (leaks into logs and `ps`); never log `te auth status` output

## Output formats and exit codes

**`--output-format`** (global stdout format):
- `auto` (default): text on TTY, JSON when stdout is piped/redirected
- `text`: forces human-readable
- `json`: always valid JSON to stdout; errors/warnings to stderr (won't contaminate)
- `csv`: tabular results (only `query`, `bpa run`, `vertipaq`)
- `bim` (alias `tmsl`): emit the resolved object(s) as BIM/TMSL JSON; supported on `te get` and `te list`. `bim` is canonical (matches the `.bim` file extension) but the two names are synonyms everywhere the flag appears.
- `tmdl`: emit the resolved object as TMDL; supported on `te get` (single named object only) and `te list`

```bash
te get Sales --output-format tmdl             # Sales table as TMDL
te get "Sales/Revenue" --output-format bim    # Single measure as TMSL fragment
te list Tables --output-format bim            # All tables as BIM/TMSL
te list Measures --output-format tmdl         # Every measure across the model, in TMDL
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
- `1`; generic failure: invalid args, validation errors, auth failure, BPA gate. On `te diff`: models differ
- `2`; `te diff` only: error (bad path, load failure)

```bash
# JSON-safe pipeline
te list --type measure --output-format json | jq -r '.[].path'

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
| `TE_CONFIG` | Override config file path (otherwise `~/.config/te/config.json`) |
| `TE_DEBUG` | Set `1` or `true` for debug logging to stderr |
| `TE_COMPAT` | Set `te2` to force legacy compat mode |
| `TE_SESSION` | Name the current session (instead of parent-PID-derived ID). Lets multiple shells share active state; named sessions are never auto-cleaned |
| `TE_MACROS_PATH` | Override path to a `MacroActions.json` (highest priority for `te macro`) |
| `TE_BPA_RULES` | Override path to a BPA rules file (precedence: explicit `--rules` > `TE_BPA_RULES` > `bpa.rules` config > CWD `BPARules.json`) |
| `TE_BPA_CONFIG` | Override path to a `.te-bpa.json` gate-config (for deploy/save BPA gating) |
| `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`, `AZURE_TENANT_ID` | SPN credentials (used with `--auth env`) |
