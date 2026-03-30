# Paginated Reports

## Overview

Paginated reports (.rdl files) share the same Reports operation group in the Power BI REST API as standard Power BI reports (.pbix). The API distinguishes them by the `reportType` property on the Report object:

- `reportType: "PaginatedReport"` -- paginated (.rdl)
- `reportType: "PowerBIReport"` -- standard (.pbix)

The `format` field returns `"RDL"` for paginated reports.

Key differences from Power BI reports in API behavior:

- Paginated reports do not require a single bound semantic model. They can have multiple data sources or none at all.
- The `datasetId` field may be empty or irrelevant for paginated reports.
- Paginated reports have their own datasource management endpoints (Get Datasources, Update Datasources, Bind To Gateway, Take Over) that only work for paginated reports.
- Export formats differ: paginated reports support XLSX, DOCX, CSV, XML, MHTML, IMAGE, and ACCESSIBLEPDF in addition to PDF and PPTX. Power BI reports support PNG but not these paginated-only formats.
- The export request body uses a `paginatedReportConfiguration` object instead of `powerBIReportConfiguration`.

All endpoints exist in two variants: My Workspace (`/reports/{reportId}/...`) and In Group (`/groups/{groupId}/reports/{reportId}/...`). The In Group variants are standard for workspace-scoped operations and are used throughout this reference.


## Listing and Identifying Paginated Reports

List all reports in a workspace and filter to paginated reports using the `reportType` field:

```bash
WS_ID="<workspace-id>"

# List all reports
fab api -A powerbi "groups/$WS_ID/reports"

# Filter to paginated reports only (client-side with jmespath)
fab api -A powerbi "groups/$WS_ID/reports" -q "value[?reportType=='PaginatedReport']"

# Get names and IDs of paginated reports
fab api -A powerbi "groups/$WS_ID/reports" \
  -q "value[?reportType=='PaginatedReport'].{name: name, id: id}"
```

Retrieve metadata for a specific paginated report:

```bash
fab api -A powerbi "groups/$WS_ID/reports/$REPORT_ID"
```

The response includes `reportType`, `name`, `embedUrl`, `webUrl`, `datasetId` (may be empty), and `format` (`"RDL"`).


## Upload / Import .rdl Files

Upload an .rdl file using the imports endpoint. The `datasetDisplayName` query parameter must include the `.rdl` extension to distinguish from .pbix uploads:

```bash
# Upload an .rdl file
# Note: fab api does not support multipart/form-data natively.
# Use curl or a wrapper script for the actual file upload.
curl -X POST \
  "https://api.powerbi.com/v1.0/myorg/groups/$WS_ID/imports?datasetDisplayName=SalesReport.rdl&nameConflict=Overwrite" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: multipart/form-data" \
  -F "file=@/path/to/SalesReport.rdl"
```

Import parameters:

| Parameter | Values | Notes |
|---|---|---|
| `datasetDisplayName` | `<name>.rdl` | Must include `.rdl` extension |
| `nameConflict` | `Abort`, `Overwrite` | Only these two are supported for .rdl files |
| `subfolderObjectId` | GUID | Optional; import into a subfolder |

Import constraints:

- Maximum .rdl file size: 20 MB.
- Import is asynchronous. Poll for status after submitting.
- Required scope: `Dataset.ReadWrite.All`.

Poll for import completion:

```bash
fab api -A powerbi "groups/$WS_ID/imports/$IMPORT_ID"

# Check status field
fab api -A powerbi "groups/$WS_ID/imports/$IMPORT_ID" -q "importState"
```

The `importState` field transitions through `Publishing` to `Succeeded` or `Failed`.


## Download / Export .rdl Definition

Download the raw .rdl file for a paginated report:

```bash
fab api -A powerbi "groups/$WS_ID/reports/$REPORT_ID/Export"
```

The response is the .rdl file content (binary stream). Redirect output to a file to save:

```bash
fab api -A powerbi "groups/$WS_ID/reports/$REPORT_ID/Export" > SalesReport.rdl
```

Required scopes: `Report.ReadWrite.All` or both `Report.Read.All` and `Dataset.Read.All`.


## Datasource Management

These endpoints only work for paginated reports. Calling them against a Power BI report returns an error.

### Get Datasources

Retrieve the list of data sources embedded in a paginated report:

```bash
fab api -A powerbi "groups/$WS_ID/reports/$REPORT_ID/datasources"

# Extract connection details
fab api -A powerbi "groups/$WS_ID/reports/$REPORT_ID/datasources" \
  -q "value[].{name: name, type: datasourceType, server: connectionDetails.server, database: connectionDetails.database}"
```

The response includes `datasourceType`, `connectionDetails` (server, database, url, path), `gatewayId`, and `datasourceId` for each data source.

### Update Datasources

Change connection details for one or more data sources. This does not change the data source type -- only the connection target:

```bash
fab api -A powerbi -X post \
  "groups/$WS_ID/reports/$REPORT_ID/Default.UpdateDatasources" \
  -i '{
    "updateDetails": [
      {
        "datasourceName": "SqlDatasource",
        "connectionDetails": {
          "server": "new-sql-server.database.windows.net",
          "database": "NewDatabase"
        }
      }
    ]
  }'
```

Constraints:

- The original and new data source must have the exact same schema.
- Changing the data source type is not supported.
- ODBC data sources are not supported.
- Requires data source ownership (call Take Over first if needed).

### Bind to Gateway

Bind paginated report data sources to an on-premises data gateway:

```bash
fab api -A powerbi -X post \
  "groups/$WS_ID/reports/$REPORT_ID/Default.BindToGateway" \
  -i '{
    "gatewayObjectId": "<gateway-id>",
    "bindDetails": [
      {
        "dataSourceName": "DataSource1",
        "dataSourceObjectId": "<datasource-id-on-gateway>"
      }
    ]
  }'
```

Only on-premises data gateways are supported. Retrieve available gateways and their data sources through the Gateways API before binding.

### Take Over Datasources

Transfer data source ownership to the current authenticated user. This is a prerequisite for updating data sources when another user currently owns them:

```bash
fab api -A powerbi -X post \
  "groups/$WS_ID/reports/$REPORT_ID/Default.TakeOver"
```

No request body is required. Only works for paginated reports.


## Export to File (Render)

The export-to-file API renders a paginated report to a specific file format (PDF, Excel, Word, etc.). This is an asynchronous three-step process.

### Supported Formats

| Format enum | File type | Notes |
|---|---|---|
| `PDF` | .pdf | Standard PDF rendering |
| `ACCESSIBLEPDF` | .pdf | PDF/UA (accessible PDF) -- paginated only |
| `PPTX` | .pptx | PowerPoint |
| `XLSX` | .xlsx | Excel -- paginated only |
| `DOCX` | .docx | Word -- paginated only |
| `CSV` | .csv | Paginated only |
| `XML` | .xml | Paginated only |
| `MHTML` | .mhtml | Web archive -- paginated only |
| `IMAGE` | varies | Paginated only; sub-formats: TIFF (default), BMP, EMF, GIF, JPEG, PNG |

Note: `PNG` format is exclusive to Power BI reports. For paginated report image output, use `IMAGE` format with `OutputFormat` in `formatSettings`.

### Step 1: Initiate Export

```bash
fab api -A powerbi -X post \
  "groups/$WS_ID/reports/$REPORT_ID/ExportTo" \
  -i '{
    "format": "PDF",
    "paginatedReportConfiguration": {
      "parameterValues": [
        {"name": "State", "value": "WA"},
        {"name": "City", "value": "Seattle"}
      ],
      "formatSettings": {
        "PageHeight": "11in",
        "PageWidth": "8.5in"
      }
    }
  }'
```

The response returns an Export object. Extract the export ID:

```bash
fab api -A powerbi -X post \
  "groups/$WS_ID/reports/$REPORT_ID/ExportTo" \
  -i '{
    "format": "XLSX"
  }' -q "id"
```

### Step 2: Poll Export Status

Poll the status endpoint until the export completes. Respect the `Retry-After` header in the response:

```bash
EXPORT_ID="<export-id-from-step-1>"

fab api -A powerbi "groups/$WS_ID/reports/$REPORT_ID/exports/$EXPORT_ID/status"

# Check status field
fab api -A powerbi "groups/$WS_ID/reports/$REPORT_ID/exports/$EXPORT_ID/status" -q "status"
```

Status values: `NotStarted`, `Running`, `Succeeded`, `Failed`.

### Step 3: Download Exported File

Once status is `Succeeded`, download the rendered file:

```bash
fab api -A powerbi \
  "groups/$WS_ID/reports/$REPORT_ID/exports/$EXPORT_ID/file" > report.pdf
```

The download URL remains valid for 24 hours after export completion.

### Configuration Object

The `paginatedReportConfiguration` object controls rendering:

| Property | Type | Description |
|---|---|---|
| `parameterValues` | `ParameterValue[]` | Report parameter name/value pairs |
| `formatSettings` | `Dictionary<string, string>` | Device info parameters (page size, margins, output format) |
| `identities` | `EffectiveIdentity[]` | Row-level security or SSO identity |
| `locale` | `string` | Locale for the export (e.g. `"en-us"`) |

### Passing Parameters

Pass report parameters as an array of name/value objects. All values are strings:

```bash
fab api -A powerbi -X post \
  "groups/$WS_ID/reports/$REPORT_ID/ExportTo" \
  -i '{
    "format": "PDF",
    "paginatedReportConfiguration": {
      "parameterValues": [
        {"name": "Year", "value": "2025"},
        {"name": "Region", "value": "West"},
        {"name": "Region", "value": "East"}
      ]
    }
  }'
```

For multi-value parameters, repeat the same `name` with each value as a separate entry (as shown with `Region` above).

### Format Settings

Common device info parameters available in `formatSettings`:

| Setting | Example | Description |
|---|---|---|
| `PageHeight` | `"11in"` | Page height with unit |
| `PageWidth` | `"8.5in"` | Page width with unit |
| `MarginTop` | `"1in"` | Top margin |
| `MarginBottom` | `"1in"` | Bottom margin |
| `MarginLeft` | `"0.5in"` | Left margin |
| `MarginRight` | `"0.5in"` | Right margin |
| `StartPage` | `"1"` | First page to render |
| `EndPage` | `"10"` | Last page to render |
| `OutputFormat` | `"JPEG"` | Sub-format for IMAGE type: TIFF, BMP, EMF, GIF, JPEG, PNG |
| `AccessiblePDF` | `"true"` | Generate PDF/UA when format is PDF |
| `UseReportPageSize` | `"true"` | Respect report page size for PPTX |

Export a specific page range as JPEG images:

```bash
fab api -A powerbi -X post \
  "groups/$WS_ID/reports/$REPORT_ID/ExportTo" \
  -i '{
    "format": "IMAGE",
    "paginatedReportConfiguration": {
      "formatSettings": {
        "OutputFormat": "JPEG",
        "StartPage": "1",
        "EndPage": "3"
      }
    }
  }'
```

### Row-Level Security

Supply `identities` to enforce RLS during export. The `username` must match a Microsoft Entra ID user:

```bash
fab api -A powerbi -X post \
  "groups/$WS_ID/reports/$REPORT_ID/ExportTo" \
  -i '{
    "format": "PDF",
    "paginatedReportConfiguration": {
      "identities": [
        {
          "username": "analyst@contoso.com"
        }
      ]
    }
  }'
```

For SSO with Azure SQL, include an `identityBlob` with an OAuth access token for `https://database.windows.net`. For Dataverse SSO, supply a token for the environment URL (e.g. `https://contoso.crm.dynamics.com`):

```bash
fab api -A powerbi -X post \
  "groups/$WS_ID/reports/$REPORT_ID/ExportTo" \
  -i '{
    "format": "PDF",
    "paginatedReportConfiguration": {
      "identities": [
        {
          "username": "analyst@contoso.com",
          "identityBlob": {
            "value": "<oauth-access-token>"
          }
        }
      ]
    }
  }'
```


## Admin Endpoints

Admin endpoints provide tenant-wide visibility. These use the `admin` path prefix:

```bash
# List all reports across the tenant (filter to paginated)
fab api -A powerbi "admin/reports" \
  -q "value[?reportType=='PaginatedReport'].{name: name, id: id, workspaceId: groupId}"

# List reports in a specific workspace (admin scope)
fab api -A powerbi "admin/groups/$WS_ID/reports"

# Get users with access to a report
fab api -A powerbi "admin/reports/$REPORT_ID/users"

# Get email subscriptions for a report
fab api -A powerbi "admin/reports/$REPORT_ID/subscriptions"
```

### Workspace Scanner

The workspace scanner APIs retrieve metadata about paginated reports alongside other items:

```bash
# Initiate scan
fab api -A powerbi -X post "admin/workspaces/getInfo" \
  -i '{"workspaces": ["<workspace-id>"]}'

# Check scan status
fab api -A powerbi "admin/workspaces/scanStatus/$SCAN_ID"

# Retrieve scan results (includes reports with reportType)
fab api -A powerbi "admin/workspaces/scanResult/$SCAN_ID"
```

Service principals can call read-only admin APIs (GetReportsAsAdmin, GetReportsInGroupAsAdmin, GetReportSubscriptionsAsAdmin, GetReportUsersAsAdmin) without admin-consent required permissions in Azure portal.


## Concurrency Limits

| Capacity type | Limit |
|---|---|
| Premium / Embedded / Fabric | Max 500 concurrent paginated report render requests per capacity |
| PPU (Per-User Premium) | 1 export request per 5-minute window; exceeding returns HTTP 429 |
| Export timeout | 60 minutes maximum |

The report must reside in a workspace backed by Premium, Embedded, or Fabric capacity. Exports against shared capacity are not supported.


## Common Workflows

### Export a Monthly Invoice to PDF

```bash
WS_ID="<workspace-id>"
REPORT_ID="<report-id>"

# Step 1: Trigger export with parameters
EXPORT_ID=$(fab api -A powerbi -X post \
  "groups/$WS_ID/reports/$REPORT_ID/ExportTo" \
  -i '{
    "format": "PDF",
    "paginatedReportConfiguration": {
      "parameterValues": [
        {"name": "Month", "value": "2026-03"},
        {"name": "CustomerID", "value": "CUST-4821"}
      ],
      "formatSettings": {
        "PageHeight": "11in",
        "PageWidth": "8.5in",
        "MarginTop": "0.5in",
        "MarginBottom": "0.5in"
      }
    }
  }' -q "id" | tr -d '"')

# Step 2: Poll until complete
while true; do
  STATUS=$(fab api -A powerbi \
    "groups/$WS_ID/reports/$REPORT_ID/exports/$EXPORT_ID/status" \
    -q "status" | tr -d '"')
  echo "Status: $STATUS"
  [ "$STATUS" = "Succeeded" ] || [ "$STATUS" = "Failed" ] && break
  sleep 5
done

# Step 3: Download
if [ "$STATUS" = "Succeeded" ]; then
  fab api -A powerbi \
    "groups/$WS_ID/reports/$REPORT_ID/exports/$EXPORT_ID/file" \
    > invoice-2026-03.pdf
fi
```

### Migrate Datasources After Deployment

After deploying a paginated report to a new environment, update its data sources to point to the target server:

```bash
# Take ownership
fab api -A powerbi -X post "groups/$WS_ID/reports/$REPORT_ID/Default.TakeOver"

# Inspect current datasources
fab api -A powerbi "groups/$WS_ID/reports/$REPORT_ID/datasources" \
  -q "value[].{name: name, server: connectionDetails.server, db: connectionDetails.database}"

# Update to production server
fab api -A powerbi -X post \
  "groups/$WS_ID/reports/$REPORT_ID/Default.UpdateDatasources" \
  -i '{
    "updateDetails": [
      {
        "datasourceName": "SqlDatasource",
        "connectionDetails": {
          "server": "prod-sql.database.windows.net",
          "database": "SalesDB"
        }
      }
    ]
  }'
```

### Rebind to a Different Semantic Model

When a paginated report uses a Power BI semantic model as its data source, rebind it to a different model:

```bash
fab api -A powerbi -X post \
  "groups/$WS_ID/reports/$REPORT_ID/Rebind" \
  -i '{
    "datasetId": "<new-semantic-model-id>"
  }'
```

### Bulk Export All Paginated Reports as Excel

```bash
WS_ID="<workspace-id>"

# Get all paginated report IDs
REPORT_IDS=$(fab api -A powerbi "groups/$WS_ID/reports" \
  -q "value[?reportType=='PaginatedReport'].[id, name]")

# Loop and export each (simplified -- production code should handle polling)
for REPORT_ID in $(echo "$REPORT_IDS" | jq -r '.[0]'); do
  EXPORT_ID=$(fab api -A powerbi -X post \
    "groups/$WS_ID/reports/$REPORT_ID/ExportTo" \
    -i '{"format": "XLSX"}' -q "id" | tr -d '"')
  echo "Triggered export $EXPORT_ID for report $REPORT_ID"
done
```

### Unsupported Scenarios

The following combinations are not supported for export-to-file:

- Semantic model datasource with SSO enabled and an effective identity provided.
- Semantic model with DirectQuery to Azure AS or another Power BI semantic model, combined with an effective identity.
- Azure Analysis Services datasource with SSO when the caller is a service principal profile.
- File share URL hyperlinks (UNC paths) do not render in exported files.
