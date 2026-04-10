# Migrating from TE2 (`TabularEditor.exe`) to `te`

Companion to the te-cli skill (SKILL.md).

## Migration from TE2

Activate TE2 compatibility three ways:

```bash
mv te te2 && ./te2 Model.bim -S fix.csx -D server db -O          # 1. binary rename
TE_COMPAT=te2 te Model.bim -S fix.csx -D server db -O            # 2. env var
te Model.bim -S fix.csx -D server db -O                          # 3. auto-detect from flags
```

For the full mapping table (and an interactive single-flag lookup), run:

```bash
te migrate                                # full table
te migrate -A                             # prompt for a TE2 flag, get equivalent
te migrate --output-format json           # machine-readable for codemods
```

**Most-used mappings**:

| TE2 flag | New CLI |
|---|---|
| `<file>` (positional) | `te <command> <path>` or `--model <path>` |
| `-S <file.csx>` / `-S "code"` | `te script -S <file>` / `-e "code"` |
| `-A <rules>` / `-AX <rules>` | `te bpa run --rules <rules>` (`-AX` = no model rules, which is default) |
| `-D <server> <db>` | `te deploy <model> -s <server> -d <db>` |
| `-O` | (default; overwrite) |
| `-C` | `--deploy-connections` |
| `-P` | `--deploy-partitions` |
| `-R` / `-M` / `-SHARED` | `--deploy-roles` / `--deploy-role-members` / `--deploy-shared-expressions` |
| `-FULL` | `--deploy-full` |
| `-X <file>` | `--xmla <file>` (use `-` for stdout) |
| `-V` / `-G` | `--ci vsts` (also `azdo`/`azure-devops`) / `--ci github` (also `gh`); on `validate`, `bpa run`, `deploy`, `script`, `test run` |
| `-T <file>` | `--trx <file>` |
| `-B <file>` | `te save -o <file> --serialization bim` |
| `-TMDL <dir>` | `te save -o <dir> --serialization tmdl` (default format) |
| `-F <dir>` | `te save -o <dir> --serialization database.json` (or `--deploy-full` after `-D`) |
| `-Y` | `--deploy-partitions --skip-refresh-policy` |
| `-W` / `-E` | (default) |
| `-L <user> <pass>` (after `-D`) | `te auth login -u <id> -p <secret> -t <tenant>` (prefer env vars) |
| `-SC` | _Not yet implemented_ |

**Behavioral differences from TE2**:
- `te deploy` runs BPA as pre-flight gate by default (TE2 didn't). `--skip-bpa` to disable, `--fix-bpa` to auto-fix.
- `te deploy` prompts for confirmation. CI must pass `--force`.
- All commands support `--output-format json` for machine-readable output.
- No `start /wait` wrapper needed on Windows; it's a normal console binary.
