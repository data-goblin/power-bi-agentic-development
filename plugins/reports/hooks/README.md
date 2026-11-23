# reports hooks and the report pane

`hooks.json` wires two things.

## `/report-pane`

A Claude Code mod (module `register.tsx`) that shows the `.Report` folder as a tree beside the conversation and highlights what Claude reads or changes through `pbir` or PBIR file edits.

- Command: `/report-pane [path to a .Report folder]`. With no argument it waits for the first `pbir` command or follows the active report
- Scope: it follows `pbir` and PBIR file edits; it does not run commands or change the report itself
- Requires Claude Code 2.1.287 or newer; it does not appear in Copilot CLI
- Options (Claude Code plugin settings, defined in `.claude-plugin/plugin.json`):

```yaml
glyphs:      auto | fabric | nerd | plain; icon set, auto picks FabricSymbols NF, then a Nerd Font, then plain Unicode
follow:      on | off; whether the tree scrolls to what Claude touches
reportLinks: embed | portal; which Fabric link "open in Fabric" uses
fontHint:    on | off; a one-time hint about the fonts when icons fall back to plain Unicode
```

## `pbir-nudge.sh`

A `PreToolUse` hook on `Write` and `Edit` of files under `*.Report/definition/` and `*.Report/StaticResources/`. It adds context telling the model that `pbir` validates its own writes and to run `pbir validate` after a manual change. It never blocks: Microsoft documents PBIR as hand-editable. When `pbir` is not on `PATH` it says so on stderr and does nothing else.

PBIR structure checks after an edit belong to the `pbip` plugin's hooks.
