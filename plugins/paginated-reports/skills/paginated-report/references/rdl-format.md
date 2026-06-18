# RDL Format Reference

Report Definition Language (RDL) is the XML format of a paginated report (`.rdl`). It is plain, hand-editable, diff-friendly XML; there is no binary container. One `.rdl` file holds everything: data sources, datasets, parameters, page setup, layout, and expressions. Power BI Report Builder is just a GUI over this same XML.

This reference is grounded in real `.rdl` files from `microsoft/Reporting-Services`, `PowerBiDevCamp`, `guyinacube/demo-files`, and others. Treat the element ordering and snippets here as the de-facto contract that Report Builder writes and the engine expects.

## The cardinal rule: order is load-bearing in practice

Element order is load-bearing in practice. Report Builder and the report processor's deserializer expect the conventional order Report Builder writes, and load out-of-order children as an "invalid report definition" with no useful line number. The failure comes from the processor's reader, not from schema validation, so do not rely on an XSD validator to catch a reorder. Preserve the order shown below when hand-editing. This is the single most common cause of a broken hand-authored `.rdl`. Run `scripts/validate_rdl.py` after every edit to catch ordering, name-collision, and tablix-count breakage before publishing.

## Root element and namespaces

```xml
<?xml version="1.0" encoding="utf-8"?>
<Report MustUnderstand="df"
  xmlns="http://schemas.microsoft.com/sqlserver/reporting/2016/01/reportdefinition"
  xmlns:rd="http://schemas.microsoft.com/SQLServer/reporting/reportdesigner"
  xmlns:cl="http://schemas.microsoft.com/sqlserver/reporting/2010/01/componentdefinition"
  xmlns:df="http://schemas.microsoft.com/sqlserver/reporting/2016/01/reportdefinition/defaultfontfamily">
```

- Default namespace `.../2016/01/reportdefinition` is the current schema; always use it for new files. The `2010` and `2005` namespaces still render but lack `<ReportSections>` (they put `<Body>`/`<Page>` directly under `<Report>`). Do not author against them.
- `rd:` (designer metadata), `df:` (default font family), `cl:` (component/report-part metadata), `am:` (authoring tool + timestamp). Only declare the prefixes a file actually uses; `cl:` and `am:` are often absent.
- `MustUnderstand="df"` is required whenever `<df:DefaultFontFamily>` is present. Drop one without the other and some renderers ignore the font.
- Microsoft tools write a UTF-8 BOM (`\xEF\xBB\xBF`). Harmless; match it when generating files programmatically.

Optional `am:` namespace (Power BI Report Builder 15.x / SSDT 17.x): add `xmlns:am="http://schemas.microsoft.com/sqlserver/reporting/authoringmetadata"`.

## Top-level child order of `<Report>`

```
rd:ReportUnitType        Inch | Mm  (rd: position varies; see note below)
rd:ReportID              fresh GUID, unique per file
am:AuthoringMetadata     optional
df:DefaultFontFamily     e.g. Segoe UI  (requires MustUnderstand="df")
Description              optional
Author                   optional
AutoRefresh              integer seconds; 0 = off
DataSources
DataSets
ReportSections           the visual content (2016 schema)
ReportParameters         optional; AFTER ReportSections, not before
ReportParametersLayout   optional
--- trailing optional metadata (after ReportParametersLayout, mutual order not load-bearing) ---
Variables                report-scope variables
Code                     embedded VB function library (Code/CodeModules/Classes)
EmbeddedImages           base64 image blobs
CustomProperties         name/value metadata
ConsumeContainerWhitespace
```

The load-bearing part is the structural sequence: `DataSources` then `DataSets` then `ReportSections` then `ReportParameters` then `ReportParametersLayout`. The leading metadata (`rd:ReportUnitType`, `rd:ReportID`, `am:AuthoringMetadata`, `df:DefaultFontFamily`, etc.) and the trailing optional metadata do not have a strict position relative to the structural block or to each other: Report Builder writes the `rd:` elements first in some files and last (after `EmbeddedImages`) in others, and writes `CustomProperties` before `EmbeddedImages`. Match what a real report does and do not reorder metadata you find. The validator enforces only the structural sequence and ignores metadata position (verified against Microsoft's own paginated report samples plus community ones that order it differently).

## Data sources

Replace `<ConnectionProperties>` with `<DataSourceReference>NameOfSharedDS</DataSourceReference>` to use a shared data source (not supported in the Power BI service; embed instead). `<DataSource Name>` must be a valid XML NCName (no spaces).

DataProvider values seen in real files:

```
SQL         SQL Server (on-prem). IntegratedSecurity=true or <Prompt> for stored creds
SQLAZURE    Azure SQL Database / Managed Instance
PBIDATASET  Power BI semantic model (Service / Premium / Fabric)
OLEDB-MD    Analysis Services (SSAS / Azure AS) via MDX
ENTERDATA   Embedded inline XML data (no real source)
```

`rd:SecurityType`: `Integrated` (service account), `DataBase` (stored user/pass), `None` (token auth / PBIDATASET).

See `references/data-sources.md` for the full connect-string anatomy of each provider (especially the non-negotiable `sobe_wowvirtualserver-<guid>` and `Integrated Security=ClaimsToken` rules for PBIDATASET) and the Enter Data inline-data block.

## Datasets

```xml
<DataSet Name="CustomerSales">
  <Query>
    <DataSourceName>SqlDatabase</DataSourceName>
    <QueryParameters>                <!-- before CommandType/CommandText -->
      <QueryParameter Name="@Year">
        <Value>=Parameters!Year.Value</Value>
      </QueryParameter>
    </QueryParameters>
    <CommandType>Text</CommandType>  <!-- omit for inline SQL/DAX; StoredProcedure switches to proc name -->
    <CommandText>SELECT ... WHERE Year = @Year</CommandText>
  </Query>
  <Fields>
    <Field Name="State">           <!-- Name = identifier used in =Fields!State.Value -->
      <DataField>State</DataField> <!-- DataField = column returned by the query -->
      <rd:TypeName>System.String</rd:TypeName>
    </Field>
  </Fields>
</DataSet>
```

- `Name` (the field identifier in expressions) cannot contain spaces; `DataField` (the returned column) can. A column `Sales Revenue` becomes `Name="Sales_Revenue"`, `DataField="Sales Revenue"`.
- `@param` in `CommandText` binds to a `<QueryParameter Name="@param">` whose `<Value>` is a `=Parameters!X.Value` expression. The query-param name and report-param name need not match.
- XML-escape SQL/DAX inside `<CommandText>`: `&` becomes `&amp;`, `<` becomes `&lt;`, `>` becomes `&gt;`. DAX `&&` becomes `&amp;&amp;`, `<=` becomes `&lt;=`.
- `<rd:DesignerState>` blobs inside `<Query>` are designer-only; safe to omit in hand-authored files.

Per-source query language and field naming (DAX `Table[Col]` vs `[Measure]`, MDX, `RSCustomDaxFilter`) live in `references/data-sources.md`.

## ReportSections, page, header, footer

```xml
<ReportSections>
  <ReportSection>
    <Body>
      <ReportItems><!-- Tablix, Chart, Textbox, Image --></ReportItems>
      <Height>3.5in</Height>     <!-- design-time minimum; body grows to fit content -->
      <Style><Border><Style>None</Style></Border></Style>
    </Body>
    <Width>10.5in</Width>        <!-- body width; see the PDF width trap below -->
    <Page>
      <PageHeader>...</PageHeader>
      <PageFooter>...</PageFooter>
      <PageHeight>11in</PageHeight>
      <PageWidth>8.5in</PageWidth>
      <InteractiveHeight>11in</InteractiveHeight>
      <InteractiveWidth>8.5in</InteractiveWidth>
      <LeftMargin>0.5in</LeftMargin>
      <RightMargin>0.5in</RightMargin>
      <TopMargin>0.5in</TopMargin>
      <BottomMargin>0.5in</BottomMargin>
      <Style />
    </Page>
  </ReportSection>
</ReportSections>
```

Child order inside `<ReportSection>`: `Body`, `Width`, `Page`. Inside `<Page>`: `PageHeader`, `PageFooter`, `PageHeight`, `PageWidth`, `InteractiveHeight`, `InteractiveWidth`, margins, `Style`. All dimensions need a unit suffix (`in`, `cm`, `pt`); a bare number is a parse error. Letter = `8.5in` x `11in`; A4 = `21cm` x `29.7cm`.

`<PageHeader>`/`<PageFooter>` have `<Height>`, `<PrintOnFirstPage>`, `<PrintOnLastPage>`, then `<ReportItems>`, then `<Style>`. Only headers/footers may use `=Globals!PageNumber`, `=Globals!TotalPages`, and `=Globals!ExecutionTime`.

## Tablix (table / matrix / list)

All three are the same `<Tablix>` element; the hierarchies differentiate them. A minimal flat table:

```xml
<Tablix Name="Detail">
  <TablixBody>
    <TablixColumns>
      <TablixColumn><Width>1.4in</Width></TablixColumn>
      <TablixColumn><Width>1.4in</Width></TablixColumn>
    </TablixColumns>
    <TablixRows>
      <TablixRow>                       <!-- header row -->
        <Height>0.25in</Height>
        <TablixCells>
          <TablixCell><CellContents>
            <Textbox Name="hdrState">
              <CanGrow>true</CanGrow><KeepTogether>true</KeepTogether>
              <Paragraphs><Paragraph><TextRuns><TextRun>
                <Value>State</Value><Style><FontWeight>Bold</FontWeight></Style>
              </TextRun></TextRuns><Style/></Paragraph></Paragraphs>
              <Style><Border><Style>None</Style></Border></Style>
            </Textbox>
          </CellContents></TablixCell>
          <TablixCell><CellContents>
            <Textbox Name="hdrSales"><CanGrow>true</CanGrow><KeepTogether>true</KeepTogether>
              <Paragraphs><Paragraph><TextRuns><TextRun><Value>Sales</Value><Style/></TextRun></TextRuns><Style/></Paragraph></Paragraphs>
              <Style><Border><Style>None</Style></Border></Style></Textbox>
          </CellContents></TablixCell>
        </TablixCells>
      </TablixRow>
      <TablixRow>                       <!-- data row -->
        <Height>0.25in</Height>
        <TablixCells>
          <TablixCell><CellContents>
            <Textbox Name="State"><CanGrow>true</CanGrow><KeepTogether>true</KeepTogether>
              <Paragraphs><Paragraph><TextRuns><TextRun><Value>=Fields!State.Value</Value><Style/></TextRun></TextRuns><Style/></Paragraph></Paragraphs>
              <Style><Border><Style>None</Style></Border></Style></Textbox>
          </CellContents></TablixCell>
          <TablixCell><CellContents>
            <Textbox Name="Sales"><CanGrow>true</CanGrow><KeepTogether>true</KeepTogether>
              <Paragraphs><Paragraph><TextRuns><TextRun><Value>=Sum(Fields!Sales.Value)</Value>
                <Style><Format>'$'#,0.00;('$'#,0.00)</Format></Style></TextRun></TextRuns><Style/></Paragraph></Paragraphs>
              <Style><Border><Style>None</Style></Border></Style></Textbox>
          </CellContents></TablixCell>
        </TablixCells>
      </TablixRow>
    </TablixRows>
  </TablixBody>
  <TablixColumnHierarchy>
    <TablixMembers><TablixMember /><TablixMember /></TablixMembers>  <!-- one per column -->
  </TablixColumnHierarchy>
  <TablixRowHierarchy>
    <TablixMembers><TablixMember /><TablixMember /></TablixMembers>  <!-- one per row -->
  </TablixRowHierarchy>
  <DataSetName>CustomerSales</DataSetName>
  <Top>0.6in</Top><Left>0.2in</Left><Height>0.5in</Height><Width>2.8in</Width>
  <Style><Border><Style>None</Style></Border></Style>
</Tablix>
```

Count invariants the engine enforces (validator checks these):

- `TablixColumnHierarchy/TablixMembers` child count == number of `<TablixColumn>`
- `TablixRowHierarchy/TablixMembers` child count == number of `<TablixRow>`
- every `<TablixRow>` has the same number of `<TablixCell>` as there are columns (span via `<ColSpan>` inside `<CellContents>`)

Position/size (`Top`, `Left`, `Height`, `Width`) come after the hierarchies and `<DataSetName>`.

### Grouping and drill-down

A row group adds `<Group>` and nests child members:

```xml
<TablixRowHierarchy>
  <TablixMembers>
    <TablixMember />                          <!-- static header -->
    <TablixMember>
      <Group Name="ByCountry">
        <GroupExpressions><GroupExpression>=Fields!Country.Value</GroupExpression></GroupExpressions>
      </Group>
      <SortExpressions><SortExpression><Value>=Fields!Country.Value</Value></SortExpression></SortExpressions>
      <TablixMembers>
        <TablixMember><KeepWithGroup>After</KeepWithGroup></TablixMember>
        <TablixMember>
          <Group Name="BySalesperson">
            <GroupExpressions><GroupExpression>=Fields!Salesperson.Value</GroupExpression></GroupExpressions>
          </Group>
          <TablixMembers><TablixMember /></TablixMembers>
          <Visibility><Hidden>true</Hidden><ToggleItem>ByCountry</ToggleItem></Visibility>  <!-- drill-down -->
        </TablixMember>
      </TablixMembers>
    </TablixMember>
  </TablixMembers>
</TablixRowHierarchy>
```

`<Group Name>` must be unique within its data region (Report Builder also makes group names unique report-wide by convention, so when copying a tablix into an existing report, rename its groups to avoid confusion). `<Visibility><Hidden>true</Hidden><ToggleItem>` makes a click-to-expand drill-down. `<KeepWithGroup>` (`After`/`Before`) plus `<RepeatOnNewPage>` keeps group headers/footers attached across page breaks.

## Textbox, paragraphs, text runs

A `<Textbox>` holds `<Paragraphs>`; each `<Paragraph>` holds `<TextRuns>`; each `<TextRun>` has its own `<Style>`. Mixed formatting in one cell = multiple text runs. A `<Value>` beginning with `=` is a VB.NET expression; otherwise it is a literal. `xml:space="preserve"` on `<Value>` keeps literal whitespace. `<CanGrow>true</CanGrow>` lets the box expand vertically; `<ZIndex>` controls overlap stacking.

## Images and embedded images

```xml
<EmbeddedImages>
  <EmbeddedImage Name="Logo">
    <MIMEType>image/png</MIMEType>
    <ImageData>iVBORw0KGgo...base64...</ImageData>
  </EmbeddedImage>
</EmbeddedImages>
```

Referenced by an `<Image>` report item with `<Source>Embedded</Source>` and `<Value>Logo</Value>` (matching the `EmbeddedImage Name`). `<Source>` is `Embedded` | `External` (URL) | `Database` (field). `<Sizing>` is `AutoSize` | `Fit` | `FitProportional` | `Clip`.

## Charts

`<Chart>` mirrors the tablix grouping idea: `<ChartCategoryHierarchy>` (x), `<ChartSeriesHierarchy>` (series), and `<ChartData><ChartSeriesCollection><ChartSeries>` with `<ChartDataPoints>` whose `<ChartDataPointValues><Y>=Sum(...)</Y>`. `<Type>` (e.g. `Line`, `Column`, `Bar`) and `<Subtype>` (e.g. `Smooth`, `Stacked`) sit on `<ChartSeries>`. A sparkline is just a `<Chart>` in a `<TablixCell>` with `<Visible>False</Visible>` and `<Margin>False</Margin>` on its axes. Charts are verbose; copy a working `<Chart>` from a sample rather than hand-typing one.

## Report parameters

```xml
<ReportParameters>
  <ReportParameter Name="Year">
    <DataType>Integer</DataType>          <!-- String|Integer|Float|DateTime|Boolean -->
    <DefaultValue>                         <!-- static, or use <DataSetReference> for dynamic -->
      <Values><Value>2025</Value></Values>
    </DefaultValue>
    <Prompt>Year:</Prompt>
    <ValidValues>                          <!-- populate dropdown from a dataset -->
      <DataSetReference>
        <DataSetName>dsYears</DataSetName>
        <ValueField>CalendarYear</ValueField>
        <LabelField>CalendarYear</LabelField>
      </DataSetReference>
    </ValidValues>
  </ReportParameter>
</ReportParameters>
```

This is the child order Report Builder writes (`DataType`, then `DefaultValue`, then `Prompt`, then `ValidValues`, then `MultiValue` if present), and what the starter templates use. As with all RDL the XSD does not enforce it, but follow it to match what loads cleanly.

Add `<MultiValue>true</MultiValue>` for multi-select, `<Nullable>true</Nullable>` and `<AllowBlank>true</AllowBlank>` where appropriate. `<ReportParametersLayout>` (a `<GridLayoutDefinition>` of `<CellDefinition>` with `ColumnIndex`/`RowIndex`/`ParameterName`) controls the prompt-pane grid; an empty element is valid, and parameters omitted from it are hidden.

Cascading parameters: a child parameter's `ValidValues` dataset takes the parent parameter as a query parameter, so selecting the parent re-queries the child's list. Each cascade step is a separate query on every change; in the service this is sequential and slow, so keep cascades shallow.

## Unwritten rules and common breakage

- **Element order is load-bearing in practice** (the processor/Report Builder enforce it, not the XSD; see top). `ReportParameters` after `ReportSections`; `QueryParameters` before `CommandText`; `EmbeddedImages` after `ReportParametersLayout`.
- **`rd:ReportID` must be a fresh, valid GUID per file.** Reusing a GUID across deployed reports collides in the server catalog. Templates that ship a fixed GUID (for app-owns-data) must have it regenerated before production.
- **`Name` attributes are unique within their namespace**, not the whole report: the namespace is the innermost containing element that itself has a Name. So two different tablixes can each contain a group named "Detail" or a textbox named "Sales"; only same-scope duplicates break.
- **Tablix count invariants** (column-hierarchy leaf members == `<TablixColumn>`; row-hierarchy leaf members == `<TablixRow>`; one `<TablixCell>` per column in each row). `ColSpan` is a render-merge hint and does not change the cell count. Off-by-one here is the most common hand-authoring error.
- **`rd:` child elements may sit in either order** relative to schema elements (Report Builder writes `rd:TypeName` before `<DataField>` in a `<Field>`, and `rd:SecurityType` before `<ConnectionProperties>` in a `<DataSource>`; the reverse also loads). Do not treat their position as load-bearing.
- **Escape XML special chars in `<CommandText>`.** Unescaped `<`, `>`, `&` corrupt the document.
- **Units are mandatory on layout dimensions** (`0.5in`, not `0.5`). The exception is the internal coordinate space of charts, gauges, and maps, where dimensions are unitless numbers.
- **`<DataSource Name>` and field `Name` must be NCNames** (start with letter/underscore, no spaces).
- **`<Language>` is optional.** Report Builder usually omits it and the viewer's locale is inferred; set `Report.Language` to a static culture (e.g. `en-US`) to override the viewer's locale for formatting. An `=` expression sets it dynamically but does not override the browser/Power BI language. Do not invent it as required, but do not strip a legitimate one from an existing report.

For the PDF width trap, renderer selection, expression-scope rules, and the optimized-vs-standard execution environments, see `references/renderers.md`.
