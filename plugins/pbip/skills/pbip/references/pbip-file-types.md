# PBIP File Types Reference

Structure and purpose of each entry-point and project-level file in a Power BI Project (PBIP).

> Verify against the current Microsoft docs for the latest schema versions:
> - [PBIP overview](https://learn.microsoft.com/en-us/power-bi/developer/projects/projects-overview)
> - [PBIP semantic model folder](https://learn.microsoft.com/en-us/power-bi/developer/projects/projects-dataset)
> - [PBIP report folder](https://learn.microsoft.com/en-us/power-bi/developer/projects/projects-report)


## .pbip (Project Entry Point)

The root file that references the report folder. One per project:

```json
{
  "version": "1.0",
  "artifacts": [
    {
      "report": {
        "path": "My Report.Report"
      }
    }
  ],
  "settings": {
    "enableAutoRecovery": true
  }
}
```

When forking a project, update the `path` to match the renamed `.Report/` folder.

This file is optional -- open `definition.pbir` directly to load the report without a `.pbip` wrapper.

Schema: [pbipProperties](https://github.com/microsoft/json-schemas/tree/main/fabric/pbip/pbipProperties)


## .platform (Item Metadata)

Found inside each `.Report/` and `.SemanticModel/` folder. Contains the item's display name, type, and a `logicalId` used by Fabric for identity:

```json
{
  "$schema": "https://developer.microsoft.com/json-schemas/fabric/gitIntegration/platformProperties/2.0.0/schema.json",
  "metadata": {
    "type": "SemanticModel",
    "displayName": "SpaceParts OTC Full"
  },
  "config": {
    "version": "2.0",
    "logicalId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
  }
}
```

**Critical rules:**
- `logicalId` is the unique identity of the item in Fabric. **Never change it** on an existing item -- this would break the connection to the deployed item.
- When **forking** (creating a copy), `logicalId` **must** be changed to a new GUID to avoid conflicts with the original item.
- `displayName` is what appears in the Fabric workspace. Update it when forking to distinguish the copy.
- `type` values: `SemanticModel`, `Report`


## definition.pbir (Report Entry Point)

Found inside the `.Report/` folder. References the semantic model the report is connected to.

### byPath (Local Reference)

```json
{
  "$schema": "https://developer.microsoft.com/json-schemas/fabric/item/report/definitionProperties/2.0.0/schema.json",
  "version": "4.0",
  "datasetReference": {
    "byPath": {
      "path": "../My Model.SemanticModel"
    }
  }
}
```

The `path` is relative to the `.Report/` folder. `../` navigates up to the project root.

### byConnection (Remote Model) — Current Form

For new reports connected to a remote semantic model, use the `connectionString`-only form. This is the current recommended format:

```json
{
  "$schema": "https://developer.microsoft.com/json-schemas/fabric/item/report/definitionProperties/2.0.0/schema.json",
  "version": "4.0",
  "datasetReference": {
    "byConnection": {
      "connectionString": "Data Source=powerbi://api.powerbi.com/v1.0/myorg/WorkspaceName;Initial Catalog=ModelName"
    }
  }
}
```

When deploying via Fabric REST API, use the `semanticmodelid` form:

```json
{
  "$schema": "https://developer.microsoft.com/json-schemas/fabric/item/report/definitionProperties/2.0.0/schema.json",
  "version": "4.0",
  "datasetReference": {
    "byConnection": {
      "connectionString": "semanticmodelid=[SemanticModelId]"
    }
  }
}
```

### byConnection Legacy Form

Older reports may use the verbose six-property form. Do not use this for new reports — prefer the `connectionString`-only form above:

```json
{
  "$schema": "https://developer.microsoft.com/json-schemas/fabric/item/report/definitionProperties/2.0.0/schema.json",
  "version": "4.0",
  "datasetReference": {
    "byConnection": {
      "connectionString": "Data Source=powerbi://api.powerbi.com/v1.0/myorg/WorkspaceName;Initial Catalog=ModelName",
      "pbiServiceModelId": null,
      "pbiModelVirtualServerName": "sobe_wowvirtualserver",
      "pbiModelDatabaseName": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "name": "EntityDataSource",
      "connectionType": "pbiServiceXmlaStyleLive"
    }
  }
}
```

### Multiple .pbir Files

Fabric Git Integration only processes `definition.pbir`; other `.pbir` files are ignored but can coexist (e.g. `definition-liveConnect.pbir` for forcing live connect mode).

### version Property

| Version | Supported formats |
|---------|-------------------|
| 1.0 | PBIR-Legacy only (report.json) |
| 4.0+ | PBIR-Legacy (report.json) OR PBIR (definition/ folder) |

Schema: [definitionProperties](https://github.com/microsoft/json-schemas/tree/main/fabric/item/report/definitionProperties)


## definition.pbism (Semantic Model Entry Point)

Found inside the `.SemanticModel/` folder:

```json
{
  "$schema": "https://developer.microsoft.com/json-schemas/fabric/item/semanticModel/definitionProperties/1.0.0/schema.json",
  "version": "4.2",
  "settings": {}
}
```

### version Property

| Version | Supported formats |
|---------|-------------------|
| 1.0 | TMSL only (model.bim) |
| 4.0+ | TMSL (model.bim) OR TMDL (definition/ folder) |

Schema: [definitionProperties](https://github.com/microsoft/json-schemas/tree/main/fabric/item/semanticModel/definitionProperties)


## .pbi/ Subfolder

Per-item subfolder containing local settings, caches, and editor state. Present in both `.Report/` and `.SemanticModel/` folders.

### localSettings.json

User/machine-specific settings, gitignored by default. Each user gets their own local state (e.g. last-opened page, query editor state). Present in both report and semantic model folders.

Schema: [localSettings](https://github.com/microsoft/json-schemas/tree/main/fabric/item/semanticModel/localSettings)

### editorSettings.json

Editor settings saved with the model definition, committed to Git. Shared across all users of the project.

Schema: [editorSettings](https://github.com/microsoft/json-schemas/tree/main/fabric/item/semanticModel/editorSettings)

### cache.abf

Analysis Services Backup file, local data cache, gitignored. PBI Desktop can open the project without it -- the model loads without data. If present, data is loaded and the model definition is overwritten from project files.

### unappliedChanges.json

Pending Power Query changes from the Transform Data editor. Committed to Git by default (can exclude).

**WARNING:** If this file exists and changes are applied, it overwrites queries in model metadata.

Schema: [unappliedChanges](https://github.com/microsoft/json-schemas/tree/main/fabric/item/semanticModel/unappliedChanges)

### daxQueries.json

DAX query view editor settings (tab order, default tab).

### tmdlscripts.json

TMDL view script tab settings.


## DAXQueries/ Folder

Contains `.dax` files, one per DAX query view tab, named `[Tab name].dax`. Exists in both `.SemanticModel/` and `.Report/` folders. DAX queries are saved when saving from PBI Desktop. Settings stored in `.pbi/daxQueries.json`.


## TMDLScripts/ Folder

Contains `.tmdl` files, one per TMDL view script tab, named `[Tab name].tmdl`. Only in `.SemanticModel/` folder. Settings stored in `.pbi/tmdlscripts.json`.


## model.bim (TMSL Legacy)

Present only when saving in TMSL format (mutually exclusive with `definition/` folder). Single large JSON file containing the complete model definition. TMDL is the recommended format for source control (better diffs, per-table files).


## .gitignore

Default content auto-generated by PBI Desktop:

```
**/.pbi/localSettings.json
**/.pbi/cache.abf
```

Auto-generated only if one does not already exist in the save folder or parent Git repo.


## Other Report Folder Files

Brief overview of remaining files in the `.Report/` and `.SemanticModel/` folders. For PBIR report definition details, see the `pbir-format` skill.

| File/Folder | Purpose | External Edit Support |
|-------------|---------|----------------------|
| `definition/` | PBIR report definition (pages, visuals, bookmarks) | Yes (JSON schema validated) |
| `report.json` | PBIR-Legacy report definition | No |
| `mobileState.json` | Mobile layout settings | No |
| `semanticModelDiagramLayout.json` | Diagram node positions (contains table names) | Limited (table renames only) |
| `CustomVisuals/` | Private custom visual metadata (org/AppSource visuals load automatically) | No |
| `StaticResources/RegisteredResources/` | Custom themes, images, .pbiviz files | Yes (for already-registered resources) |
| `diagramLayout.json` (in SM folder) | Semantic model diagram metadata | No |

**CustomVisuals/ details:** Contains metadata for private custom visuals (`.pbiviz` packages loaded by the user). Organizational store and AppSource visuals are NOT stored here -- they load automatically. Each custom visual gets a subfolder named with its GUID (e.g., `PBI_CV_a1b2c3d4-...`).
