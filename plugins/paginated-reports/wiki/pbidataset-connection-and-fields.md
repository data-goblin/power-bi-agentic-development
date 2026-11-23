---
title: PBIDATASET connection string, DAX fields and parameters
summary: Connect string parts, DAX DataField naming, measure types and the parameter binding rules for a paginated report on a semantic model.
kind: reference
status: current
sources:
  - url: https://learn.microsoft.com/en-us/power-bi/paginated-reports/paginated-reports-data-sources
  - url: https://github.com/PowerBiDevCamp/App-Owns-Data-Starter-Kit
last_updated: 2026-11-23
last_verified: 2026-11-23
review_cadence_days: 90
verified_by:
  - python3 plugins/paginated-reports/skills/paginated-report/scripts/validate_rdl.py plugins/paginated-reports/skills/paginated-report/assets/semantic-model-starter.rdl
skills: [paginated-reports/paginated-report]
---

# PBIDATASET connection string, DAX fields and parameters

Learn lists [supported data sources](https://learn.microsoft.com/en-us/power-bi/paginated-reports/paginated-reports-data-sources) but not the file-level anatomy. The working example is `skills/paginated-report/assets/semantic-model-starter.rdl` (render-proven against a live model in the repository's earlier notes; not re-rendered here).

## Connect string

```xml
<DataProvider>PBIDATASET</DataProvider>
<ConnectString>Data Source=pbiazure://api.powerbi.com/;Identity Provider="https://login.microsoftonline.com/organizations, https://analysis.windows.net/powerbi/api, f0b72488-7082-488a-a7e8-eada97bd842d";Initial Catalog=sobe_wowvirtualserver-REPLACE_WITH_DATASET_GUID;Integrated Security=ClaimsToken</ConnectString>
```

```yaml
Data Source: pbiazure://api.powerbi.com/ exactly
Identity Provider: authority, then https://analysis.windows.net/powerbi/api, then f0b72488-7082-488a-a7e8-eada97bd842d (the same value in every file seen; Unverified as an app id)
authority: https://login.microsoftonline.com/organizations for organization accounts, /common for multi-tenant
Initial Catalog: sobe_wowvirtualserver-<semantic model item id>; no documented substitute for the prefix
Integrated Security: ClaimsToken; the report runs as the signed-in user, no credential setup
rd:SecurityType: None
```

`rd:PowerBIWorkspaceName` and `rd:PowerBIDatasetName` are display labels; the GUID binds. Get the item id with `fab` (see the fabric-cli skill).

## DAX field naming and types

```yaml
column: DataField is Table[Column] (table prefix required, spaces allowed); a missing prefix is "field not found" at render time
measure: DataField is [Measure] with no table; an aliased measure column ("Sales", [Sales Amount]) comes back as [Sales]
column_type: native model type (System.Int64, System.Decimal, System.DateTime, System.String)
measure_type: always System.String; cast with =CDbl(Fields!X.Value) before arithmetic
enterdata_type: every field System.String; cast for math
```

## Query parameters

A `ReportParameter` binds to a `QueryParameter` whose `Value` is `=Parameters!X.Value`; the query references it with `@`.

```yaml
PBIDATASET: QueryParameter Name has no @ (Name="Category"); the DAX says @Category
SQL and SQLAZURE: QueryParameter Name includes the @ (Name="@Category"); the T-SQL says @Category
single_value: TREATAS ( { @Category }, 'Product'[Category] ) inside SUMMARIZECOLUMNS; the engine substitutes the value
multi_value: needs RSCustomDaxFilter(@param, EqualToCondition, [Table].[Column], DataType) with rd:UserDefined true; a hand-written one over a column with a space failed to render with "Failed to resolve name ." once. Generate it in Report Builder or copy a verified example, and render to confirm
```

`validate_rdl.py` warns when a QueryParameter is never referenced as `@name` in the query text and when the `@` convention above is broken.

## Timeouts

DirectQuery against a semantic model has a fixed 10 minute query timeout in this repository's earlier notes (Unverified). Learn's FAQ says an embedded dataset's `Timeout` defaults to 600 seconds and can be raised to 2147483646 in Dataset Properties.
