# Migrating from TE2 (`TabularEditor.exe`) to `te`

Companion to the te-cli skill (SKILL.md).

## Migration from TE2

Activate TE2 compatibility three ways:

```bash
mv te te2 && ./te2 Model.bim -S fix.csx -D server db -O          # 1. binary rename (or symlink)
TE_COMPAT=te2 te Model.bim -S fix.csx -D server db -O            # 2. env var
te Model.bim -S fix.csx -D server db -O                          # 3. auto-detect: first arg is not a te subcommand and a TE2 flag is present
```

TE2 mode runs the same `Load → Scripts → Schema Check → Save → BPA → Deploy → TRX` pipeline as `TabularEditor.exe`, including the context-sensitive flags (`-S` after `-D` means `-SHARED`, `-F` after `-D` means `-FULL`, `-L` after `-D` means `-LOGIN`).

For the full mapping table (and a single-flag lookup), run the model-free `te util` helper:

```bash
te util migrate                                # full table
te util migrate -A                             # look up one TE2 flag
te util migrate --output-format json           # machine-readable for codemods (`te2Flags[]`, `summary`)
```

`te util` never loads a model; passing `--model`, `-s`, `-d`, `--auth`, `--local` or `--recent` to it is an error.

**Flag mapping** (matches `te util migrate` output):

| TE2 flag | New CLI |
|---|---|
| `<file>` (positional) | `--model <path>` on any command (never a positional path), or `te connect <path>` once |
| `<server> <database>` (positional) | `te connect <server> <database>` or global `-s <server> -d <database>` (always the model source; deploy targets use `--target-server` / `--target-database`) |
| `-L` / `-LOCAL` | `te connect --local` (Windows only) |
| `-S <file.csx>` / `-SCRIPT` | `te script --file <file.csx> [--save]` (bare `te script fix.csx` also works; `--inline "code"` for code, `--inline -` for stdin; files and inline code run in the order given) |
| `-A <rules>` / `-ANALYZE` | `te bpa run --rules <file-or-url>` (adds `--fail-on`, `--fix`, `--trx`, multiple rule files) |
| `-AX <rules>` / `-ANALYZEX` | `te bpa run --rules <file-or-url> --no-model-rules` |
| `-B <file>` / `-BIM` | `te save-as --model <model> -o <file.bim> --serialization bim` |
| `-F <dir>` / `-FOLDER` | `te save-as --model <model> -o <dir> --serialization database.json` (after `-D`, TE2's `-F` means `-FULL`) |
| `-TMDL <dir>` | `te save-as --model <model> -o <dir> --serialization tmdl` (`--serialization` may be omitted; inferred from the output path) |
| `-D <server> <db>` / `-DEPLOY` | `te deploy --model <model> --target-server <server> --target-database <db> --execute` (without `--execute` it is a dry run that prints the TMSL) |
| `-O` / `-OVERWRITE` | (default when executing; `--create-only` to opt out) |
| `-C` / `-CONNECTIONS` | `--deploy-connections` |
| `-P` / `-PARTITIONS` | `--deploy-partitions` |
| `-Y` / `-SKIPPOLICY` | `--deploy-partitions --skip-refresh-policy` |
| `-R` / `-ROLES` | `--deploy-roles` |
| `-M` / `-MEMBERS` | `--deploy-role-members` |
| `-SHARED` | `--deploy-shared-expressions` |
| `-FULL` (after `-D`) | `--deploy-full` (overwrite + connections + partitions + shared expressions + roles + role members) |
| `-X <file>` / `-XMLA` | `te deploy ... > <file>` (script emission is the default; omit `--execute`) |
| `-V` / `-VSTS` | `--ci vsts` on `validate`, `bpa run`, `deploy`, `test run` |
| `-G` / `-GITHUB` | `--ci github` on `validate`, `bpa run`, `deploy`, `test run` |
| `-T <file>` / `-TRX` | `--trx <file>` on `validate`, `bpa run`, `test run` |
| `-W` / `-WARN` | (default; deploy results include warnings) |
| `-E` / `-ERR` | (default; deploy exits non-zero on failure) |
| `-L <user> <pass>` (after `-D`; `-LOGIN`) | _Not yet implemented_ as SQL auth. Use `te auth login -u <id> -p <secret> -t <tenant>` (cached) or `--auth env` with `AZURE_CLIENT_*` variables |
| `-SC` / `-SCHEMACHECK` | `te schemacheck [--ci vsts] [--trx results.trx] [--fail-on warning]` (same exit rule: drift warns, a missing source column fails). Also checks M and Direct Lake tables, which TE2 never read; a legacy partition on Oracle, ODBC or a non-SQL-Server OLE DB provider is **Not checked** rather than checked. `te2 <model> -SC` keeps TE2's exact scope and `-T` assertions |

**Behavioral differences from TE2**:
- `te deploy` and `te refresh` are dry runs by default: they print the TMSL they would send and change nothing. Pass `--execute` to act; in CI pass `--execute --force` because `--execute` otherwise asks for confirmation.
- `te deploy` and `te save-as` run BPA as a pre-flight gate by default (TE2 did not). `--skip-bpa` to disable, `--fix-bpa` to auto-fix in memory.
- `te script` exits non-zero when a script calls `Error(...)`; TE2 reported success.
- In TE2 compatibility mode a script that throws or does not compile aborts the run, as in TE2: no build output (`-B`/`-F`/`-TMDL`), no BPA, no deploy, no `-T` file, exit 1. Compile errors print `Error <code> on line <n>, col <n>: <message>` on stdout and become `-V`/`-G` annotations pointing at the script line. Each script runs in one update batch, so cascading fix-ups (formula renames) apply when the script ends.
- Scripts see `TECLI` defined and `TE3` undefined, in `te script` and in TE2 compatibility mode; TE2 defined neither.
- All commands support `--output-format json`; `validate`, `bpa run`, `test run` and `query` share one findings JSON shape (see `config-cicd-env.md`).
- No `start /wait` wrapper needed on Windows; it is a normal console binary. Cross-platform, except local SSAS / Power BI Desktop connections (Windows only).

**Migration playbook**: drop in `te` (or `te2`) for `TabularEditor.exe` and confirm the pipeline still runs; then convert one flag group at a time (`-A`/`-AX` → `te bpa run`, then `-D` → `te deploy --execute --force`, then `-V`/`-G` → `--ci`); then add `--non-interactive` everywhere and replace `-D -L <user> <pass>` with service-principal auth.
