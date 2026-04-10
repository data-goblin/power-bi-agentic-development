# `te` gotchas

Sharp edges and non-obvious behavior. Companion to the te-cli skill (SKILL.md).

## Gotchas

### Path & property-name asymmetries

- **MPartition path asymmetry**: `te add` for an MPartition uses `<Table>/<PartitionName>` (no `/Partitions/` segment). Every other partition command; `te remove`, `te get`, `te list`, `te move`, `te set`; uses `<Table>/Partitions/<PartitionName>`. Mixing these up errors with "Cannot add a MPartition at path … Check that -t matches the path shape."
- **Partition M property: `MExpression` for `te set`, `expression` for `te get`**: `te get <Table>/Partitions/<P>` displays the M as `expression`, but `te set -q expression …` errors with "Property 'expression' not found on MPartition. Did you mean: MExpression?"; use `-q MExpression -i "<M>" --save` to update.
- **`te move` cannot rename a partition to its parent table's name**: `te move <Table>/Partitions/<Table>_m <Table>/Partitions/<Table>` errors with either "Destination '<Table>/<Table>' already exists" or "Partition '<Table>' not found in table '<Table>'"; the destination path `<Table>/<Table>` resolves to the **table object itself**, not a partition slot inside the table. Passing `-t Partition` does **not** disambiguate. Workaround: rename via the `Name` property; `te set <Table>/Partitions/<Table>_m -q Name -i <Table> --save`.
- **Object paths use `/` as separator**, not `\` or `.`. Quote paths with spaces: `"Sales 2024"/Revenue`, `"_Measures/Total Revenue"`, `"Date/Date Hierarchy/Year"`.
- **Relationship names are often auto-assigned**: `te list Relationships` and `te list --type relationship` do enumerate every relationship, but the display name is frequently a system-generated GUID or `Relationship 2` rather than something readable. For a human-friendly view with cross-filter direction and active flag, prefer `te query "EVALUATE INFO.VIEW.RELATIONSHIPS()"` (or `INFO.RELATIONSHIPS()` on older compat). A single relationship is addressable by name via `te get Relationships/<name>` once you know it.

### Object types and creation

- **`-t DataColumn` is not accepted by `te add`**: data columns are declared at table creation via `--columns "Name:Type,..."` (auto-creates with `SourceColumn = Name`). Tune additional properties (`IsKey`, `IsHidden`, `FormatString`, `SummarizeBy`, `SortByColumn`, `Description`) afterwards with `te set`. Only `CalculatedColumn` can be added individually with `-t CalculatedColumn -i "<DAX>"`.
- **Workflow ordering; relationships before measures**: measures that use `RELATED()` or cross-table `CALCULATE()` are validated at save time. If the relationship doesn't exist yet, the save gate rejects with `DAX0002: Column '<T>'[<C>] doesn't have a relationship to any table available in the current context`. Add relationships before authoring dependent measures. If that order is impossible (scripted batch creation), use `--force` only as a last resort and run `te validate` immediately after to confirm no DAX errors remain before committing.
- **`te remove` on the last partition fails** with "Cannot remove last partition from table". Always add a replacement partition first, then remove the original.
- **Silent M syntax errors during partition authoring**: a typo in the partition M (unbalanced braces, an unquoted token) doesn't always raise at save time. After creating a data-bound table, sanity-check with `te get <Table>/Partitions/<Table>` to confirm `sourceType: M` and that the expression matches what was passed in.

### Output shapes

- **`te bpa run --output-format json`**: top-level `violations` is the **count** (integer), top-level `results` is the **list** of violation objects with `ruleId`, `severityLabel`, `objectName`, `canFix`, etc. Don't confuse the two when piping into `jq`.
- **`te bpa run --fix [--save] --output-format json` can emit TWO concatenated JSON documents** to stdout: the scan result (`{model, rulesEvaluated, violations, results, errors, ...}`), then a fix summary (`{fixed, fixErrors, skipped, fixedItems, fixErrorItems}`) when fixes actually apply. When nothing is fixable (all violations `canFix: false`), only the scan document is emitted, so don't hard-code a two-document assumption either. Strict single-document parsers fail with an "extra data" / "trailing tokens" error on the second document. Prefer in this order:
  1. **`jq --slurp`** (shell-native, no interpreter dependency): `te bpa run --fix --save --output-format json | jq -s '.[0].violations'` (scan count) or `jq -s '.[1].fixed'` (fix count). `--slurp` reads concatenated documents into an array.
  2. **Drop `--output-format json` entirely** and rely on the human-readable text for one-shot summaries; simplest and works without any extra tooling. Pair with `--ci github`/`--ci azdo` when machine-actionable annotations are needed.
  3. **Tail-grep for the summary lines** (`grep -E '"violations":|"fixed":' | head -2`) when only the counts are needed.

### Behavior

- **DAX-executing commands need a deployed model**. `te query`, `te vertipaq`, `te refresh`, `te test run`, and `te test snapshot` error with "No server specified" when given only a local `-m` path; pass `-s`/`-d` or set an active connection. Metadata commands (`list`, `get`, `set`, `add`, `validate`, `bpa run`, `format`, `script`) are fine on local models. Offline exception: `te vertipaq --import <file.vpax>`.
- **`te list` is filesystem-style, not workspace-style**. `te list Sales` lists Sales' children (columns + measures), not "find Sales". Use `te find` for full-text search.
- **`--save` is opt-in for editing commands** (when `interactiveEditMode` is the default `stage`). Without it, `te set`, `te add`, `te remove`, `te move`, `te replace`, `te format`, `te script`, `te macro run` operate in memory only and don't persist. See the Staging model section in SKILL.md for the full picture and the `save` / `revert` alternatives.
- **`te validate` does not exercise partition M**; it checks structural/DAX validity, not whether `Table.FromRows` literals parse or SQL endpoints respond. A model with broken partitions still passes `te validate` cleanly. Verify partitions explicitly after table creation.
- **`te connect` is session-scoped (per shell PID)**. Each fresh shell (each Claude Code `Bash` tool call spawns one) starts a new session without the active connection. Either set `TE_SESSION=<name>` to share state between shells, or pass `-m <model>` (and `-s`/`-d` where needed) explicitly to every command.
- **BPA config keys are nested under `bpa.`**. `te config set bpaOnDeploy false` will fail with "Unknown key"; the correct form is `te config set bpa.onDeploy false`. Same for `bpa.onSave`, `bpa.onMutation`, `bpa.rules`, `bpa.builtInRules`, `bpa.disabledBuiltInRuleIds`.
- **`--output-format` (stdout) vs `--serialization` (on-disk)** are different flags. The first picks how stdout is rendered (text/json/csv/tmsl/tmdl); the second picks the model file format (tmdl/bim/database.json/pbip). Passing one when the other was meant gives a confusing error or silent wrong output. `--serialization tmsl` is accepted as an alias for `bim` (matching how `--output-format` already treats the two synonyms); the canonical spelling is `bim`, matching the `.bim` file extension.
- **`te deploy --create-only` fails if model exists**. Use without `--create-only` to overwrite (the default), or check with a probe call first.
- **`te deploy` confirmation prompt hangs CI** without `--force`. Default answer is `n` (safe), so non-interactive runs need `--force --non-interactive`.
- **BPA gate on deploy/save can mask sloppy commits**. If bypassing with `--skip-bpa`, log it loudly. Prefer `--fix-bpa` or address violations.
- **TE2 compat mode auto-detects** when args contain TE2-style flags but no `te` subcommand. Don't rely on this in scripts; be explicit with `TE_COMPAT=te2` so behavior is reproducible.
- **Local SSAS / Power BI Desktop are Windows-only**: `te connect --local` and `te connect "localhost:PORT"` won't work on macOS/Linux even though the binary runs there.
- **Preview banner reappears 14 days before the 2026-09-30 cutoff** regardless of `hidePreviewNotice`. Plan for the hard expiry.
- **Secrets on the cmd line leak** into `ps`, shell history, CI logs. Use `--auth env` with env vars, stdin (`-`), or `--auth managed-identity`.
