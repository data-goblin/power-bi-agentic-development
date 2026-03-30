# Export to Excel Analysis

Export to Excel is one of the most impactful user behaviors in Power BI. When users routinely export data to Excel, it often signals that the report is not meeting their analytical needs... they need to manipulate, combine, or further analyze the data outside of Power BI. It can also be a risk for governance and security.

## Why It Matters

Export to Excel is a key review signal because it indicates:

1. **The report is a data extraction tool, not an analytical tool.** Users treat the report as a pipeline to get data into Excel rather than using it for insights.
2. **The semantic model may lack needed measures or calculations.** Users export raw data because the report doesn't provide the aggregations or comparisons they need.
3. **The report design may be insufficient.** Users may need to pivot, filter, or format data in ways the report doesn't support.
4. **Data governance risk.** Exported data leaves the governed Power BI environment. Sensitivity labels, RLS, and audit controls no longer apply.
5. **Performance impact.** Large exports consume capacity resources and can slow the service for other users.

## Detecting Export to Excel

### Activity Events API (Fabric Admin)

Export activities are captured in the activity events log. Query with:

```bash
fab api -A powerbi "admin/activityevents?startDateTime='YYYY-MM-DDT00:00:00'&endDateTime='YYYY-MM-DDT23:59:59'"
```

### Export-Related Activity Types

From the [Fabric operation list](https://learn.microsoft.com/en-us/fabric/admin/operation-list):

| Activity Type | What It Tracks |
|---|---|
| `ExportReport` | Visual data export (Excel, CSV) AND full report export (PDF, PPTX, PNG). This is the primary event for detecting Excel exports from visuals. |
| `ExportArtifact` | Exported Power BI item to another file format |
| `ExportArtifactDownload` | Downloaded an exported artifact file (.pptx or .pdf download completes) |
| `DownloadReport` | Downloaded Power BI report as .pbix file |
| `ExportTile` | Exported dashboard tile data |

**For visual-level Excel exports** (right-click a table/matrix -> "Export data"), the activity is `ExportReport`. This single event covers multiple export types:
- Data with current layout
- Summarized data (Excel)
- Summarized data (Excel live connected)
- Summarized data (CSV) -- note: CSV export may not be tracked in all cases; this has been reported as a bug
- Underlying data

The `ExportEventPropertyList` property in the event payload contains format details to distinguish between these export types. Inspect the raw JSON to determine the specific format.

**Note:** "Analyze in Excel" (`AnalyzeInExcel`, `AnalyzedByExternalApplication`) is a different consumption method, not an export. It creates a live connection to the model, not a data snapshot. Do not conflate it with visual data exports.

**Timing:** Activity events can take 30-60 minutes to appear in the log. Do not expect immediate results after an export.

### Key Fields in Export Events

| Field | Description |
|---|---|
| `Activity` | Activity type (ExportReport, AnalyzeInExcel, DownloadReport, etc.) |
| `UserId` | Who exported |
| `ReportId` / `ReportName` | Which report |
| `CreationTime` | When the export occurred |
| `ExportEventPropertyList` | Export format and configuration details (varies per event) |
| `ConsumptionMethod` | How they accessed the report (Power BI Web, Mobile, etc.) |

Note: the activity log schema varies per event type. Not all fields are present on every event. Retrieve raw JSON and inspect the available fields for your specific scenario.

### Analyzing Export Patterns

When reviewing export activity for a report, evaluate:

1. **Frequency:** How often are users exporting? Daily exports suggest a workflow dependency on Excel.
2. **Users:** Are many users exporting, or just one? A single heavy exporter may have a specific need; widespread export suggests a report design gap.
3. **Which visuals:** If export events include visual/page context, identify which visuals are being exported. These visuals likely need better in-report alternatives.
4. **Timing:** Do exports correlate with refresh schedules? Users may be exporting fresh data for downstream processes.

## Recommendations by Pattern

| Pattern | Signal | Recommendation |
|---|---|---|
| Same users export daily | Report is a data pipeline | Consider a dataflow, lakehouse, or direct Excel connection to the semantic model instead |
| Many users export the same table/matrix | Table doesn't provide needed aggregation | Add measures, conditional formatting, or drill-through to eliminate the need |
| Users export then email the Excel | Report distribution is broken | Set up email subscriptions with PDF/Excel attachments |
| Users export to combine with other data | Semantic model is incomplete | Extend the model to include the additional data sources |
| Occasional exports for ad-hoc analysis | Normal behavior | No action needed; ensure RLS is applied |

## Other Export Activities

### Download as PBIX

The `DownloadReport` activity indicates a user downloaded the entire report as a .pbix file. This is a significant governance concern:
- The entire semantic model data may be included (Import mode)
- The user can open it locally without RLS enforcement
- Check tenant settings: "Download reports" can be disabled

### Export to PDF / PPTX

The `ExportReport` activity with PDF or PPTX format is generally benign -- users are taking snapshots for presentations or documentation. High frequency may indicate the report should have an email subscription instead.

### Export to PNG / Image

Visual-level image export is less common but can indicate users are embedding report visuals in other documents (Confluence, SharePoint pages, presentations). Consider using Power BI embedded or the publish-to-web feature (for non-sensitive content) instead.

## Querying Export Activity

To find export events for a specific report over the last 7 days:

```bash
# Iterate over the last 7 days (activity API supports 1 day per request)
for i in $(seq 0 6); do
  DATE=$(date -u -v-${i}d '+%Y-%m-%d')
  fab api -A powerbi "admin/activityevents?startDateTime='${DATE}T00:00:00'&endDateTime='${DATE}T23:59:59'" \
    -q "text.activityEventEntities[?Activity=='ExportReport' && ReportId=='<report-id>']"
done
```

For `DownloadReport` events:

```bash
fab api -A powerbi "admin/activityevents?startDateTime='${DATE}T00:00:00'&endDateTime='${DATE}T23:59:59'" \
  -q "text.activityEventEntities[?Activity=='DownloadReport' && ReportId=='<report-id>']"
```
