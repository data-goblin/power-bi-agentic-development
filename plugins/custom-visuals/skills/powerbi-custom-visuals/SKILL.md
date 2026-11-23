---
name: powerbi-custom-visuals
description: Builds, lints, packages and certifies Power BI custom visuals (.pbiviz) with the pbiviz toolchain and its bundled MCP server. Use for "custom visual", "pbiviz", "powerbi-visuals-tools", "capabilities.json", "IVisual", "certify a visual", "publish to AppSource", and for rebuilding a retiring R or Python script visual as a custom visual. Not for Deneb, SVG measures or script visuals inside a report; those have their own skills.
---

# Power BI custom visuals (pbiviz)

## Rules

- Node 20.19 or later is the floor of `powerbi-visuals-tools` 7.x. Run it as `npx -y powerbi-visuals-tools <command>` or install it globally
- Run the toolchain instead of reciting rules: `pbiviz lint`, `pbiviz package --certification-audit`, and the MCP tools `check_vulnerabilities` and `prepare_certification`. Fix what they print
- Use the bundled MCP server (`.mcp.json` starts `npx -y powerbi-visuals-tools mcp`) for API lookups: `get_available_apis`, `get_best_practices`, `list_visual_info`. Its tool descriptions load with the client
- Visual version is four numeric parts without leading zeros (`1.1.0.0`, not `1.01.0.0`); 7.2.0 fails the build otherwise. `pbiviz.json` needs `author` with `name` and `email`
- 7.0.0 removed the Node polyfills from webpack: `import crypto from 'crypto'`, `buffer`, `stream` and similar fail. Use the browser API or drop the dependency; do not add polyfill config. More in [pbiviz 7 gotchas](../../wiki/pbiviz-7-gotchas.md)
- A visual that will be certified: no `fetch`, `XMLHttpRequest`, `eval`, `innerHTML`, `D3.html(user data)`, minified JavaScript, empty or omitted `WebAccess` privileges, no console errors for any input, and the Rendering Events API implemented (`pbiviz package --certification-audit` reports a missing one as an error since 7.0.4)
- Certification also needs a lowercase `certification` branch matching the submitted package, `npm audit` clean at high and moderate, the `eslint` script `npx eslint . --ext .js,.jsx,.ts,.tsx` in `package.json`, and a repo with one visual only. R-based visuals cannot be certified. Full list on Learn: [certified visuals](https://learn.microsoft.com/en-us/power-bi/developer/visuals/power-bi-custom-visuals-certified)
- Run `pbiviz package --certification-fix` only for forbidden calls inside third-party libraries, never for your own code, then update the `npm run package` script so the package hash matches at review
- Developer visual: in Power BI Desktop the "Develop a visual" setting lasts one session; in the service developer mode persists (see [environment setup](https://learn.microsoft.com/en-us/power-bi/developer/visuals/environment-setup))

## Choose first

```yaml
deneb-visuals:   one report, declarative Vega spec, no packaging
svg-visuals:     small graphic inside a table or card cell, drawn by a DAX measure
python-visuals / r-visuals:  retiring May 2027; maintain or migrate only
this skill:      reusable, interactive, shareable visual with its own formatting pane, or a replacement for a retiring script visual
```

## Replacing an R or Python visual

Learn names a new SDK visual as one of the three replacements (the others are a built-in visual or a Fabric notebook). Steps:

1. Save the script and its package list
2. `pbiviz new <Name>`, map each `dataset` column to a data role in `capabilities.json`, draw in `update()`
3. Keep it offline and non-minified so it can later be certified; no R-powered visual
4. Replace the visual in the report, then `pbiviz package` and import the `.pbiviz`

Retirement facts and the detection search are in the [script visual retirement page](../../wiki/script-visuals-retirement.md).

## Scaffold and package

- `pbiviz new <Name>` (`-t default|table|slicer|rvisual|rhtml|circlecard`), `pbiviz start`, `pbiviz package`, `pbiviz lint [--fix]`, `pbiviz info`, `pbiviz install-cert`, `pbiviz mcp --init` (writes `.vscode/mcp.json`)
- `pbiviz.json` can be `pbiviz.js` or `.mjs` since 6.0.0 for generated config; `-f` points at it
- Templates pin `powerbi-visuals-api` 5.11.1; the registry has 5.11.2 (checked 2026-11-23)
- Real source to read before writing from scratch: `microsoft/PowerBI-visuals-sampleBarChart` (certification repo layout) and `microsoft/PowerBI-visuals-circlecard` (tutorial)
