# Power BI Paginated Reports vs SSRS

A Power BI paginated report and an SQL Server Reporting Services (SSRS) report are the **same RDL file format**, authored in the **same tool** (Report Builder). The difference is where they run and what that environment supports. This skill targets Power BI paginated reports (the Power BI service / Microsoft Fabric); the points below are the practical deltas from classic SSRS.

## Same

- The `.rdl` XML format (use the 2016 schema for both today) and Report Builder as the authoring tool. An `.rdl` opens in either.
- Tablix, charts, parameters, expressions, page setup all work the same way.

## Different in the Power BI service

- **Hosting and licensing.** Power BI paginated reports run in the Power BI service / Fabric and require a workspace on Premium, Embedded, or Fabric capacity (or PPU). SSRS runs on a Windows report server you install and manage; PBIRS (Power BI Report Server) is the on-premises server that hosts both `.rdl` and `.pbix`.
- **Data sources are embedded only.** The service does not support shared data sources or shared datasets (`.rds` / `.rsd`); everything must be embedded in the `.rdl`. SSRS supports shared ones.
- **Semantic model source.** The service adds the `PBIDATASET` provider to query a Power BI semantic model with DAX over SSO (`Integrated Security=ClaimsToken`). SSRS has no equivalent.
- **No dataset caches, snapshots, or report history** in the service; parameter queries run on every open. SSRS caches and snapshots these.
- **Subscriptions.** Standard subscriptions exist in both; data-driven subscriptions are SSRS-only.
- **Two execution environments.** The service silently runs a report on a standard or optimized path depending on its expressions (see `references/renderers.md`); SSRS has no such split.
- **Automation surface.** The service exposes a REST export-to-file API (`ExportTo`) and Fabric Git integration for paginated reports; SSRS uses URL access and the SOAP/REST report server endpoints, and its own source control.
- **Deployment.** Publish to the service via upload / the Imports API / Report Builder's Publish; SSRS deploys to a report server via Report Builder or SSDT.
- **A few features do not apply in the service**, e.g. document maps do not render in-browser (they do on export), and pinning report pages to dashboards is not supported.

## Practical implication for an agent

Author against the 2016 RDL schema, embed every data source, prefer a semantic model or cloud SQL source, and target a capacity-backed workspace. If a sample `.rdl` found online uses a shared data source or an older schema (common in SSRS-era samples), convert it to embedded data sources and the 2016 schema before publishing to the service.
