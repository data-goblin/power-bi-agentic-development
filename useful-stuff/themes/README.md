# Omarchy themes for Power BI

Power BI report themes generated from the 22 built-in [Omarchy](https://omarchy.org) desktop themes (`/usr/share/omarchy/themes/*/colors.toml`). Each maps the Omarchy palette onto page, visual, table, matrix, slicer and tooltip styles, with dim text picked by contrast (3:1 against the background) so labels stay readable on light themes too.

What every theme sets:

- **Font:** `'JetBrainsMono Nerd Font', 'JetBrains Mono', Consolas, monospace`. Power BI has no font upload; the viewer sees JetBrains Mono only when it is installed on their machine, and falls back to Consolas, then the browser's monospace font
- **Colours:** Omarchy `green` is the first data colour and the good/sentiment colour, `red` is bad, `yellow` neutral; pages use `dark_background`, visuals `background`, borders `selection`
- **Button slicers:** square, flush tiles; the selected tile gets a 3 px outline in the series colour
- **Tables and matrices:** tooltips are on but fully transparent, so SVG image cells never show their `data:image/svg+xml` URI on hover

## Use

- Power BI Desktop: View > Themes > Browse for themes, pick a file
- pbir CLI: `pbir theme create-template --new-template omarchy-tokyo-night.json --name omarchy-tokyo-night`, then `pbir theme apply-template "Report.Report" omarchy-tokyo-night`

## Themes

Ordered from darkest to lightest, grouped by palette family.

| File | Theme | Background | Series |
|------|-------|------------|--------|
| [`omarchy-vantablack.json`](omarchy-vantablack.json) | Omarchy Vantablack | `#000000` | `#b6b6b6` |
| [`omarchy-last-horizon.json`](omarchy-last-horizon.json) | Omarchy Last Horizon | `#0c0b0c` | `#87a9b0` |
| [`omarchy-solitude.json`](omarchy-solitude.json) | Omarchy Solitude | `#101315` | `#9fa5a9` |
| [`omarchy-matte-black.json`](omarchy-matte-black.json) | Omarchy Matte Black | `#121212` | `#FFC107` |
| [`omarchy-miasma.json`](omarchy-miasma.json) | Omarchy Miasma | `#222222` | `#5f875f` |
| [`omarchy-ristretto.json`](omarchy-ristretto.json) | Omarchy Ristretto | `#2c2525` | `#adda78` |
| [`omarchy-gruvbox.json`](omarchy-gruvbox.json) | Omarchy Gruvbox | `#282828` | `#a9b665` |
| [`omarchy-hackerman.json`](omarchy-hackerman.json) | Omarchy Hackerman | `#0B0C16` | `#4fe88f` |
| [`omarchy-osaka-jade.json`](omarchy-osaka-jade.json) | Omarchy Osaka Jade | `#111c18` | `#549e6a` |
| [`omarchy-everforest.json`](omarchy-everforest.json) | Omarchy Everforest | `#2d353b` | `#a7c080` |
| [`omarchy-ethereal.json`](omarchy-ethereal.json) | Omarchy Ethereal | `#060B1E` | `#92a593` |
| [`omarchy-retro-82.json`](omarchy-retro-82.json) | Omarchy Retro 82 | `#05182e` | `#028391` |
| [`omarchy-tokyo-night.json`](omarchy-tokyo-night.json) | Omarchy Tokyo Night | `#1a1b26` | `#9ece6a` |
| [`omarchy-catppuccin.json`](omarchy-catppuccin.json) | Omarchy Catppuccin | `#1e1e2e` | `#a6e3a1` |
| [`omarchy-kanagawa.json`](omarchy-kanagawa.json) | Omarchy Kanagawa | `#1f1f28` | `#76946a` |
| [`omarchy-lumon.json`](omarchy-lumon.json) | Omarchy Lumon | `#16242d` | `#5e95bc` |
| [`omarchy-nord.json`](omarchy-nord.json) | Omarchy Nord | `#2e3440` | `#a3be8c` |
| [`omarchy-rose-pine.json`](omarchy-rose-pine.json) | Omarchy Rose Pine (light) | `#faf4ed` | `#286983` |
| [`omarchy-flexoki-light.json`](omarchy-flexoki-light.json) | Omarchy Flexoki Light (light) | `#FFFCF0` | `#879A39` |
| [`omarchy-catppuccin-latte.json`](omarchy-catppuccin-latte.json) | Omarchy Catppuccin Latte (light) | `#eff1f5` | `#40a02b` |
| [`omarchy-lupine.json`](omarchy-lupine.json) | Omarchy Lupine (light) | `#fafafa` | `#4a2fd0` |
| [`omarchy-white.json`](omarchy-white.json) | Omarchy White (light) | `#ffffff` | `#3a3a3a` |
