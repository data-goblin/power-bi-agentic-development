# pbi-desktop hooks

Windows only. Power BI Desktop and its local Analysis Services engine exist only on Windows, so on Linux and macOS these hooks are off. They say so: a SessionStart message names the missing piece (not Windows, or `te` not on PATH). When everything is on the hook is silent.

## What runs

```yaml
SessionStart: desktop-hooks.sh session
  prints one line when a check is off; never installs anything
PostToolUse on Bash, only when the command or the .ps1 it runs contains SaveChanges: desktop-hooks.sh post
  te validate --local --errors-only        validation errors are returned to the agent (exit 2)
  te bpa run --local -r measure-metadata-rules.json   visible measures without description, display folder or format string: a note, never a block
```

Everything else fails open: `te` missing (one stderr note per session), `te` failing to attach (note with the first line of its error), a timeout, no `jq` (the metadata note is skipped). The old regex checks of DAX references, referential integrity and compatibility level, and the cache file written into the project, are gone: `te validate` covers DAX and relationship integrity against the real engine.

## Config

`config.yaml` next to the scripts: `all_hooks_enabled`, `model_validation`, `measure_metadata`. Set a key to `false` or `off`.

## Platforms

- Claude Code on Windows runs hooks through Git Bash (`bash` and the `timeout` command). Copilot CLI runs `copilot-hooks.json` through PowerShell; `run-hook.ps1` finds Git Bash, forwards stdin, and exits 2 only when the script blocks. If Git Bash is missing it prints that the hooks are off
- A macOS host with Desktop inside Parallels is not covered: run `te validate --local` inside the VM
- `te --local` attaches to one Desktop instance; with several open it needs a choice and the hook reports that it did not run

## Testing

On any system, with a stub or real `te`:

```bash
echo '{"tool_input":{"command":"powershell -Command $model.SaveChanges()"}}' | \
  PBI_DESKTOP_HOOKS_FORCE=1 bash plugins/pbi-desktop/hooks/desktop-hooks.sh post
```
