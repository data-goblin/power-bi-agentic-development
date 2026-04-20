# Report Rebinding and Conversion

Converting between thick/thin reports and re-binding reports to different semantic models.

## Overview

**Thick report:** Report + local semantic model in same PBIP project (`.Report` + `.SemanticModel` folders)

**Thin report:** Report only, connects to published semantic model (`.Report` folder only)

**Re-binding:** Changing which semantic model a report connects to

## Converting Thick → Thin

Separate the report from the semantic model to deploy them independently.

### Using pbir CLI (Recommended)

```bash
# Split thick PBIP into thin report (publishes model, rebinds report)
pbir report split-from-thick "ThickReport.Report" --target "Workspace.Workspace/Model.SemanticModel"
```

### Manual Steps

1. **Get target model info** using Fabric CLI:

   ```bash
   fab ls  # Find workspaces
   fab ls WorkspaceName.Workspace  # Find models/reports
   fab get WorkspaceName.Workspace/ModelName.SemanticModel -q "id"  # Get model ID
   ```

2. **Update `definition.pbir`** - Change `datasetReference` from `byPath` to `byConnection`:

   ```json
   {
     "datasetReference": {
       "byConnection": {
         "connectionString": "Data Source=powerbi://api.powerbi.com/v1.0/myorg/<WorkspaceName>;initial catalog=<ModelName>;access mode=readonly;integrated security=ClaimsToken;semanticmodelid=<ModelId>"
       }
     }
   }
   ```

3. **Validate schema** - Ensure JSON of `definition.pbir` is valid as per its schema

4. **Move `.Report` folder** to separate directory (away from original PBIP with model)

5. **Verify fields match** - Cross-reference report fields with target model fields

6. **Query model for field values** if needed for filters/slicers

7. **Test** - Open `definition.pbir` in Power BI Desktop or publish it to a Fabric / Power BI workspace with `pbir publish` or `fab import`


**Key notes:**

- **CRITICAL:** `connectionString` must have correct syntax with WorkspaceName, ModelName, and ModelId
- Validate fields exist in target model; fix table/field references if needed
- May need to query model to replace field values in selectors
- Target model must be published and refreshed before report can query it

## Converting Thin → Thick

Combine report with local semantic model in single PBIP project.

### Using pbir CLI (recommended)

```bash
pbir report merge-to-thick "Report.Report" "Model.SemanticModel"
```

Use the manual steps below only as a fallback when `pbir` is not installed.

### Manual steps (without pbir CLI)

1. **Download semantic model** to local directory using [download-model.py](../../scripts/download-model.py)

2. **Update `definition.pbir`** - Change `datasetReference` from `byConnection` to `byPath`:

   ```json
   {
     "datasetReference": {
       "byPath": {
         "path": "../ProjectName.SemanticModel"
       }
     }
   }
   ```

3. **Create PBIP structure** with both `.Report` and `.SemanticModel` folders:

```yaml
ProjectName/
├── ProjectName.pbip                    # Main project file (pointer to report)
├── .gitignore                          # Git exclusions (cache.abf, localSettings.json)
├── ProjectName.Report/
│   ├── .pbi/
│   │   └── localSettings.json         # Local settings (gitignored)
│   ├── .platform                      # Platform metadata
│   ├── definition.pbir                # Report definition and datasetReference
│   ├── mobileState.json               # Mobile layout state
│   ├── CustomVisuals/                 # Custom visual packages
│   ├── StaticResources/
│   │   └── RegisteredResources/       # Themes, custom visuals metadata
│   └── definition/                    # PBIR Enhanced Format
│       ├── version.json               # Format version
│       ├── report.json                # Report-level properties
│       ├── reportExtensions.json      # Extension measures
│       ├── bookmarks/
│       │   ├── bookmarks.json         # Bookmark index
│       │   └── [bookmarkName].bookmark.json
│       └── pages/
│           ├── pages.json             # Page index and order
│           └── [pageName]/
│               ├── page.json          # Page-level properties
│               └── visuals/
│                   └── [visualName]/
│                       ├── visual.json    # Visual definition
│                       └── mobile.json    # Mobile layout
└── ProjectName.SemanticModel/
    ├── .pbi/
    │   ├── localSettings.json         # Local settings (gitignored)
    │   ├── editorSettings.json        # Editor preferences
    │   ├── cache.abf                  # Data cache (gitignored)
    │   └── unappliedChanges.json      # Pending changes
    ├── .platform                      # Platform metadata
    ├── definition.pbism               # Semantic model definition
    ├── diagramLayout.json             # Model diagram layout
    ├── model.bim                      # TMSL format model definition
    └── definition/                    # TMDL format (alternative to model.bim)
        └── [TMDL files]               # Human-readable model definition
```

**Key Notes:**

- `path` in `definition.pbir` should be `"../ProjectName.SemanticModel"`
- `.gitignore` should exclude `*.pbi/localSettings.json`, `*.pbi/cache.abf`, `*.pbi/unappliedChanges.json`
- Semantic model uses either `model.bim` (TMSL) OR `definition/` folder (TMDL), not both; prefer TMDL

## Re-binding Reports

Change which semantic model a report connects to (without changing thick/thin status).

### Using pbir CLI (recommended)

```bash
pbir report rebind "Report.Report" "WorkspaceName.Workspace/ModelName.SemanticModel"
```

`--model-id` is optional — the CLI auto-retrieves it. Use the manual steps below only as a fallback when `pbir` is not installed.

### Manual steps (without pbir CLI)

1. **Update `datasetReference`** in `definition.pbir` to reference different model:
   - For thin reports: Update `connectionString` with new workspace/model/ID
   - For thick reports: Update `path` to point to different `.SemanticModel` folder

2. **Validate field compatibility:**
   - Check if all report fields exist in target model
   - Fields might be in different tables or have different names
   - May need to update table/field references in visuals

3. **Update field references** if needed:
   - Change Entity (table name) if fields moved to different table
   - Update Property (field name) if fields were renamed
   - See [Field References](field-references.md) for syntax

4. **Test** - Open report in Power BI Desktop to verify

## See Also

- [definition.pbir](../definition-pbir.md) - Connection types (byPath vs byConnection)
- [Finding Fields](finding-fields.md) - Validate fields exist in target model
- [Field References](field-references.md) - Update field references in visuals
