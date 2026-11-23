---
name: modifying-theme-json
description: Use when creating, standardising, auditing, rebranding or validating a Power BI report theme with pbir, or when visuals carry many local formatting overrides that a theme should own (palette, text classes, wildcard and visual-type defaults, promoting a visual's formatting into the theme, clearing overrides). Not for editing theme JSON by hand; not for general layout or design judgement (use pbi-report-design).
---

# Power BI report themes

Command syntax is in `pbir theme --help`; schema facts, the cascade and the limits of released pbir are in [theme cascade](../../wiki/report-theme-cascade.md). The `pbir-cli` skill covers everything else about pbir.

## Rules

1. **Never edit `theme.json`, `visual.json` or serialized `.Theme` fragments directly**, and never fall back to `jq` or shell replacement. If `pbir` lacks the operation, stop and report the gap.
2. **Audit first, then change**: `pbir theme colors`, `pbir theme fonts`, `pbir color list`, `pbir fonts list`, `pbir visuals format <visual>`, `pbir bpa run` (rules `PBIR_HARDCODED_COLORS`, `PBIR_BESPOKE_CONTAINER_OVERRIDES`, `PBIR_NO_THEME`, `PBIR_NONSTANDARD_FONT`).
3. **Start from a valid template or the report's existing theme** (`pbir theme list-templates`, `apply-template`); never author an empty theme. A new report already has the sqlbi theme.
4. **Put repeated formatting in the theme** (wildcard, then visual-type defaults); keep visual overrides for content-specific exceptions and conditional formatting.
5. **Clearing overrides is destructive.** Confirm with the user, `--dry-run` first, and keep conditional formatting with `--keep-cf` unless the user wants it gone.
6. **Validate after each batch**: `pbir theme validate` then `pbir validate --all`.
7. **Desktop does not reload theme resources on refresh.** Close and reopen the report before judging a theme change. Without Desktop, ask before publishing to a sandbox to check the render.

## Workflow

```bash
pbir theme colors "R.Report"
pbir theme set-colors "R.Report" --data-colors '["#1971C2","#F08C00","#2F9E44"]' --good "#2E7D32" --neutral "#6B7280" --bad "#C62828"
pbir theme set-fonts "R.Report" title --font-size 14 --font-face "Segoe UI Semibold"
pbir theme set-formatting "R.Report" "*.*.dropShadow.show" --value false
pbir theme push-visual "R.Report/P.Page/BestCard.Visual" --dry-run
pbir visuals clear-formatting "R.Report/**/*.Visual" --keep-cf --dry-run -f
pbir theme colors "R.Report" --normalize --apply
pbir theme validate "R.Report"
```

Run `pbir schema describe <visualType> <object>` before setting an unfamiliar property.

## Decisions pbir cannot make

- Palette size: as many data colours as the report has categories, not more
- Sentiment colours (good, neutral, bad, selected, disabled, hyperlink) keep one meaning across pages; never rely on hue alone
- One portable font family (Segoe UI) and a small type scale; hierarchy through size and weight
- After a theme swap, clear stale overrides, normalise surviving hex colours, and check that foreground and background did not invert so text stays readable

## Limits of released pbir

- Theme style presets (`visualStyles.<type>.<preset>`) cannot be authored reliably; do not use `pbir theme push-visual --preset` or hand-edit them
- `pbir theme set-fonts` writes only font face, size, weight and colour per text class; italic and underline are per-visual only
- `pbir theme set-colors` has no flag for `null`, `disabledText`, `foregroundSelected` or `foregroundButton`

## Related skills

- `pbir-cli`: path syntax, discovery commands, validation
- `pbi-report-design`: restrained colour use, hierarchy, accessibility
