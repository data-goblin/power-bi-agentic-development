# Style Presets

Style presets apply a curated bundle of visual formatting in one step. Use them when the user wants a consistent look across many visuals without specifying every property.

Presets are named formatting templates. Applying one writes a defined set of container properties (title, border, background, padding, header, etc.) onto the target visual, overriding the visual's current formatting at those slots. They do not touch the report theme.

## Available Presets

```bash
pbir visuals preset --list
```

Returns: `minimal`, `bold`, `clean`, `emphasis`, `presentation`. Each preset has a defined character:

- `minimal`: removes borders, shadows, headers; reduces title weight
- `clean`: light borders, subtle title styling, no shadow
- `bold`: heavier borders, prominent title, stronger background contrast
- `emphasis`: card-style background, accent border, prominent title
- `presentation`: large titles and padding tuned for slide-style review

## Apply to a Single Visual

```bash
pbir visuals preset "Report.Report/Page.Page/Visual.Visual" --name minimal
```

## Apply in Bulk (Glob)

```bash
pbir visuals preset "Report.Report/**/*.Visual" --name presentation
pbir visuals preset "Report.Report/Page.Page/*.Visual" --name clean
```

Bulk application does not require `-f`; presets are non-destructive in the sense that they overwrite specific named properties only.

## Pairing with Theme

Presets and themes are complementary:
- **Theme** controls colors, fonts, and visual-type defaults that cascade everywhere
- **Preset** is a one-shot bundle for a specific visual or set of visuals

For maximum consistency, set up a theme (`pbir theme apply-template` or `pbir new report` defaults), then use presets sparingly for visuals that should stand out from the cascade. Avoid applying multiple presets in sequence; the last one wins on overlapping properties.

## When Not to Use

- A custom property bundle the user describes verbally: build it once with `pbir visuals title/border/background` and consider promoting to a theme rule via `pbir theme set-formatting`.
- Bespoke single-visual formatting: prefer the targeted command (`pbir visuals title`, `pbir visuals border`, etc.).
- Changes that should propagate to all visuals of a type: use `pbir theme set-formatting`, not a preset.
