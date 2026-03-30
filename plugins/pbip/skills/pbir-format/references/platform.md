# .platform

Fabric Git integration metadata. Present when the report is synced with a Fabric workspace via Git.

**Location:** `Report.Report/.platform`

```json
{
  "$schema": "https://developer.microsoft.com/json-schemas/fabric/gitIntegration/platformProperties/2.0.0/schema.json",
  "metadata": {
    "type": "Report",
    "displayName": "My Report"
  },
  "config": {
    "version": "2.0",
    "logicalId": "1b2a96e3-19f0-4ace-a2b9-55decaf15cb3"
  }
}
```

**metadata fields:**
- `metadata.type` -- item type (`"Report"`, `"SemanticModel"`, etc.)
- `metadata.displayName` -- display name in Fabric workspace
- `metadata.description` -- *(optional)* human-readable description of the Fabric item

**config fields:**
- `config.version` -- always `"2.0"`, required, do not change
- `config.logicalId` -- stable GUID that links the local folder to the Fabric item across renames; do not manually edit — managed by the Fabric Git sync process
