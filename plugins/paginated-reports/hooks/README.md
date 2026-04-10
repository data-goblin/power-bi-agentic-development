# Paginated Reports Hooks

A PostToolUse hook that auto-validates paginated report (`.rdl`) files after they are written or edited, in the spirit of the PBIP plugin's `validate-tmdl.sh` / `validate-pbir.sh` (which likewise wire only Write and Edit).

## Files

- `hooks.json` - wires `validate-rdl.sh` to the `Write` and `Edit` matchers, filtered to `**/*.rdl` (10s timeout).
- `validate-rdl.sh` - runs the bundled `skills/paginated-report/scripts/validate_rdl.py` on the `.rdl` that Write/Edit wrote (single `file_path`). Blocks with exit 2 + stderr on structural errors; exits 0 otherwise. It is intentionally not wired to Bash: a PostToolUse hook cannot tell whether a Bash command wrote or merely read an `.rdl`, so blocking on Bash would hard-stop reads/cleanup (`cat`/`grep`/`rm`) and the workflow's own validate command on a not-yet-fixed file. Validate a Bash-created `.rdl` by running `validate_rdl.py` directly.
- `config.yaml` - toggles: `rdl_validation` (this check) and `all_hooks_enabled` (master kill-switch). Set either to `false` to disable.

## What it checks

Whatever `validate_rdl.py` checks: XML well-formedness, the 2016 root namespace, a valid `rd:ReportID` GUID, top-level element order, namespace-scoped `Name` uniqueness, tablix column/row/cell-count invariants, dataset-to-datasource and tablix-to-dataset references, embedded-image references, and dimension unit suffixes. It does not check expressions, live field references, or render correctness; those surface at render time.

## Constraints

- Requires `python3` (or `python`) and `jq`; skips silently if either is missing or the validator script is not found.
- Works on bash 3.2 (macOS) and bash 4+ (Linux, Git Bash); no associative arrays, no `mapfile`.
- Only exit 2 + stderr surfaces in Claude Code; a passing run is invisible.

## Test

```bash
echo '{"tool_name":"Write","tool_input":{"file_path":"plugins/paginated-reports/skills/paginated-report/assets/enter-data-starter.rdl"}}' \
  | bash plugins/paginated-reports/hooks/validate-rdl.sh; echo "exit=$?"
```
