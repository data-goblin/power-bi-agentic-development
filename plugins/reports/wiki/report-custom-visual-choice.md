---
title: "Choosing a custom visual: in-report code, AppSource or none"
summary: Ranking of core, Deneb, SVG measure and packaged visuals, with the R and Python retirement and the licensing gaps of AppSource visuals.
kind: decision
status: current
sources:
  - url: https://learn.microsoft.com/en-us/power-bi/developer/visuals/power-bi-custom-visuals
  - url: https://learn.microsoft.com/en-us/power-bi/connect-data/service-python-packages-support
  - url: https://learn.microsoft.com/en-us/power-bi/connect-data/service-r-packages-support
tools:
  pbir: 0.9.33
last_updated: 2026-11-23
last_verified: 2026-11-23
review_cadence_days: 60
verified_by:
  - pbir visuals deneb --help
skills: [reports/pbi-report-design]
---

# Choosing a custom visual

Learn: [custom visuals](https://learn.microsoft.com/en-us/power-bi/developer/visuals/power-bi-custom-visuals), [Python packages](https://learn.microsoft.com/en-us/power-bi/connect-data/service-python-packages-support), [R packages](https://learn.microsoft.com/en-us/power-bi/connect-data/service-r-packages-support).

## Ranking

```yaml
1: core Power BI visual (no dependency, fastest)
2: Deneb (Vega, Vega-Lite): advanced interactive charts, version-controlled and diffable
3: SVG measure: inline graphics in tables, matrices and cards
4: packaged AppSource visual: only when the interaction model genuinely needs it
5: private .pbiviz: avoid; you own the build pipeline
retired: R and Python script visuals
```

## R and Python visuals retire in May 2027

Learn states that R and Python visuals, including R-powered custom visuals, retire in May 2027 and stop working in published reports (checked on the two package-support pages, updated 2026-11-09). Do not start new ones and do not recommend them. Replace existing ones with a native visual, Deneb or an SVG measure. They also never rendered in publish-to-web or app-owns-data embedding.

## AppSource and org-store trade-offs

An AppSource visual is a dependency on a third party's code and on three tenant settings (allow custom visuals, allow specific visual, allow uncertified). It can vanish, lose certification or be blocked by policy.

- Prefer the org store to ad-hoc AppSource (one approved version, one admin toggle) and certified to uncertified visuals
- Record the dependency in a PBIR annotation: name, source, certification, approver (`pbir add annotation`)
- Licensed visuals do not enforce or report licensing in Report Server, app-owns-data embedding or publish-to-web, and org-store and AppSource visuals are unavailable in Report Server; those distribution paths make an AppSource dependency a portability blocker (Unverified against Learn; check the visual's own docs)
