#!/usr/bin/env bash
set -euo pipefail
cat > report.rdl <<'XML'
<?xml version="1.0" encoding="utf-8"?>
<Report xmlns="http://schemas.microsoft.com/sqlserver/reporting/2016/01/reportdefinition" xmlns:rd="http://schemas.microsoft.com/SQLServer/reporting/reportdesigner">
  <rd:ReportID>6b3b8a38-3d9a-4c64-9c63-0d3f6f2c1a11</rd:ReportID>
  <DataSources>
    <DataSource Name="Inline">
      <ConnectionProperties><DataProvider>ENTERDATA</DataProvider><ConnectString /></ConnectionProperties>
      <rd:SecurityType>None</rd:SecurityType>
    </DataSource>
  </DataSources>
  <DataSets>
    <DataSet Name="Sales">
      <Query>
        <DataSourceName>Inline</DataSourceName>
        <CommandText>&lt;Query&gt;&lt;XmlData&gt;&lt;Rows&gt;&lt;Row&gt;&lt;Region&gt;East&lt;/Region&gt;&lt;Revenue&gt;10&lt;/Revenue&gt;&lt;/Row&gt;&lt;/Rows&gt;&lt;/XmlData&gt;&lt;/Query&gt;</CommandText>
      </Query>
      <Fields>
        <Field Name="Region"><DataField>Region</DataField><rd:TypeName>System.String</rd:TypeName></Field>
        <Field Name="Revenue"><DataField>Revenue</DataField><rd:TypeName>System.String</rd:TypeName></Field>
      </Fields>
    </DataSet>
  </DataSets>
  <ReportSections>
    <ReportSection>
      <Body>
        <ReportItems>
          <Tablix Name="SalesTablix">
            <TablixBody>
              <TablixColumns>
                <TablixColumn><Width>5in</Width></TablixColumn>
                <TablixColumn><Width>5in</Width></TablixColumn>
              </TablixColumns>
              <TablixRows>
                <TablixRow>
                  <Height>0.25in</Height>
                  <TablixCells>
                    <TablixCell><CellContents><Textbox Name="Region"><CanGrow>true</CanGrow><KeepTogether>true</KeepTogether><Paragraphs><Paragraph><TextRuns><TextRun><Value>=Fields!Region.Value</Value><Style /></TextRun></TextRuns><Style /></Paragraph></Paragraphs></Textbox></CellContents></TablixCell>
                    <TablixCell><CellContents><Textbox Name="Revenue"><CanGrow>true</CanGrow><KeepTogether>true</KeepTogether><Paragraphs><Paragraph><TextRuns><TextRun><Value>=Fields!Revenue.Value</Value><Style /></TextRun></TextRuns><Style /></Paragraph></Paragraphs></Textbox></CellContents></TablixCell>
                  </TablixCells>
                </TablixRow>
              </TablixRows>
            </TablixBody>
            <TablixColumnHierarchy><TablixMembers><TablixMember /><TablixMember /></TablixMembers></TablixColumnHierarchy>
            <TablixRowHierarchy><TablixMembers><TablixMember /></TablixMembers></TablixRowHierarchy>
            <DataSetName>Sales</DataSetName>
            <Top>0in</Top><Left>0in</Left><Height>0.25in</Height><Width>10in</Width>
          </Tablix>
        </ReportItems>
        <Height>1in</Height>
      </Body>
      <Width>10in</Width>
      <Page>
        <PageHeight>8.5in</PageHeight>
        <PageWidth>11in</PageWidth>
        <LeftMargin>0.5in</LeftMargin>
        <RightMargin>0.5in</RightMargin>
        <TopMargin>0.5in</TopMargin>
        <BottomMargin>0.5in</BottomMargin>
      </Page>
    </ReportSection>
  </ReportSections>
</Report>
XML
