---
title: pbiviz 6.x and 7.x build gotchas
summary: Changes in powerbi-visuals-tools 6.0 to 7.2 that break builds or certification, with the release that introduced each.
kind: gotcha
status: current
sources:
  - url: https://github.com/microsoft/PowerBI-visuals-tools/blob/main/Changelog.md
  - url: https://learn.microsoft.com/en-us/power-bi/developer/visuals/power-bi-custom-visuals-certified
last_updated: 2026-11-23
last_verified: 2026-11-23
review_cadence_days: 90
verified_by:
  - gh api repos/microsoft/PowerBI-visuals-tools/contents/Changelog.md
skills: [custom-visuals/powerbi-custom-visuals]
---

# pbiviz 6.x and 7.x build gotchas

Source of truth is the [tools changelog](https://github.com/microsoft/PowerBI-visuals-tools/blob/main/Changelog.md). The npm registry lists 7.2.1 as latest and `engines.node >= 20.19.0` (checked 2026-11-23); the changelog already lists 7.2.2 (audit fixes only).

```yaml
7.2.0: the build fails when a visual version part has a leading zero (1.01.0.0); the marketplace rejects such packages
7.1.x: package updates and npm audit fixes only
7.0.4: a missing Rendering Events call is an ERROR under --certification-audit and --certification-fix; templates now call it
7.0.3: pbiviz.json needs author as an object with name and email
7.0.2: source maps are eval-source-map (6.2.0 had used inline-source-map because Power BI no longer loads .map files)
7.0.0: BREAKING, Node.js polyfills removed from webpack (assert, buffer, crypto, stream, util, path, url, os, events and the rest); code that imports them stops building
6.1.0: --certification-audit and --certification-fix added to pbiviz package
6.0.0: pbiviz.js dynamic configuration supported
5.6.0: ESLint 9 and TypeScript 5; --use-default is deprecated, the recommended lint config is the default
```

## Fixing a failed 7.x build

- `Module not found: crypto` or `buffer` or `stream`: replace with the browser API (`crypto.subtle`, `TextEncoder`, `Uint8Array`) or remove the library that pulls it in. Hand-written webpack polyfills defeat the reason for the change and are a certification risk
- Version rejected: write `1.1.0.0`, not `1.01.0.0`
- Audit error about rendering events: call `this.events.renderingStarted(options)` and `renderingFinished(options)` in `update` (see the [Rendering Events API](https://learn.microsoft.com/en-us/power-bi/developer/visuals/event-service))
- Source map load error: upgrade to 7.0.2 or later (the changelog lists the fix)
