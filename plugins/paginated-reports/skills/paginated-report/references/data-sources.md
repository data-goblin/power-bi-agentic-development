# Connecting to Data

A paginated report embeds its own data sources and datasets in the `.rdl` (the Power BI service does not support shared `.rds`/`.rsd` files). Each `<DataSource>` declares how to connect; each `<DataSet>` declares a query against one data source plus the fields it returns. This reference covers the connect-string anatomy and query language per source, parameter binding, and the Enter Data connector for testing.

## Power BI semantic model (PBIDATASET, DAX)

The most common source for new paginated reports. Connects live to a published semantic model and queries it with DAX.

```xml
<DataSource Name="PowerBiDataset">
  <ConnectionProperties>
    <DataProvider>PBIDATASET</DataProvider>
    <ConnectString>Data Source=pbiazure://api.powerbi.com/;Identity Provider="https://login.microsoftonline.com/organizations, https://analysis.windows.net/powerbi/api, f0b72488-7082-488a-a7e8-eada97bd842d";Initial Catalog=sobe_wowvirtualserver-29299120-4ce3-4bd2-b1df-c0295031f31f;Integrated Security=ClaimsToken</ConnectString>
  </ConnectionProperties>
  <rd:SecurityType>None</rd:SecurityType>
  <rd:DataSourceID>3e55b9bf-61f0-43eb-ab21-db8881352d00</rd:DataSourceID>
  <rd:PowerBIWorkspaceName>Paginated Reports</rd:PowerBIWorkspaceName>
  <rd:PowerBIDatasetName>FPDS_IBM</rd:PowerBIDatasetName>
</DataSource>
```

Connect-string parts that are non-negotiable:

- `Data Source=pbiazure://api.powerbi.com/` always exactly this.
- `Identity Provider="<authority>, https://analysis.windows.net/powerbi/api, f0b72488-7082-488a-a7e8-eada97bd842d"`. The tenant app-registration GUID `f0b72488-...` is the same in every file. The authority is `https://login.microsoftonline.com/organizations` for org accounts, `.../common` for multi-tenant.
- `Initial Catalog=sobe_wowvirtualserver-<datasetGUID>`. The `sobe_wowvirtualserver-` prefix identifies the model to the XMLA endpoint and has no documented substitute. The GUID is the semantic model's object ID.
- `Integrated Security=ClaimsToken` always exactly this; it tells the endpoint to use the report's OAuth bearer token.

Find the dataset GUID with `fab` (the `fabric-cli` skill): list semantic models in the workspace and read the item id. `rd:PowerBIWorkspaceName`/`rd:PowerBIDatasetName` are display labels Report Builder shows; the `Initial Catalog` GUID is what actually binds.

### DAX field naming

```xml
<DataSet Name="Sales">
  <Query>
    <DataSourceName>PowerBiDataset</DataSourceName>
    <CommandText>EVALUATE SUMMARIZECOLUMNS('Customers'[State], "Sales Revenue", [Sales Revenue])</CommandText>
  </Query>
  <Fields>
    <Field Name="State">
      <rd:TypeName>System.String</rd:TypeName>
      <DataField>Customers[State]</DataField>     <!-- column: Table[Column] -->
    </Field>
    <Field Name="Sales_Revenue">
      <rd:TypeName>System.String</rd:TypeName>     <!-- measures come back as String -->
      <DataField>[Sales Revenue]</DataField>       <!-- measure: [Measure] (no table) -->
    </Field>
  </Fields>
</DataSet>
```

- Column field `DataField` = `TableName[ColumnName]` (table name may contain spaces: `IBM - Search Results[Contract Number]`). Forgetting the table prefix on a column is "field not found" at runtime.
- Measure field `DataField` = `[MeasureName]`, no table prefix. An aliased measure column (`"Sales", [Sales Amount]`) is returned named `[Sales]`, so its `DataField` is `[Sales]`.
- `rd:TypeName` differs by field kind, and getting it wrong breaks formatting and parameter matching. Columns return their native model type: integer to `System.Int64`, decimal to `System.Decimal`, date to `System.DateTime`, text to `System.String`. Measures always return `System.String` (PBIDATASET hands back the pre-formatted value). So apply numeric `<Format>` and arithmetic directly to numeric columns, but cast a measure with `=CDbl(Fields!X.Value)` before doing math on it. Confirm types with `te`/`dax` tooling when unsure.
- Author and validate the DAX with the `semantic-models:dax` skill (or `reports:pbir-cli`'s `model -q`) against the live model first, confirming the exact column/measure names, then paste the `EVALUATE` into `<CommandText>` (XML-escaped). Do not hand-roll DAX for a paginated report; generate it where it can be run and checked.

### DAX query parameters

A report parameter binds to a `<QueryParameter>` whose `<Value>` is `=Parameters!X.Value`; the query then references it. The `@`-prefix convention differs by provider, and mismatching it is a common bind failure:

- **DAX / PBIDATASET**: the `<QueryParameter Name>` has no `@` (e.g. `Name="Category"`); the DAX references it as `@Category`.
- **SQL / Azure SQL**: the `<QueryParameter Name>` includes the `@` (e.g. `Name="@Category"`); the T-SQL also uses `@Category`.

Author and verify the DAX itself with the `semantic-models:dax` skill (or `reports:pbir-cli`'s `model -q`) before pasting the `EVALUATE` into `<CommandText>` (XML-escaped) so the query is known-good against the model.

**Robust default: single-value parameter via `TREATAS`.** This is plain, valid DAX that renders reliably and is what the `dax` skill produces. The `semantic-model-starter.rdl` asset wires exactly this end to end (and it is render-proven against a live model):

```xml
<QueryParameters>
  <QueryParameter Name="Category"><Value>=Parameters!Category.Value</Value></QueryParameter>
</QueryParameters>
<CommandText>EVALUATE
SUMMARIZECOLUMNS (
  'Product'[Category],
  TREATAS ( { @Category }, 'Product'[Category] ),
  "Sales", [Sales Amount]
)
ORDER BY [Sales] DESC</CommandText>
```

The report engine substitutes `@Category` with the selected value, so `{ @Category }` becomes a one-row table constructor that `TREATAS` applies as a filter.

**Multi-select is the fragile part: `RSCustomDaxFilter`.** Multi-value parameters do not expand cleanly in plain DAX, so Report Builder uses a special token, `RSCustomDaxFilter(@param, EqualToCondition, [Table].[Column], DataType)`, marked with `<rd:UserDefined>true</rd:UserDefined>`. It is not standard DAX; the report processor rewrites it before sending the query. It is sensitive to formatting and to spaces in column names: a hand-authored `RSCustomDaxFilter` over a column like `[Customers].[Account Type]` was observed to fail rendering with "Failed to resolve name ." Treat it as a Report-Builder-generated construct: prefer generating it in Report Builder (or copy a verified example, see `references/example-reports.md`), keep the exact spacing, and validate by actually rendering. When multi-select is not essential, prefer the single-value `TREATAS` pattern above.

## SQL Server and Azure SQL (SQL / SQLAZURE)

```xml
<!-- Azure SQL with stored credentials -->
<DataSource Name="SqlDatabase">
  <ConnectionProperties>
    <DataProvider>SQLAZURE</DataProvider>
    <ConnectString>Data Source=server.database.windows.net;Initial Catalog=SalesDB;Encrypt=True;TrustServerCertificate=False;Authentication="Sql Password"</ConnectString>
    <Prompt>Specify a user name and password for data source SqlDatabase:</Prompt>
  </ConnectionProperties>
  <rd:SecurityType>DataBase</rd:SecurityType>
  <rd:DataSourceID>6df07dcb-6238-496d-bfc8-d9fe88df9029</rd:DataSourceID>
</DataSource>

<!-- On-prem SQL Server with integrated security -->
<DataSource Name="MSDB">
  <ConnectionProperties>
    <DataProvider>SQL</DataProvider>
    <ConnectString>Data Source=REPORTS;Initial Catalog=MSDB</ConnectString>
    <IntegratedSecurity>true</IntegratedSecurity>
  </ConnectionProperties>
  <rd:SecurityType>Integrated</rd:SecurityType>
  <rd:DataSourceID>4610eb81-a43a-4aa2-b78c-cb5df771f6c8</rd:DataSourceID>
</DataSource>
```

Datasets use inline T-SQL (`<CommandType>` omitted or `Text`) or a stored proc (`<CommandType>StoredProcedure</CommandType>`, `<CommandText>` = proc name). `@param` query parameters bind to `=Parameters!X.Value`. Field `rd:TypeName` reflects the SQL type: `System.String`, `System.Decimal`, `System.Int32`, `System.DateTime`, etc., and numeric fields support numeric `<Format>` directly.

On-prem SQL Server in the service needs an Enterprise data gateway; bind it after publish with `fab` (see the `fabric-cli` paginated-reports reference). Azure SQL is reachable directly but its authentication type must be set in workspace settings after the first upload.

## Analysis Services (OLEDB-MD, MDX)

`<DataProvider>OLEDB-MD</DataProvider>` connects to SSAS / Azure AS and queries with MDX. The MDX query designer writes `<DataField>` values as escaped XML fragments identifying each field as a `Level` or `Measure` by unique name. Hand-authoring these is error-prone; generate them in Report Builder or query the cube with the DAX/SQL tooling and prefer a tabular DAX path where possible. Azure AS cannot be reached through a gateway for paginated reports.

## Other sources

| Source | Path |
|---|---|
| Direct Lake / SQL endpoint | SSO + OAuth2; treat like a semantic model or Azure SQL |
| Dataverse | SSO/OAuth2; cannot use a gateway |
| Oracle, Teradata, ODBC | Enterprise gateway only |
| Snowflake, Databricks, Redshift, and 100s more | via Power Query Online ("Get Data" in Report Builder), which runs as a compute layer |

DirectQuery against a semantic model has a fixed 10-minute query timeout; for longer queries use the XMLA endpoint as the source type instead. Data source rules (connection overrides at publish) are not supported for Direct Lake models.

## Enter Data (ENTERDATA): inline data for testing

The Enter Data connector embeds a fixed, typed dataset directly in the `.rdl`. No connection, no gateway, no live source. Use it to iterate on layout and pagination before wiring the real source, and for small static lookup lists. Under the hood it is the XML data provider with an inline `<XmlData>` block.

```xml
<DataSource Name="EnterDataDS">
  <ConnectionProperties>
    <DataProvider>ENTERDATA</DataProvider>
    <ConnectString/>
  </ConnectionProperties>
  <rd:SecurityType>None</rd:SecurityType>
  <rd:DataSourceID>00000000-0000-0000-0000-0000000000ed</rd:DataSourceID>
</DataSource>

<DataSet Name="SalesData">
  <Query>
    <DataSourceName>EnterDataDS</DataSourceName>
    <CommandText>&lt;Query&gt;&lt;XmlData&gt;&lt;Rows&gt;
      &lt;Row&gt;&lt;Country&gt;USA&lt;/Country&gt;&lt;Year&gt;2024&lt;/Year&gt;&lt;Sales&gt;125000&lt;/Sales&gt;&lt;/Row&gt;
      &lt;Row&gt;&lt;Country&gt;UK&lt;/Country&gt;&lt;Year&gt;2024&lt;/Year&gt;&lt;Sales&gt;87000&lt;/Sales&gt;&lt;/Row&gt;
    &lt;/Rows&gt;&lt;/XmlData&gt;&lt;/Query&gt;</CommandText>
  </Query>
  <Fields>
    <Field Name="Country"><DataField>Country</DataField><rd:TypeName>System.String</rd:TypeName></Field>
    <Field Name="Year"><DataField>Year</DataField><rd:TypeName>System.String</rd:TypeName></Field>
    <Field Name="Sales"><DataField>Sales</DataField><rd:TypeName>System.String</rd:TypeName></Field>
  </Fields>
</DataSet>
```

Notes:

- The inner `<Query><XmlData><Rows><Row>` document is XML-escaped inside `<CommandText>` (`<` becomes `&lt;`). Each child of `<Row>` maps to a field by name.
- Enter Data types every field as `System.String`. Cast in expressions for math or formatting: `=Sum(CDbl(Fields!Sales.Value))`.
- The `enter-data-starter.rdl` asset is a ready-to-edit report wired this way; copy it to start a layout draft with zero infrastructure.
- Works in the Power BI service with no config. On PBIRS the `ENTERDATA` extension must be registered in `RsReportServer.config` (it is not present by default); see `references/dev-loop.md`.

## Picking a source

- Building a paginated companion to an existing Power BI report or a model that already holds the business logic, RLS, and measures: use the semantic model (PBIDATASET). Reuse the model's measures rather than re-implementing aggregation in SQL.
- Operational/transactional detail at high row counts (invoices, statements, exports) where a star schema would be overkill: query Azure SQL / SQL Server directly and push all filtering and aggregation into the query.
- Pure layout iteration, demos, or a self-contained sample: Enter Data.

Whatever the source, push filtering and aggregation into the query. Paginated reports fetch the full dataset and apply RDL-level dataset/tablix filters in memory after the fetch, so RDL filters do not reduce the data pulled. See `references/renderers.md`.
