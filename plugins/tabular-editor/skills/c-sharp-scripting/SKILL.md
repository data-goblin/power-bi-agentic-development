---
name: c-sharp-scripting
description: C# scripts and macros for semantic models in Tabular Editor. Use when asked to write, fix or run a .csx or .cs script, bulk-edit model objects with C#, or use the script environment (Model, Selected, Output, Info, helper methods), and to decide what runs under `te script` versus the TE3 or TE2 desktop app.
---

# C# scripting for Tabular Editor

Run a script with `te script` (te-cli skill). The script API is the Tabular Object Model plus Tabular Editor's helpers: [C# scripts](https://docs.tabulareditor.com/features/csharp-scripts.html), [TOM API](https://learn.microsoft.com/en-us/dotnet/api/microsoft.analysisservices.tabular). Learn what a property is called with `te get <path> --properties`.

## Rules

- Under `te script`, the model is a dry run until `--save`; there is no Ctrl+Z. Run once without `--save`, read the diff, then add `--save`
- WinForms is not loaded under `te script`: `ShowPrompt`, selection dialogs and any `System.Windows.Forms` type fail to compile. Scripts that need a dialog are TE3 Desktop scripts; `scripts/edit-*-interactive.csx` in the te-cli skill are examples (they fail `te script --validate` with missing `Padding`, `TreeNode` and similar types)
- In `te script` the symbol `TECLI` is defined and `TE3` is not. A guard written `#if TE3 ... #else (TE2)` takes the TE2 branch under `te`. Write `#if TECLI`, then `#elif TE3`, then `#else` for TE2 (verified: a script printed TECLI)
- `te script --validate --file x.csx` compiles without running and loads no model; use it on every script you write or edit. The tabular-editor plugin hook does it after each `.csx` edit and reports problems without blocking, since TE3-only scripts fail by design
- Inline code: `te script --model <model> --inline 'foreach (var m in Model.AllMeasures) m.FormatString = "#,0";'`; several `--file` and `--inline` run in the order given; `--inline -` reads stdin
- `Error("text")` makes `te script` exit non-zero; TE2 reported success. Each script runs in one update batch, so formula fix-up on a rename applies when the script ends
- Prefer a `te` command (`te set`, `te mv`, `te add`) over a script for one-object changes; use a script for loops and conditions

## Environments

```yaml
te script: Linux, macOS, Windows; headless; TECLI defined; no Selected, no WinForms, no macro UI
Tabular Editor 3 Desktop: TE3 defined; Selected, dialogs and the macro UI work; macros are registered in MacroActions.json (schema/macros-schema.json)
Tabular Editor 2: neither TE3 nor TECLI
```

## Examples

`examples/` holds about 180 `.csx` scripts by topic (measures, columns, calculation groups, perspectives, roles, partitions, relationships, translations, SVG measures, DAX evaluation, formatting). Run one the same way, for instance:

```bash
te script --model <model> --file examples/format-strings/apply_format_by_name.csx
```

Nine of them use `Selected`; rewrite those with a filter before running them under `te`. Run `te script --validate --file <script>` first: a script that fails there needs the TE3 desktop app or a fix.
