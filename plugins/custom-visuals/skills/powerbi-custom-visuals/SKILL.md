---
name: powerbi-custom-visuals
version: 26.25
description: Power BI custom visual (.pbiviz) development with the pbiviz toolchain and its MCP server. Automatically invoke when the user mentions "custom visual", "pbiviz", "develop a Power BI visual", "powerbi-visuals-tools", "IVisual", "capabilities.json", "visual formatting model", "visual certification", "publish a visual to AppSource", or asks to scaffold, build, debug, package, certify, or publish a .pbiviz developer visual.
---

# Power BI Custom Visuals (pbiviz)

Build distributable Power BI **developer visuals**: TypeScript/D3 visuals packaged
as a `.pbiviz` file, written against the `powerbi-visuals-api` and built with the
`pbiviz` CLI (`powerbi-visuals-tools`). This skill covers the full loop: scaffold,
develop, live-preview, package, certify, and publish.

## Pick the right tool first

This plugin holds five visual approaches. Choose before building:

```yaml
deneb-visuals:    no-code Vega / Vega-Lite specs inside a report; no packaging, no TypeScript
python-visuals:   matplotlib / seaborn script visuals (static image, computes at render)
r-visuals:        ggplot2 script visuals (static image); R's stats ecosystem
svg-visuals:      SVG drawn by a DAX measure (ImageUrl); inline in tables/cards, no visual sandbox
powerbi-custom-visuals (this skill): a real .pbiviz developer visual, reusable across
                  reports and shareable on AppSource; full interactivity, formatting pane, certification
```

Reach for this skill when the need is a reusable, interactive, distributable visual
with its own formatting pane. For a one-off chart in a single report, a sibling
skill is usually faster and lighter.

## Prerequisites

- Node.js 20.19 or later (the `powerbi-visuals-tools` engine minimum)
- `pbiviz` CLI: run via `npx -y powerbi-visuals-tools <command>`, or install it globally
- Developer mode for live preview: enable the developer visual in Power BI Desktop, or
  turn on developer mode in the Power BI service

## Core workflow

1. **Scaffold**: `pbiviz new <VisualName>` creates the project (`src/visual.ts`,
   `capabilities.json`, `pbiviz.json`, `tsconfig.json`, `package.json`, `style/`, `assets/`)
2. **Implement the visual class** in `src/visual.ts`. Implement the `IVisual` interface;
   the class name must equal `visualClassName` in `pbiviz.json`. Core methods:
   `constructor` (set up DOM and services), `update` (render on data/size/settings change),
   `getFormattingModel` (populate the format pane), `destroy` (cleanup)
3. **Declare data and formatting** in `capabilities.json`: `dataRoles` (the field wells),
   `dataViewMappings` (how roles map to the dataView), and `objects` (format-pane properties)
4. **Build the formatting model** with `powerbi-visuals-utils-formattingmodel`
   (`FormattingSettingsService`, cards, slices). A card name matches a `capabilities.json`
   object; a slice name matches a property
5. **Live-preview**: `pbiviz start`, then add the developer visual to a report and iterate
   against real data
6. **Package**: `pbiviz package` produces the `.pbiviz` under `dist/`; import it into a report

Full command flags, the project layout, the `IVisual` lifecycle, and formatting-model
patterns are in `references/pbiviz-toolchain.md`.

## Use the bundled pbiviz MCP server

This plugin ships a `.mcp.json` that starts the `pbiviz` MCP server
(`npx -y powerbi-visuals-tools mcp`). It grounds development in current, correct API
usage instead of guessed code. Prefer its tools while building:

```yaml
get_available_apis:    look up data, formatting, interaction, and utility APIs with examples
get_best_practices:    API-version management, performance, security, accessibility, testing
add_feature:           list features available to add (bookmarks, tooltips, drill-down, selection, localization)
implement_feature:     step-by-step instructions, code templates, and config changes for a feature
list_visual_info:      extract a project's GUID, version, author, data roles, dependencies
check_vulnerabilities: scan dependencies and source for risky patterns (eval, innerHTML)
prepare_certification: verify required files, configuration, capabilities, and assets pre-submission
```

Setup, client config, and per-tool detail are in `references/mcp-server.md`.

## Certify and publish

Certification unlocks export to PowerPoint and email subscriptions, and signals a
reviewed visual. Key gates: a lowercase `certification` branch matching the package,
`eslint-plugin-powerbi-visuals` passing, no `eval`/`fetch`/`XMLHttpRequest`, a clean
`npm audit`, and the latest API. Audit with `pbiviz package --certification-audit`.
Publishing goes through Partner Center to AppSource. R-based visuals cannot be certified.

Requirements and the submission flow are in `references/certification-publishing.md`.

## Learn from shipped visuals

Microsoft publishes the full source of official and certified visuals. Start from the
tutorials (`circlecard`, `sampleBarChart`) and read a production visual close to the
target (`gantt`, `sankey`, `sunburst`, `timeline`, `ChicletSlicer`) for real patterns.
A curated list with what each one teaches is in `references/community-examples.md`.

## Additional resources

### Reference files
- **`references/pbiviz-toolchain.md`** ... CLI commands, project structure, IVisual lifecycle, capabilities.json, formatting model, key npm packages
- **`references/mcp-server.md`** ... the bundled pbiviz MCP: setup and its tools
- **`references/certification-publishing.md`** ... certification requirements and AppSource publishing
- **`references/community-examples.md`** ... official and certified example visuals worth reading

### Examples
- **`examples/vscode-mcp.json`** ... standalone `.vscode/mcp.json` for a visual project outside this plugin
- **`examples/capabilities-objects.json`** ... a `capabilities.json` `objects` block wired to a formatting card
