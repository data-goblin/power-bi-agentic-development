# PBI Desktop Validation Hooks

PreToolUse and PostToolUse hooks that validate DAX references, enforce measure metadata, refresh model metadata, and check referential integrity when working with Power BI Desktop via TOM/ADOMD.NET.

## Hook files

| Hook | Event | Trigger (`if`) | Scope |
|---|---|---|---|
| `validate-dax` | PreToolUse | `Bash(*tom_nuget*)`, `Bash(* -File *.ps1*)` | DAX table/column/measure references in inline PowerShell commands and executed `.ps1` files |
| `validate-measure` | PreToolUse | `Bash(*Measures.Add*)`, `Bash(* -File *.ps1*)` | Measure DisplayFolder, Description, FormatString when adding measures |
| `refresh-cache` | PostToolUse | `Bash(* -File *.ps1*)` | Auto-refresh model metadata cache on TOM connect or modification |
| `check-ri` | PostToolUse | `Bash(*SaveChanges*)` | Referential integrity; unmatched keys after relationship/column changes |
| `check-compat` | PostToolUse | `Bash(* -File *.ps1*)` | Compatibility level; lists features available by upgrading |

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

## Known Windows issues

Claude Code has several open bugs that affect Bash hooks on Windows. If you see spurious `PreToolUse:Bash hook error` or `PostToolUse:Bash hook error` notices on commands that clearly shouldn't match any `if` filter (e.g. `mkdir`, `ls`, `cat`), you are hitting one or more of:

| Bug | Effect |
|---|---|
| [anthropics/claude-code#49229](https://github.com/anthropics/claude-code/issues/49229) | The `if` field is silently ignored; every Bash matcher entry spawns for every Bash call |
| [#38800](https://github.com/anthropics/claude-code/issues/38800) | `${CLAUDE_PLUGIN_ROOT}` expansion breaks when the user path contains spaces |
| [#47070](https://github.com/anthropics/claude-code/issues/47070) | `execvpe(/bin/bash)` fails on Windows with Docker Desktop but no full WSL distro |
| [#50243](https://github.com/anthropics/claude-code/issues/50243) | Bash hooks silently not invoked on Windows with `settings.local.json`-only config |
| [#34457](https://github.com/anthropics/claude-code/issues/34457) | Hooks with shell commands cause 5+ minute hangs/crashes on Windows |

The hook scripts re-apply the `if` triggers internally (see Known limitations) and defensively exit 0 on any environmental failure or non-target command, so a host that ignores `if` cannot turn the hook into a spurious deny. If the noise bothers you, flip the master kill-switch in `config.yaml`:

```yaml
all_hooks_enabled: false
```

That disables every hook in this plugin without touching individual check toggles. Flip it back to `true` once you upgrade to a Claude Code build that resolves the underlying bugs.

## Known limitations

- `if` glob patterns match only the raw command line, not `.ps1` file contents; the scripts compensate by reading executed `.ps1` files internally (`resolve_command_text`), gated by the `Bash(* -File *.ps1*)` triggers
- The `if` triggers are a Claude Code feature. Some hosts ignore them and fire every hook on every Bash call: Copilot CLI by design (its `matcher` filters on tool name only, with no command-content filter, and a non-zero PreToolUse exit denies the tool), and Claude Code on Windows via bug #49229. `pbi-hooks.sh` therefore re-applies each `if` condition before doing any work and exits 0 on non-target commands, so the hook never denies an unrelated command (e.g. `Get-Process`). A `.ps1` run additionally only fires when the script touches the model (references TOM, or adds a measure), so unrelated PowerShell is ignored
- `if` glob patterns are case-sensitive
- UNC path conversion assumes `/Users/<user>/` prefix (macOS Parallels)

## Testing

```bash
echo '{"tool_name":"Bash","tool_input":{"command":"EVALUATE '"'"'FakeTable'"'"'[Col]"}}' | \
  CLAUDE_PROJECT_DIR="$(pwd)" CLAUDE_PLUGIN_ROOT="$(pwd)/plugins/pbi-desktop" \
  bash plugins/pbi-desktop/hooks/pbi-hooks.sh validate-dax
```
