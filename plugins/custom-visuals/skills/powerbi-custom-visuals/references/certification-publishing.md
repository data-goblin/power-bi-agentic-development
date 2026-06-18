# Certification and publishing

Publishing a custom visual to AppSource is optional; certification is a further,
optional step. Certified visuals gain export to PowerPoint and rendering in report
subscription emails, and signal that Microsoft reviewed the code for safety.

## Certification requirements

```yaml
source_repo:
  - one visual per repository, no unrelated code
  - a lowercase `certification` branch whose source matches the submitted package
  - reviewers need read access (private repos: grant access to the Power BI team)
files:
  - .gitignore excludes node_modules, .tmp, dist
  - capabilities.json (avoid breaking property changes for existing users)
  - pbiviz.json, package.json, package-lock.json, tsconfig.json
dependencies:
  - typescript, eslint, eslint-plugin-powerbi-visuals installed
  - package.json exposes: "eslint": "npx eslint . --ext .js,.jsx,.ts,.tsx"
commands_must_pass:
  - npm install
  - pbiviz package
  - npm audit  (no high or moderate warnings, per current AppSource policy)
  - eslint with the eslint-plugin-powerbi-visuals config (no errors)
code:
  - no eval, no fetch, no XMLHttpRequest; no access to external services or resources
  - written against the latest powerbi-visuals-api
  - not an R-based visual (R visuals cannot be certified)
```

Audit unsafe calls before submitting:

```bash
pbiviz package --certification-audit
pbiviz package --certification-fix   # only for forbidden calls inside third-party libraries
```

`--certification-fix` strips forbidden calls from libraries outside your control;
offending code in your own source must be removed by hand. Retest after either flag,
and keep the `npm run package` script in sync so the package hash matches at review.

## Publishing to AppSource

1. Complete `pbiviz.json`: `description`, `supportUrl`, `author`, `name`, `email`
2. `pbiviz package` to build the `.pbiviz`, and prepare a sample `.pbix`
3. Submit both to Partner Center as a Power BI visual offer
4. To request certification, select the certification option and provide the
   certification notes and the `certification` branch
5. Track status and review the marketplace validation and certification policies

Submit and publish first, then request certification; the certification review can
take time and runs against the published package.
