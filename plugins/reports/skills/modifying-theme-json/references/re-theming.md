# Re-Theming a Report (Theme A to Theme B)

Switching a finished report from one theme to another is a migration, not a fresh theme build. The new theme renders perfectly in isolation, yet the report looks broken because the swap left **theme residue** behind. Two kinds:

1. **Surviving level-4 overrides.** Per-visual colors baked into `objects` / `visualContainerObjects` still win at the top of the cascade (see SKILL.md, The Formatting Hierarchy). The theme changed; the visual did not.
2. **Polarity-stale colors.** A color chosen to read against the *old* background is wrong against the *new* one. The classic symptom is **invisible text**: dark labels that were fine on a white canvas vanish once the new theme paints the canvas dark.

Editing only `theme.json` swaps the contract but leaves both residues in place. The fix is a sequenced sweep, and it depends on one artifact built *before* you touch anything: the old-to-new color map.

## Build the Old-to-New Color Map First

Before the swap, enumerate where the outgoing palette actually lives, so every color has a known destination. Do this first; after the swap you are guessing what a stray hex used to mean.

```bash
# Palette deltas between the current theme and the incoming one
pbir theme diff "Report.Report" New.theme.json --colors

# Every hardcoded hex baked into visuals (the residue you will have to rewrite)
pbir theme colors "Report.Report" --visuals --type literal
```

Turn the output into an explicit contract. For each outgoing color, record what **role** it plays and where it lands:

```yaml
# old-to-new color map (the "color contract")
"#118DFF":  { role: accent,   was: dataColors[0],        to: theme:0 }      # brand blue series
"#107C10":  { role: accent,   was: named:good,           to: named:good }   # positive KPI
"#1B1B1B":  { role: surface,  was: slicer header.background, to: backgroundLight }  # see role-preserving remap
"#FFFFFF":  { role: foreground, was: inline fontColor on cards, to: firstLevelElements (clear it) }
```

The governing rule for the whole map: **preserve semantic role, not nearest hex.** Classify each color as data-encoding *accent*, structural *surface*, or *foreground* text, then map role to role. A remapper that matches each old hex to its nearest new palette color will quietly turn a dark surface into a bright accent (the slicer header trap below). This is the role-preserving remap, and it is the contract the rest of the sweep executes against.

## Sweep Order (Why Sequence Matters)

The steps are not interchangeable. Clear-formatting resets container chrome to inherit the new theme, but the literal remap (`--replace --to theme:N` and `--normalize`) only resolves correctly once the new palette is in place. Run them in the wrong order and you remap literals to the old palette you just deleted.

```bash
# 1. Apply the new theme (copy, template, or build from a serialized folder)
pbir cp "Brand.Report/theme" "Report.Report/theme" -f
#   or  pbir theme apply-template "Report.Report" corporate-brand -f
#   or  pbir theme build /tmp/New.Theme -o "Report.Report" -f --clean

# 2. Sweep inline overrides; --keep-cf so conditional-formatting expressions survive
pbir visuals clear-formatting "Report.Report/**/*.Visual" --keep-cf -f

# 3. Remap the literals that survived, per the color contract (now resolves against the NEW palette)
pbir theme colors "Report.Report" --replace --from "#118DFF" --to theme:0
pbir theme colors "Report.Report" --replace --from "#1B1B1B" --to named:backgroundLight   # add --dry-run first to confirm the from-hex only lives on the header surface

# 4. Normalize any remaining stray hex onto the nearest theme reference
pbir theme colors "Report.Report" --normalize --apply

# 5. Validate, then render-verify (see Verify by Rendering)
pbir theme validate "Report.Report"
```

Apply theme, then sweep, then remap, then normalize, then validate, then look at it. Always `--keep-cf`. See `references/applying-themes.md` for the enforcement commands and `pbir-cli` -> `references/apply-theme.md` for the JSON mechanics.

## Inline Overrides on Shapes, Textboxes, and Buttons

`clear-formatting --keep-cf` strips container chrome, but decorative and navigation visuals carry color *inside* properties that are legitimate content, not chrome. A blanket clear leaves them alone, so they are the stubborn residue:

- **shapes** ... `shape.fill.fillColor`, `shape.outline.lineColor` (hand-colored callouts, dividers)
- **textboxes** ... color on individual text runs
- **buttons** (`actionButton`) ... `fill.fillColor`, `text.fontColor`, `outline.lineColor`, repeated across the default / hover / press / selected / disabled states

A brand-blue button fill is a literal hex that outlives the sweep. Catch each one in the color map and rewrite it, scoping with `--in`:

```bash
pbir theme colors "Report.Report" --replace --from "#118DFF" --to theme:0 --in fill
```

Better, push these to per-type overrides so they re-skin automatically on the *next* swap and never become residue again. Edit the serialized `actionButton` / `shape` / `textbox` style files, then rebuild:

```bash
pbir theme serialize "Report.Report" -o /tmp/Re.Theme
# edit /tmp/Re.Theme/actionButton.json, shape.json, textbox.json so fills/fonts pull from the palette
pbir theme build /tmp/Re.Theme -o "Report.Report" -f --clean
```

## The Polarity Flip (the Dark <-> Light Gate)

Whenever the swap crosses the light/dark boundary, run the **polarity gate**. Any color pinned for contrast against the old background is now wrong. Detect the flip by comparing the luminance of old vs new `background` and `firstLevelElements`; if they invert, the gate is on.

When the gate is on, hunt every place a foreground color was pinned and either clear it (so it inherits the new structural `firstLevelElements`) or remap it to the inverted role:

- inline `fontColor` on textboxes, buttons, cards, and slicer items
- `dataLabels` color
- visual `title` `fontColor`

Treat **"text became invisible after the swap"** as the canonical evidence the polarity gate was skipped. Clearing the pin is usually right: structural keys already carry the correct foreground for the new polarity, so inheritance fixes it for free. This is the report-side companion to the dark-theme structural-color trap in `references/theme-authoring.md`; that trap is about authoring the structural keys with mutual contrast, this gate is about removing the stale pins that fight them.

## Dark-Mode Checklist (Landing on a Dark Theme)

A go / no-go list specific to swapping *onto* dark. It extends the structural-color trap rather than repeating it; see `references/theme-authoring.md` for why each key behaves as it does.

- [ ] `firstLevelElements` / `secondLevelElements` / `background` set with mutual contrast so gridlines and axis labels survive
- [ ] light text-class variants repointed (they pull from the structural keys and break silently)
- [ ] per-visual backgrounds that were transparent over white now set to an explicit dark surface, or they **punch through** as white holes
- [ ] image and logo assets with baked-in white backgrounds flagged for replacement
- [ ] page wallpaper / canvas background set, not just visual backgrounds
- [ ] contrast verified against WCAG (`pbi-report-design` -> visual-colors reference)

**Punch-through** is the surface analog of invisible text: a container background left transparent reads as "white" because nothing was behind it but the old light canvas. On dark, that transparency exposes nothing, so the visual sits in a bright rectangle. Give those containers an explicit dark surface from the palette.

## Slicer header.background Is a Surface, Not an Accent

The flagship of the role-preserving rule. Under a dark theme, a slicer's `header.background` was usually a dark *surface* color. A nearest-hex remapper sees "darkish color, closest new palette entry is `dataColors[2]`" and maps it onto a bright accent, turning a quiet header bar into a loud colored block.

The header is structural chrome, not data encoding. On a dark-to-light switch it must land on a **light neutral surface** (`background` / `backgroundLight`), never on a freshly introduced accent:

```bash
# right: surface to surface. --replace scopes by from-color and (optionally) property type via --in fill,
# not by "header", so dry-run first to confirm the from-hex lives only on the header, then drop --dry-run.
pbir theme colors "Report.Report" --replace --from "#1B1B1B" --to named:backgroundLight --dry-run

# wrong: surface to accent (nearest-hex would do this; the loud-block bug)
# pbir theme colors "Report.Report" --replace --from "#1B1B1B" --to theme:2
```

If the dry-run shows that dark surface hex also lives elsewhere, do not blanket-replace it; format the slicer's `header.background` directly on that visual instead. Slicer header text and outline derive partly from `secondLevelElements` (see `references/theme-authoring.md`); once the header surface is a light neutral, confirm its text still has contrast rather than re-pinning it.

## Verify by Rendering, Never by File Inspection Alone

A re-theme can pass `pbir theme validate` and parse as clean JSON while rendering invisible text, white holes, or a neon slicer header. JSON validity says nothing about figure-ground separation. Close the loop on the canvas:

```bash
pbir desktop screenshot "Report.Report/Page.Page" -o verify.png
# read verify.png; confirm text is legible, no white holes, slicer headers are quiet surfaces
```

One caveat for theme swaps: a canvas refresh re-reads pages and visuals from disk but **not** `StaticResources`, so theme edits only render after the file is closed and reopened in Desktop. Reopen before trusting the screenshot. See `pbir-cli` -> `references/desktop-integration.md` for the refresh / screenshot loop. The rendered acceptance gate, not the validator, is what signs off a swap.
