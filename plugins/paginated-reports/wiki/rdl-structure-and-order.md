---
title: RDL 2016 element order, page frame and the PDF width trap
summary: The order Report Builder writes, the page and section elements, unit rules, and the width check that hard renderers need.
kind: reference
status: current
sources:
  - url: https://learn.microsoft.com/en-us/openspecs/sql_server_protocols/ms-rdl/
  - url: https://github.com/microsoft/Reporting-Services/tree/master/PaginatedReportSamples
  - url: https://github.com/microsoft/RdlMigration
last_updated: 2026-11-23
last_verified: 2026-11-23
review_cadence_days: 120
verified_by:
  - python3 plugins/paginated-reports/skills/paginated-report/scripts/validate_rdl.py plugins/paginated-reports/skills/paginated-report/assets/enter-data-starter.rdl
  - python3 plugins/paginated-reports/skills/paginated-report/scripts/validate_rdl.py plugins/paginated-reports/skills/paginated-report/assets/semantic-model-starter.rdl
  - python3 plugins/paginated-reports/skills/paginated-report/scripts/validate_rdl.py plugins/paginated-reports/skills/paginated-report/assets/sql-starter.rdl
skills: [paginated-reports/paginated-report]
---

# RDL 2016 element order, page frame and the PDF width trap

[MS-RDL](https://learn.microsoft.com/en-us/openspecs/sql_server_protocols/ms-rdl/) is the format spec. The three starters in `skills/paginated-report/assets/` pass `validate_rdl.py` and are the working examples; so do ten public samples listed in [example reports](paginated-example-reports.md) (checked 2026-11-23).

## Does order matter

The 2016/01 schema (`reportdefinition.xsd` in `microsoft/RdlMigration`) declares the children of `<Report>` and `<ReportSection>` as an unordered choice, so an XSD pass does not catch a reorder. Whether Report Builder or the service rejects a reorder was not tested; Unverified. The validator enforces the order Report Builder writes because that is the only order known to load:

```yaml
structural_order: DataSources, DataSets, ReportSections, ReportParameters, ReportParametersLayout
trailing_metadata: Variables, Code, EmbeddedImages, CustomProperties, ConsumeContainerWhitespace (mutual order is free)
leading_metadata: rd:ReportUnitType, rd:ReportID, am:AuthoringMetadata, df:DefaultFontFamily, Description, Author, AutoRefresh (position varies between Microsoft's own files; not enforced)
ReportParameters: after ReportSections, not before
```

## Root

```xml
<Report MustUnderstand="df"
  xmlns="http://schemas.microsoft.com/sqlserver/reporting/2016/01/reportdefinition"
  xmlns:rd="http://schemas.microsoft.com/SQLServer/reporting/reportdesigner"
  xmlns:df="http://schemas.microsoft.com/sqlserver/reporting/2016/01/reportdefinition/defaultfontfamily">
```

- Use the 2016/01 namespace for new files; 2010 and 2005 put `Body` and `Page` directly under `Report`
- `MustUnderstand="df"` is required whenever `<df:DefaultFontFamily>` is present
- `rd:ReportID` is a fresh GUID per file; regenerate it when copying a starter

## Section and page

```yaml
ReportSection children in order: Body, Width, Page
Page children in order: PageHeader, PageFooter, PageHeight, PageWidth, InteractiveHeight, InteractiveWidth, LeftMargin, RightMargin, TopMargin, BottomMargin, Style
units: in, cm, mm, pt, pc with a unit suffix on every dimension; px is invalid
sizes: Letter 8.5in x 11in, A4 21cm x 29.7cm
globals: Globals!PageNumber, TotalPages and ExecutionTime belong in PageHeader and PageFooter
```

## The PDF width trap

`ReportSection/Width` plus `LeftMargin` plus `RightMargin` must be at most `PageWidth`. Otherwise PDF, Image and Word put the overflow on extra pages to the right; the HTML preview hides it. Landscape Letter with 0.5in margins leaves 10in. `validate_rdl.py` fails this per section and warns when a top-level item ends past the section width.

## Dataset field names

`Field/@Name` is the identifier in `=Fields!Name.Value` and cannot contain spaces; `DataField` is the column the query returns and can. A column `Sales Revenue` becomes `Name="Sales_Revenue"`, `DataField="Sales Revenue"`. Names are case sensitive in expressions; the validator reports a near miss that differs only by case.

## XML escaping

In `CommandText`, `&` is `&amp;`, `<` is `&lt;`, `>` is `&gt;`: DAX `&&` becomes `&amp;&amp;` and `<=` becomes `&lt;=`. `rd:DesignerState` blocks inside `Query` are designer-only and safe to omit.
