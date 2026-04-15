# Workspace Folders

Manage folders in Fabric workspaces using the REST API via `fab api`.

## Overview

Folders organize workspace items into logical groups. The Folder REST API is in **preview** and requires using `fab api` for direct REST calls.

**Limitations:**

- Git doesn't support workspace folders
- `fab ls` doesn't display folder structure
- Folders are visible only in Fabric UI and via API

## List Folders

```bash
WS_ID=$(fab get "MyWorkspace.Workspace" -q "id")

# List all folders
fab api -X get "workspaces/$WS_ID/folders"

# Get folder names and IDs
fab api -X get "workspaces/$WS_ID/folders" | jq '.text.value[] | {displayName, id}'
```

## Create Folder

```bash
WS_ID=$(fab get "MyWorkspace.Workspace" -q "id")

# Native alternative (no IDs needed):
# fab mkdir "MyWorkspace.Workspace/ETL.Folder"

# Create folder at workspace root
fab api -X post "workspaces/$WS_ID/folders" -i '{"displayName": "ETL"}'

# Create nested folder (subfolder)
PARENT_ID="<parent-folder-id>"
fab api -X post "workspaces/$WS_ID/folders" -i "{\"displayName\": \"Bronze\", \"parentFolderId\": \"$PARENT_ID\"}"
```

**Response:**

```json
{
  "status_code": 201,
  "text": {
    "id": "c92e1cfb-2983-49d6-8cb1-40875f18f396",
    "displayName": "ETL",
    "workspaceId": "6f356f2f-8428-4249-a6a7-f6ee438717d4"
  }
}
```

## Move Items to Folder

```bash
WS_ID=$(fab get "MyWorkspace.Workspace" -q "id")
ITEM_ID="<item-id>"
FOLDER_ID="<target-folder-id>"

# Native alternative (if supported for this item type):
# fab mv "MyWorkspace.Workspace/Item.Type" "MyWorkspace.Workspace/FolderName.Folder/Item.Type"

# Move item to folder
fab api -X post "workspaces/$WS_ID/items/$ITEM_ID/move" -i "{\"targetFolderId\": \"$FOLDER_ID\"}"

# Move item to workspace root (out of folder)
fab api -X post "workspaces/$WS_ID/items/$ITEM_ID/move" -i '{}'
```

## Check Item Folder Assignment

```bash
WS_ID=$(fab get "MyWorkspace.Workspace" -q "id")

# Native alternative:
# fab ls "MyWorkspace.Workspace" -q "[?contains(name, '.Notebook')]"

# List items with folder IDs
fab api -X get "workspaces/$WS_ID/items?type=Notebook" | jq '.text.value[] | {displayName, folderId}'

# Items without folderId are at workspace root
```

## Delete Folder

To delete items before removing a folder, use `fab rm "Workspace/Item.Notebook"` rather than the API. Recovery of removed items depends on the tenant Item Recovery setting; see [reference.md > Recovering deleted items](reference.md#recovering-deleted-items).

```bash
WS_ID=$(fab get "MyWorkspace.Workspace" -q "id")
FOLDER_ID="<folder-id>"

# Native alternative:
# fab rm "MyWorkspace.Workspace/FolderName.Folder" -f

# Delete empty folder
fab api -X delete "workspaces/$WS_ID/folders/$FOLDER_ID"
```

**Note:** Move all items out of a folder before deleting it.

## Move Folder

```bash
WS_ID=$(fab get "MyWorkspace.Workspace" -q "id")
FOLDER_ID="<folder-id>"
TARGET_PARENT="<target-parent-folder-id>"

# Move folder under another folder
fab api -X post "workspaces/$WS_ID/folders/$FOLDER_ID/move" -i "{\"targetParentFolderId\": \"$TARGET_PARENT\"}"

# Move folder to workspace root
fab api -X post "workspaces/$WS_ID/folders/$FOLDER_ID/move" -i '{}'
```

## Rename Folder

```bash
WS_ID=$(fab get "MyWorkspace.Workspace" -q "id")
FOLDER_ID="<folder-id>"

# Native alternative:
# fab set "MyWorkspace.Workspace/FolderName.Folder" -q displayName -i "NewName"

fab api -X patch "workspaces/$WS_ID/folders/$FOLDER_ID" -i '{"displayName": "NewName"}'
```

## Complete Example: Organize Notebooks

```bash
#!/bin/bash

WS_ID=$(fab get "data-goblins-blog.Workspace" -q "id")

# Create folders
ETL_ID=$(fab api -X post "workspaces/$WS_ID/folders" -i '{"displayName": "ETL"}' | jq -r '.text.id')
UTILS_ID=$(fab api -X post "workspaces/$WS_ID/folders" -i '{"displayName": "Utils"}' | jq -r '.text.id')

# Get notebook IDs
NOTEBOOKS=$(fab api -X get "workspaces/$WS_ID/items?type=Notebook" | jq -r '.text.value[] | "\(.displayName)|\(.id)"')

# Move notebooks to folders
while IFS='|' read -r NAME ID; do
  case "$NAME" in
    Extract*|Transform*)
      fab api -X post "workspaces/$WS_ID/items/$ID/move" -i "{\"targetFolderId\": \"$ETL_ID\"}"
      echo "Moved $NAME to ETL"
      ;;
    Cleanup*|Maintenance*)
      fab api -X post "workspaces/$WS_ID/items/$ID/move" -i "{\"targetFolderId\": \"$UTILS_ID\"}"
      echo "Moved $NAME to Utils"
      ;;
  esac
done <<< "$NOTEBOOKS"
```

## Best Practices

### When to use folders

Folders help when a workspace has enough items that scrolling becomes painful; typically 15+ items. Small workspaces with a handful of reports and a model rarely benefit.

### Recommended structures

**By function** (most common; works well for analytics workspaces):

```
ETL/
  Extract - CRM.Notebook
  Transform - Sales.Notebook
  Load - Warehouse.DataPipeline
Semantic Models/
  Sales.SemanticModel
  Finance.SemanticModel
Reports/
  Sales Dashboard.Report
  Finance Overview.Report
Staging/
  Raw Landing.Lakehouse
```

**By domain** (for large shared workspaces with multiple teams):

```
Sales/
  Sales Model.SemanticModel
  Sales Dashboard.Report
  Sales ETL.Notebook
Finance/
  Finance Model.SemanticModel
  Finance Overview.Report
Shared/
  Common Lakehouse.Lakehouse
```

### Guidelines

- Keep depth shallow; one level is usually enough, two at most
- Use consistent, readable folder names (plain English, not abbreviations)
- Place shared or cross-cutting items at the workspace root
- Remember that Git integration ignores folders; items appear flat after sync
- `fab ls` does not show folder structure; verify organization via API or the Fabric UI
- To rename a folder, use `fab set` or `PATCH` the folder; no need to delete and recreate

### Organizing an existing workspace

1. List current items: `fab api -X get "workspaces/$WS_ID/items" | jq '.text.value[] | {displayName, type, id}'`
2. Create folders for each logical group
3. Move items into folders using the move endpoint
4. Verify with `fab api -X get "workspaces/$WS_ID/folders"` and check items via the Fabric UI

## API Reference

| Operation | Method | Endpoint |
|-----------|--------|----------|
| List folders | GET | `workspaces/{wsId}/folders` |
| Create folder | POST | `workspaces/{wsId}/folders` |
| Get folder | GET | `workspaces/{wsId}/folders/{folderId}` |
| Update folder | PATCH | `workspaces/{wsId}/folders/{folderId}` |
| Delete folder | DELETE | `workspaces/{wsId}/folders/{folderId}` |
| Move folder | POST | `workspaces/{wsId}/folders/{folderId}/move` |
| Move item | POST | `workspaces/{wsId}/items/{itemId}/move` |

## Troubleshooting

### Folder Not Showing in CLI

The `fab ls` command doesn't display folder structure. Use the API to verify:

```bash
fab api -X get "workspaces/$WS_ID/folders"
```

### Can't Delete Folder

Ensure the folder is empty first. Check for items:

```bash
fab api -X get "workspaces/$WS_ID/items" | jq ".text.value[] | select(.folderId == \"$FOLDER_ID\")"
```

### Git Sync Issues

Folders aren't supported in Git integration. Items may appear at workspace root after Git sync.
