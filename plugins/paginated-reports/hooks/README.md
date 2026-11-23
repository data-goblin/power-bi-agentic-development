# Paginated Reports Hooks

A PostToolUse hook that auto-validates paginated report (`.rdl`) files after they are written or edited, in the spirit of the PBIP plugin's `validate-tmdl.sh` / `validate-pbir.sh` (which likewise wire only Write and Edit).

## Files

- `hooks.json` - wires `validate-rdl.sh` to the `Write` and `Edit` matchers, filtered to `**/*.rdl` (10s timeout).
- `validate-rdl.sh` - locates Python and runs `skills/paginated-report/scripts/validate_rdl.py --hook`, which takes the hook JSON on stdin and checks the `.rdl` that Write/Edit wrote (single `file_path`). Blocks with exit 2 + stderr on errors; exits 0 otherwise. It is intentionally not wired to Bash: a PostToolUse hook cannot tell whether a Bash command wrote or merely read an `.rdl`, so blocking on Bash would hard-stop reads/cleanup (`cat`/`grep`/`rm`) and the workflow's own validate command on a not-yet-fixed file. Validate a Bash-created `.rdl` by running `validate_rdl.py` directly.
- `copilot-hooks.json` / `run-hook.ps1` - Copilot CLI wiring for the same script; see Copilot CLI below.
- `config.yaml` - toggles: `rdl_validation` (this check) and `all_hooks_enabled` (master kill-switch). Set either to `false` to disable.

## What it checks

Whatever `validate_rdl.py` checks: XML well-formedness, the 2016 root namespace, a valid `rd:ReportID` GUID, top-level element order, namespace-scoped `Name` uniqueness, tablix column/row/cell-count invariants, dataset-to-datasource and tablix-to-dataset references, embedded-image references, dimension unit suffixes, the PDF width trap (section `Width` plus left and right margin must fit `PageWidth`), and that every `Fields!X`, `Parameters!X` and `ReportItems!X` in an expression resolves (field names are checked against the dataset of the enclosing data region or a quoted scope argument). Warnings cover QueryParameters that the query text never references and the `@` prefix convention per provider. It does not check DAX or SQL text or render correctness; those surface at render time.

## Constraints

- Requires `python3` (or `python`), 3.8 or later. No `jq`. When Python or the validator script is missing the hook prints one line to stderr and lets the edit through.
- Works on bash 3.2 (macOS) and bash 4+ (Linux, Git Bash); no associative arrays, no `mapfile`.
- Only exit 2 + stderr surfaces in Claude Code; a passing run is invisible.

## Copilot CLI

Copilot CLI does not read `hooks.json`; the manifest at `../.github/plugin/plugin.json` points it at `copilot-hooks.json` in this folder instead, which wires the same scripts with explicit `bash` (Unix) and `powershell` (Windows) commands. This matters because Copilot differs from Claude Code in three ways:

- Plugins and their hooks are user-wide: they run in every session on the machine, in every project, so a hook must be inert outside a Power BI project.
- There is no `if` field; a `matcher` filters on tool name only, so every entry fires on every matching tool call. The scripts re-apply their own path and command filters and exit 0 on anything unrelated.
- A PreToolUse hook that exits with any code other than 0 or 2 denies the tool call (fail-closed); this plugin's hook is PostToolUse and never blocks on its own failure, and on Windows the command runs under PowerShell, so a bare `bash "..."` with no Git Bash on `PATH` denies everything. `run-hook.ps1` locates Git Bash, forwards stdin, and exits 0 unless the script itself returns 2; if `bash` or the script cannot be found the hook is a no-op.

If a hook still misbehaves in Copilot, delete the `hooks` folder from the installed copy under `~/.copilot/installed-plugins/` (`%USERPROFILE%\.copilot\installed-plugins\` on Windows); the uninstall notes in the repo README cover the `Access is denied (os error 5)` case.

## Test

```bash
echo '{"tool_name":"Write","tool_input":{"file_path":"plugins/paginated-reports/skills/paginated-report/assets/enter-data-starter.rdl"}}' \
  | bash plugins/paginated-reports/hooks/validate-rdl.sh; echo "exit=$?"
```
