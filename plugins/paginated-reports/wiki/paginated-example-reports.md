---
title: Real RDL files worth copying constructs from
summary: Public RDL samples on GitHub that pass validate_rdl.py, by construct (invoice, matrix, sparkline, PBIDATASET).
kind: reference
status: current
sources:
  - url: https://github.com/microsoft/Reporting-Services/tree/master/PaginatedReportSamples
last_updated: 2026-11-23
last_verified: 2026-11-23
review_cadence_days: 180
skills: [paginated-reports/paginated-report]
---

# Real RDL files worth copying constructs from

Link only. Fetch the raw file, read the fragment, adapt it, give it a fresh `rd:ReportID`, then run `validate_rdl.py`. Samples that use shared data sources or pre-2016 schemas must be converted to embedded sources and the 2016 namespace before publishing to the service. All files below parsed and passed `validate_rdl.py` on 2026-11-23.

```yaml
Invoice.rdl: microsoft/Reporting-Services, PaginatedReportSamples; header block, line items, totals
RegionalSales.rdl: same folder; a chart per group (sparkline pattern)
CountrySalesPerformance.rdl: same folder; KPI layout, charts, indicators
OrganizationExpenditures.rdl: same folder; matrix with column groups and subtotals
Transcript.rdl, Labels.rdl, Letter.rdl: same folder; list layout, label sheet, mail merge
Daily Sales Orders.rdl: MicrosoftLearning/PL-300-Microsoft-Power-BI-Data-Analyst, Allfiles/Demos/Solutions/Demo-09
Sales Order Report.rdl: MicrosoftLearning/DP-500-Azure-Data-Analyst, Allfiles/15/Solution
SalesSummaryPaginated.rdl: PowerBiDevCamp/App-Owns-Data-Starter-Kit, AppOwnsDataAdmin/wwwroot/PBIX; PBIDATASET connect string and DAX fields (placeholder dataset GUID and a reused ReportID; replace both)
```

Repositories: <https://github.com/microsoft/Reporting-Services>, <https://github.com/MicrosoftLearning/PL-300-Microsoft-Power-BI-Data-Analyst>, <https://github.com/MicrosoftLearning/DP-500-Azure-Data-Analyst>, <https://github.com/PowerBiDevCamp/App-Owns-Data-Starter-Kit>. Check each repository's licence before reusing its content.
