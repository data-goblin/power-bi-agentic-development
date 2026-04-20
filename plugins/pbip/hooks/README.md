# PBIP Validation Hooks

PostToolUse hooks that validate PBIR and TMDL files after Write, Edit, and Bash tool use.

## Hook files

| Hook | Trigger | Scope |
|---|---|---|
| `validate-pbir.sh` | Write, Edit, Bash | .json/.pbir files in .Report/ |
| `validate-report-binding.sh` | Write, Edit, Bash | definition.pbir binding validation (byPath/byConnection) |
| `validate-tmdl.sh` | Write, Edit, Bash | .tmdl files in .SemanticModel/ or .Dataset/ |

## Checks

All checks are toggleable via `config.yaml`. Set any key to `false` to disable.

| Config key | Check | Hooks |
|---|---|---|
| `json_syntax` | JSON syntax (`jq empty`) | validate-pbir |
| `folder_spaces` | Folder names with spaces (won't render) | validate-pbir |
| `required_fields` | Required fields per file type (from Microsoft JSON schemas) | validate-pbir |
| `schema_url` | `$schema` URL matches expected pattern | validate-pbir |
| `name_format` | Visual/page name is word chars and hyphens only | validate-pbir |
| `bypath_exists` | byPath target directory exists locally | validate-report-binding |
| `fab_exists` | byConnection model exists in Fabric (via `fab exists`) | validate-report-binding |
| `tmdl_syntax` | TMDL structural syntax (via `tmdl-validate`) | validate-tmdl |

## Required fields (from schemas)

Derived from Microsoft's published JSON schemas at [github.com/microsoft/json-schemas](https://github.com/microsoft/json-schemas/tree/main/fabric/item/report/definition).

| File | Schema | Required |
|---|---|---|
| `visual.json` | visualContainer/2.7.0 | `$schema`, `name`, `position` + oneOf(`visual`, `visualGroup`) |
| `page.json` | page/2.1.0 | `$schema`, `name`, `displayName`, `displayOption` |
| `report.json` | report/3.2.0 | `$schema`, `themeCollection` |
| `definition.pbir` | definitionProperties/2.0.0 | `$schema`, `version`, `datasetReference` |

## Graceful degradation

- If `jq` is not installed, all hooks skip silently
- If `fab` CLI is not installed or not authenticated, the `fab_exists` check skips silently
- If `tmdl-validate` binary is not found, TMDL hooks skip silently
- If `config.yaml` is missing, all checks default to enabled

## Known Windows issues

Claude Code has several open bugs that affect plugin hooks on Windows. If you see spurious `PostToolUse hook error` notices on Edit/Write/Bash calls that clearly shouldn't match any `if` filter, you are hitting one or more of:

| Bug | Effect |
|---|---|
| [anthropics/claude-code#49229](https://github.com/anthropics/claude-code/issues/49229) | The `if` field is silently ignored; every matcher entry spawns for every tool call |
| [#38800](https://github.com/anthropics/claude-code/issues/38800) | `${CLAUDE_PLUGIN_ROOT}` expansion breaks when the user path contains spaces |
| [#47070](https://github.com/anthropics/claude-code/issues/47070) | `execvpe(/bin/bash)` fails on Windows with Docker Desktop but no full WSL distro |
| [#50243](https://github.com/anthropics/claude-code/issues/50243) | Bash hooks silently not invoked on Windows with `settings.local.json`-only config |
| [#34457](https://github.com/anthropics/claude-code/issues/34457) | Hooks with shell commands cause 5+ minute hangs/crashes on Windows |

The hook scripts in this plugin defensively exit 0 on any environmental failure so the errors are cosmetic (the tool call still runs). If the noise bothers you, flip the master kill-switch in `config.yaml`:

```yaml
all_hooks_enabled: false
```

That disables every hook in this plugin without touching individual check toggles. Flip it back to `true` once you upgrade to a Claude Code build that resolves the underlying bugs.

## tmdl-validate binary

`validate-tmdl.sh` depends on the `tmdl-validate` binary, which ships prebuilt in `bin/`:

| File | Platform |
|---|---|
| `tmdl-validate-darwin-arm64` | macOS Apple Silicon |
| `tmdl-validate-darwin-x64` | macOS Intel |
| `tmdl-validate-linux-x64` | Linux x86_64 (glibc) |
| `tmdl-validate-windows-x64.exe` | Windows x86_64 |

The hook picks the right binary for the current OS and architecture; if none is found it falls back to `tmdl-validate` on `PATH`, then skips silently.

### Antivirus false positives

These are **unsigned binaries**, so Windows Defender, SmartScreen, and some corporate AV products may flag them as suspicious. They are not. The binary is a small Rust TMDL structural linter with no network access and no filesystem writes, loaded only by a hook you can read in `validate-tmdl.sh`.

This is a known issue that already affected the earlier `pbi-hooks` and `connect-pbid` binaries (see #14), which were eventually replaced with pure-bash and PowerShell scripts for that reason. `tmdl-validate` cannot take the same path; it contains a hand-written TMDL parser that will stay closed-source, so a script port is not on the table.

If your AV quarantines the binary, either whitelist the file, disable the hook by setting `tmdl_syntax: false` in `config.yaml`, or delete the binary and the hook will skip silently.

### Stopgap

This whole binary is a stopgap. It gets replaced by the Tabular Editor 3 CLI (`te validate`) once the TE3 CLI ships in a few weeks, at which point `validate-tmdl.sh` will call `te` instead and the bundled binaries will be removed from the plugin.

## Updating required fields when schemas change

1. Fetch the latest schema:
   ```
   https://raw.githubusercontent.com/microsoft/json-schemas/main/fabric/item/report/definition/{schemaType}/{version}/schema.json
   ```
   For definition.pbir: `.../definitionProperties/{version}/schema.json`

2. Find the top-level `"required"` array. Check `oneOf`/`anyOf` constraints and nested `$ref` definitions.

3. Update the jq extraction and MISSING checks in `validate-pbir.sh`.

4. Update the table above.

5. Test: `echo '{"tool_name":"Write","tool_input":{"file_path":"<path>"}}' | bash plugins/pbip/hooks/validate-pbir.sh`

## "if" filter syntax in hooks.json

Edit/Write `"if"` uses **gitignore path patterns** (recursive `**`, single-level `*`):
- `Edit(**.Report/**)` -- any file inside any .Report/ at any depth
- `Write(**/definition.pbir)` -- definition.pbir at any depth

Bash `"if"` uses **glob text matching** against the command string (not path-aware):
- `Bash(*.Report/*)` -- any command text containing `.Report/`
- `Bash(*.tmdl*)` -- any command text containing `.tmdl`

Pipes not supported in `"if"`; use separate Edit and Write matchers instead of `Write|Edit`.

## Constraints

- 10-second timeout per hook; jq calls are consolidated (one per file type)
- Must work on bash 3.2 (macOS) and bash 4+ (Git Bash / Linux); no `mapfile`, no associative arrays
- `.gitattributes` enforces `eol=lf` so scripts work on Windows checkout
- Only exit 2 + stderr surfaces in Claude Code; stdout exit 0 is invisible
- Full semantic validation (visual types, expressions, field references) belongs in pbir-cli
