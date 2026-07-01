# Report and visual tools

For `reports`, `custom-visuals`, `paginated-reports`, and the PBIR side of `pbip`. Install the base layer (`references/foundation.md`) first.

## pbir (Power BI report CLI)

The engine for the `reports` plugin and the PBIR-editing custom-visuals skills: create, explore, format, validate, and publish reports, serialize/build themes, and drive the Power BI Desktop bridge. Same package on Windows and macOS.

```bash
uv tool install pbir-cli
# or, without uv:
pip install pbir-cli
```

Verify: `pbir --version`. Optional one-time setup: `pbir setup --claude-code` installs the companion skills; `pbir schema fetch` downloads report schemas.

Auth: thin-report and workspace operations rely on `fab` auth (see `references/fabric.md`); `pbir usage` uses your `az login` token.

### Desktop bridge and local DAX (Windows)

`pbir desktop list / refresh / screenshot` reload and screenshot the live report canvas. These are Windows-only and need Power BI Desktop with the preview feature "Enable external tool access to Power BI Desktop through secure local APIs" enabled, then a restart. On macOS/Linux these fail by design; verify instead by publishing to a sandbox (`pbir publish`) and viewing in a browser (Chrome MCP, or Playwright/devtools CLI).

Local thick-report DAX (`pbir model -q`) needs the .NET Framework ADOMD.NET client. `pbir` finds one automatically from an existing DAX Studio or Power BI Desktop install; if none is found, install DAX Studio (Tabular Editor 3's .NET 8 build cannot be loaded for this):

```powershell
# Windows
winget install DaxStudio.DaxStudio
```

Or download from [daxstudio.org](https://daxstudio.org). Override the search with `PBIR_ADOMD_DIR` pointing at a folder containing `Microsoft.AnalysisServices.AdomdClient.dll`. Set `PBIR_DESKTOP_AUTO_REFRESH=1` to fold a refresh into every save.

## Custom visuals: pbiviz + Node

`pbiviz` (the `powerbi-visuals-tools` npm package) scaffolds, builds, packages, and certifies developer visuals. It needs Node.js 20.19+ (install from `references/foundation.md`). Run it without a global install:

```bash
npx -y powerbi-visuals-tools <command>
```

Install the SSL certificate the live preview needs, once:

```bash
pbiviz install-cert
```

Then enable developer-visual mode in Power BI Desktop or the Service. Certification also expects the dev packages (`powerbi-visuals-api`, `-utils-*`, `eslint-plugin-powerbi-visuals`, `typescript`, `eslint`) and a passing `npm install` / `pbiviz package` / `npm audit` / eslint run. The `pbiviz` MCP server config is in `references/fabric.md`.

## Python visuals runtime

For the `python-visuals` skill. On Power BI Desktop, any locally installed package works; there is nothing special to install beyond Python and the libraries you plot with:

```bash
uv pip install matplotlib seaborn pandas numpy
```

The Power BI Service pins exact versions under Python 3.11 (matplotlib 3.8.4, seaborn 0.13.2, and the rest of the scientific stack). plotly, bokeh, and altair are not supported in the Service (networking is blocked). Match your local versions to the Service if you need parity. Reports with Python visuals need Pro/PPU or better in a Fabric-enabled region.

## R visuals runtime

For the `r-visuals` skill. R must be installed separately; match R 4.3.3 to mirror the Service, which ships ggplot2 3.5.1 and roughly a thousand CRAN packages.

```bash
# Windows
winget install RProject.R

# macOS
brew install --cask r
```

R visuals run on Pro/PPU or better, and cannot be certified for AppSource.

## SVG visuals: model-editing tools + DAX libraries

The `svg-visuals` skill writes SVG measures into the semantic model, so it needs one model-editing path. Follow the usual cascade in order of preference: the `te` CLI, then a Power BI Modeling MCP, then the `connect-pbid` TOM stack, then the `tmdl` skill as a last resort (all covered in `references/models.md`). It also needs the DAX UDF libraries it draws from, installed from [daxlib.org](https://daxlib.org) (for example `DaxLib.SVG`, `PowerofBI.IBCS`).

## AI report backgrounds (optional, pbip)

The `pbir-format` skill can generate report background images with Google's Gemini image model. Only needed if you want that.

```bash
uv pip install google-genai pillow keyring
```

Provide a Gemini API key from [aistudio.google.com/apikey](https://aistudio.google.com/apikey), read from the OS keyring (service `gemini-api`) or an env var:

```bash
export GEMINI_API_KEY='...'
```

## Paginated reports (RDL)

The `paginated-reports` plugin edits RDL XML directly and drives a publish/render loop with `curl`, `jq`, and `python3` (all from `references/foundation.md`), authenticating with an `az` token:

```bash
az account get-access-token --resource https://analysis.windows.net/powerbi/api --query accessToken -o tsv
```

Publishing and rendering need a workspace on Premium, Embedded, or Fabric capacity; shared capacity accepts the upload but will not render, and PPU export-to-file is rate-limited to about one request per five minutes.

Two optional local tools:

```
Power BI Report Builder    Windows GUI for RDL; the plugin edits XML instead, so this is optional
Power BI Report Server     local on-prem render during layout iteration; free Developer/Evaluation
                           editions at microsoft.com/power-platform/products/power-bi/report-server
```

Do not install Report Server without asking the user; production use needs SQL Server Enterprise with Software Assurance, and it cannot use Power BI semantic models as a source.
