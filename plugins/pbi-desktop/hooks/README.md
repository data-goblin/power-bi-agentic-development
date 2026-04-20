# PBI Desktop Validation Hooks

PreToolUse and PostToolUse hooks that validate DAX references, enforce measure metadata, refresh model metadata, and check referential integrity when working with Power BI Desktop via TOM/ADOMD.NET.

## Hook files

| Hook | Event | Trigger (`if`) | Scope |
|---|---|---|---|
| `validate-dax` | PreToolUse | `Bash(*tom_nuget*)` | DAX table/column/measure references in inline PowerShell commands |
| `validate-measure` | PreToolUse | `Bash(*Measures.Add*)` | Measure DisplayFolder, Description, FormatString when adding measures |
| `refresh-cache` | PostToolUse | `Bash(*AnalysisServices*)` | Auto-refresh model metadata cache on TOM connect or modification |
| `check-ri` | PostToolUse | `Bash(*model.SaveChanges*)` | Referential integrity; unmatched keys after relationship/column changes |
| `check-compat` | PostToolUse | `Bash(*AnalysisServices*)` | Compatibility level; lists features available by upgrading |

## Checks

All checks are toggleable via `config.yaml`. Set any key to `false` to disable.

| Config key | Check | Hook |
|---|---|---|
| `dax_validation` | Table/column/measure references exist in model | validate-dax |
| `measure_metadata` | New measures have DisplayFolder, Description, FormatString | validate-measure |
| `metadata_refresh` | Auto-refresh cache after TOM connect or model modification | refresh-cache |
| `referential_integrity` | Unmatched many-side keys after relationship/column changes | check-ri |
| `compatibility_check` | Report features available if model CL is below engine max | check-compat |
| `compatibility_auto_upgrade` | Auto-upgrade CL to engine max (IRREVERSIBLE; default false) | check-compat |

## Graceful degradation

- If the `pbi-hooks` binary is not found, hooks skip silently
- If `tmp/model-metadata.json` does not exist, validation hooks skip silently
- If metadata JSON is corrupt, hooks skip silently
- If no Parallels VM is running and `powershell.exe` is not available, hooks skip silently
- If `config.yaml` is missing, all checks default to enabled
- Every error message includes the config.yaml path for transient disable

## Known limitations

- `.ps1` file execution hides content from `if` filters; hooks only validate inline PowerShell commands
- `if` glob patterns are case-sensitive
- UNC path conversion assumes `/Users/<user>/` prefix (macOS Parallels)

## Testing

```bash
echo '{"tool_name":"Bash","tool_input":{"command":"EVALUATE '"'"'FakeTable'"'"'[Col]"}}' | \
  CLAUDE_PROJECT_DIR="$(pwd)" CLAUDE_PLUGIN_ROOT="$(pwd)/plugins/pbi-desktop" \
  bash plugins/pbi-desktop/hooks/run-pbi-hooks.sh validate-dax
```
