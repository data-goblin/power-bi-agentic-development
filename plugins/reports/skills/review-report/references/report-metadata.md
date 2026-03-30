# Report Metadata

Reference for retrieving and interpreting report-level metadata: thick vs thin, endorsement, sensitivity labels, deployment pipelines, and model properties.

## Thick vs Thin Reports

A **thin report** connects to a published semantic model in the Power BI service. A **thick report** embeds its own semantic model (the .pbix model and report are bundled together).

**Thin reports are preferred** because:
- Multiple reports can share one model (single source of truth)
- Model changes propagate to all connected reports
- Separation of concerns (model team vs report team)
- Lower storage footprint

### Detection

There is no direct API field for thick/thin. Infer it with these heuristics:

1. **Same-name model in same workspace:** If a workspace has `Sales.Report` and `Sales.SemanticModel`, the report is likely thick (auto-generated model from .pbix upload).
2. **datasetWorkspaceId matches report workspace:** Check the report's `datasetWorkspaceId` field. If it matches the report's workspace, it may be thick. If it points to a different workspace, it is thin.
3. **Report-to-model ratio:** A healthy workspace has more reports than models (many reports sharing few models). A 1:1 ratio suggests thick reports.

```bash
# Get report's connected model and workspace
fab api -A powerbi "groups/{wsId}/reports/{reportId}" \
  -q "{datasetId: datasetId, datasetWorkspaceId: datasetWorkspaceId, name: name}"

# List all items to compare report:model ratio
fab ls "{workspace}.Workspace" -l
```

### DataHub V2 Fields for Models

The DataHub V2 API (`/metadata/datahub/V2/artifacts` with `supportedTypes: ["Model"]`) returns rich model metadata not available via standard APIs:

| Field | Location | Description |
|---|---|---|
| `storageMode` | `artifact.storageMode` | 1=Import, 2=DirectQuery; check `directLakeMode` for Direct Lake |
| `directLakeMode` | `artifact.directLakeMode` | Boolean; true for Direct Lake models |
| `sizeInMBs` | `artifact.sizeInMBs` | Model size on disk |
| `sharedFromEnterpriseCapacitySku` | `artifact.sharedFromEnterpriseCapacitySku` | Capacity SKU (PP3, F64, etc.) |
| `refreshSchedule` | `artifact.refreshSchedule` | Full refresh config (enabled, frequency, days) |
| `ownerUser` | top-level | Full owner object (name, email, AAD ID) |
| `creatorUserPrincipalName` | `artifact.creatorUserPrincipalName` | Who created the model |
| `lastRefreshTime` | top-level (OData date) | Last data refresh |
| `lastVisitedTimeUTC` | top-level | Last access timestamp |
| `isInEnterpriseCapacity` | `artifact.isInEnterpriseCapacity` | Whether on paid capacity |

## Endorsement Status

Reports and models can be endorsed as **Certified** (verified by a designated authority) or **Promoted** (recommended by the owner).

### Checking Endorsement

```bash
# Via workspace scanner API (Fabric Admin)
# Step 1: Trigger scan
fab api "admin/workspaces/getInfo" -X post \
  -i '{"workspaces":["<wsId>"]}'

# Step 2: Get scan result (after scan completes)
fab api "admin/workspaces/scanResult/<scanId>"
# Response includes endorsementDetails for each item
```

Alternatively, the `admin/reports` endpoint may return `endorsementDetails` if the report has been endorsed:

```bash
fab api -A powerbi "admin/reports/{reportId}"
# Check for endorsementDetails field (null if not endorsed)
```

**Endorsement values:**
- `null` -- Not endorsed
- `{"endorsement": "Promoted"}` -- Owner-promoted
- `{"endorsement": "Certified", "certifiedBy": "user@org.com"}` -- Certified by authority

### Review Guidance

- Certified reports should have higher quality standards
- Promoted reports indicate the owner considers them ready for broader use
- Unendorsed reports in production workspaces may need review

## Sensitivity Labels

Sensitivity labels (from Microsoft Purview) classify data confidentiality.

```bash
# Check via admin API (Fabric Admin)
fab api -A powerbi "admin/reports/{reportId}"
# Look for sensitivityLabel field

# Or via fab CLI
fab label get "{workspace}.Workspace/{report}.Report"
```

### Review Guidance

- Reports without labels in a tenant that requires them should be flagged
- Reports with high-sensitivity labels should not have publish-to-web enabled
- Check that sensitivity labels match the data classification of the underlying model

## Deployment Pipeline Membership

Check whether a report is part of a CI/CD deployment pipeline:

```bash
# List all pipelines (Fabric Admin)
fab api -A powerbi "admin/pipelines"

# Get pipeline stages
fab api -A powerbi "admin/pipelines/{pipelineId}/stages"

# Match workspace IDs to find which pipeline contains the report's workspace
```

### Review Guidance

- Reports in deployment pipelines follow a governed promotion process (dev -> test -> prod)
- Reports NOT in a pipeline that are in production workspaces may lack change management
- Check which stage the workspace is in (dev/test/prod) to understand the report's lifecycle position

## Report Format

```bash
fab api -A powerbi "groups/{wsId}/reports/{reportId}" -q "format"
```

| Format | Description |
|---|---|
| `PBIR` | Power BI Report (new format, file-based, git-friendly) |
| `PBIT` | Power BI Template |
| (empty/null) | Legacy PBIX format |

## Quick Metadata Checklist

When reviewing a report, collect these metadata points:

```
Report:     <name>
Format:     PBIR / PBIX
Type:       Thin / Thick
Model:      <model name> (Import / DirectQuery / Direct Lake)
Model size: <n> MB
Endorsed:   Certified / Promoted / None
Sensitivity: <label> / None
Pipeline:   <pipeline name> stage <n> / None
Capacity:   <SKU>
Owner:      <email>
```
