# Custom Visual Selection: Build vs Buy

## Default Ranking

Prefer in-repo code paths over packaged third-party visuals. In-repo code (Deneb, SVG-via-DAX, Python/R) lives inside the report or model, travels with it, renders anywhere the engine is enabled, and requires no per-visual admin approval.

```
1. Core Power BI visual       -- no dependencies, fastest
2. Deneb (Vega/Vega-Lite)     -- declarative; preferred for advanced interactive charts
3. SVG-via-DAX measure        -- preferred for table/card inline graphics; no row cap issues
4. Python/R script visual     -- statistical plots that must compute at render time
5. Packaged AppSource visual  -- only when the interaction model genuinely needs it
6. Private .pbiviz            -- avoid; external risk plus you own the build pipeline
```

Reach for a packaged custom visual only when the interaction model genuinely requires it: a rich pre-built hierarchy/network slicer, a specialized gauge type, or a visual category with no reasonable in-repo alternative.

## AppSource and Org-Store Tradeoffs

An AppSource visual is an external dependency on a third party's code, AppSource availability, and three tenant settings (allow custom visuals, allow specific visual, allow uncertified). It can vanish, lose certification, or be policy-blocked at any time.

When a packaged custom visual is warranted:
- Prefer the org store over ad-hoc AppSource (centralizes the approved version, single admin toggle)
- Prefer certified visuals (Microsoft-reviewed, sandboxed)
- Record the dependency in a PBIR annotation: name, source, certification status, approver

## Licensing and Deployment Gaps

Licensed AppSource visuals do not enforce or report licensing in:
- Power BI Report Server (sovereign clouds, on-premises)
- App-owns-data embed
- Publish-to-web

Org-store/AppSource visuals are unavailable in Report Server entirely. If the report will be distributed via any of these paths, an AppSource dependency is a portability blocker.

## The Real Cost of a Custom Visual Dependency

Reaching for a custom visual to avoid learning Deneb or SVG trades a one-time authoring cost for a permanent governance and portability cost. A Deneb spec is version-controlled, diffable, and testable; an AppSource registration is not.
