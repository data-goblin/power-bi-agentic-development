# PBIP hooks

Checks that run after the agent writes or edits a file in a PBIP project. They block (exit 2) only when a real tool or a hard rule reports an error in the edited file, and they say so once per session when a tool they use is missing, instead of passing silently.

```dirtree
hooks.json                 Claude Code wiring (Edit and Write; SessionStart doctor)
copilot-hooks.json         Copilot CLI wiring, through run-hook.ps1
config.yaml                switches for each check
lib.sh                     shared helpers
validate-pbir.sh           *.Report/ files
validate-tmdl.sh           *.tmdl files
validate-report-binding.sh definition.pbir
doctor.sh                  SessionStart: which checks are off
```

## Checks

- `validate-tmdl.sh` finds the model root (the folder with `model.tmdl`) and runs `te validate --model <root> --errors-only --non-interactive`. A TMDL parse error blocks. Reference and DAX errors are sent to the model as advisory context, because a multi-file refactor is invalid half-way. Without `te` it says so once and lets the edit through
- `validate-pbir.sh` checks JSON syntax and the page and visual naming rule (letters, digits, underscore, hyphen; at most 50 characters), then runs `pbir validate <report> --json` and blocks only on errors located in the edited file. Without `pbir` it falls back to required properties and the `$schema` prefix
- `validate-report-binding.sh` checks that `definition.pbir` has `byPath` or `byConnection` and that a `byPath` target exists. `fab_exists` (off by default) asks Fabric whether a `byConnection` model exists; it needs `fab` and a network call

The `te` wrapper installs and updates itself on first use. The hook calls `te` only when its managed binary is already installed, so a hook never triggers a download.

## Config

`config.yaml` holds one switch per check and a master switch, `all_hooks_enabled`. Any key set to `false` turns that check off.

## Known Windows issues

Claude Code has open bugs that produce spurious `PostToolUse hook error` notices on Windows: the `if` field is ignored ([#49229](https://github.com/anthropics/claude-code/issues/49229)), `${CLAUDE_PLUGIN_ROOT}` breaks on paths with spaces ([#38800](https://github.com/anthropics/claude-code/issues/38800)), and hooks can hang ([#34457](https://github.com/anthropics/claude-code/issues/34457)). The scripts exit 0 on any environment failure, so the notices are cosmetic. Set `all_hooks_enabled: false` to silence them.

## Copilot CLI

Copilot CLI does not read `hooks.json`; `../.github/plugin/plugin.json` points it at `copilot-hooks.json`. Copilot hooks run user-wide and without an `if` filter, so each script re-applies its own path filter and exits 0 on anything unrelated. On Windows `run-hook.ps1` locates Git Bash, forwards stdin, and exits 0 unless the script returns 2. The `doctor.sh` SessionStart hook is Claude Code only.

## Test by hand

```bash
printf '{"tool_name":"Edit","session_id":"t","tool_input":{"file_path":"%s"}}' "$PWD/Bikes.SemanticModel/definition/tables/Sales.tmdl" | bash validate-tmdl.sh
```

Exit 2 with the message on stderr is a block; exit 0 with JSON on stdout is advisory context.
