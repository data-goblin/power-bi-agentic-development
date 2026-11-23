---
name: te2-cli
description: Tabular Editor 2 command line (TabularEditor.exe) for existing Windows pipelines. Use only when the user runs or maintains TabularEditor.exe with TE2 flags such as -D, -S, -A, -B, -TMDL, -O, -C, -V, -G, -T, or wants to port such a pipeline to the cross-platform te CLI. For any new work, the te-cli skill applies.
---

# Tabular Editor 2 command line

`TabularEditor.exe` is free and Windows only ([releases](https://github.com/TabularEditor/TabularEditor/releases), flags in [Command-line-Options](https://docs.tabulareditor.com/Command-line-Options)). The `te` CLI replaces it; `te util migrate` is the maintained flag mapping, so this skill does not repeat it.

## Port a TE2 command

```bash
te util migrate           # every TE2 flag and its te equivalent
te util migrate -D        # one flag
te util migrate --output-format json
```

`te util` never loads a model. Checked on te 0.8.1.1: 26 flags map, one does not (`-LOGIN`).

## Flags that trip people up

- `-S`, `-F` and `-L` change meaning after `-D`: `-S` becomes `-SHARED` (deploy shared expressions), `-F` becomes `-FULL`, `-L` becomes `-LOGIN` (takes a user and a password). Before `-D`, `-L` means `-LOCAL` (connect to a running Power BI Desktop)
- `-C` deploys data source connections, overwriting existing ones; it does not mean "create". It maps to `te deploy --deploy-connections`
- `-G` prints GitHub Actions workflow commands; it does not write SARIF. `-V` does the same for Azure DevOps, and `-T <file>` writes a VSTEST `.trx` file that Azure DevOps shows as test results. TMDL output is `-TMDL <folder>`, not `-T`
- `-LOGIN` (SQL-style user and password on a deploy) has no `te` equivalent. Use `te auth login` or `--auth env` with service principal variables
- A TE2 input is a `Model.bim` or a `database.json` folder, or a server and database. TMDL as input is not documented for TE2 (Unverified: not run, TE2 is not installed here); `te` reads TMDL, `.bim`, `.pbip` and `.SemanticModel`
- `te deploy` and `te refresh` are dry runs until `--execute`; add `--force` in CI because `--execute` otherwise asks for confirmation

## Keep a pipeline running while you port it

`te` accepts TE2 syntax when `TE_COMPAT=te2` is set, the binary is renamed `te2`, or the first argument is not a `te` command and a TE2 flag is present (per the upstream te-cli migration notes; not run here). Convert one flag group at a time (`-A` to `te bpa run`, `-D` to `te deploy --execute --force`, `-V` and `-G` to `--ci`), run `te validate` on the model after each step, then add `--non-interactive` everywhere.

See the te-cli skill for the command set and `references/te2-migration.md` there for the upstream table.
