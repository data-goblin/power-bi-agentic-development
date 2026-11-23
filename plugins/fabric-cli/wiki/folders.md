---
title: Workspace folders with fab
summary: Create, list, move and delete workspace folders using the .Folder path type and the Fabric folders API; what fab ls shows and git ignores.
kind: gotcha
status: current
sources:
  - url: https://learn.microsoft.com/en-us/rest/api/fabric/core/folders
  - url: https://learn.microsoft.com/en-us/rest/api/fabric/core/items/move-item
tools:
  fab: 1.7.0
last_updated: 2026-11-23
last_verified: 2026-11-23
review_cadence_days: 90
skills: [fabric-cli/fabric-cli]
---

# Workspace folders with fab

Learn: [Folders REST API](https://learn.microsoft.com/en-us/rest/api/fabric/core/folders), [Move Item](https://learn.microsoft.com/en-us/rest/api/fabric/core/items/move-item).

## What fab 1.7.0 does (observed)

- `.Folder` is a path type: `fab get "ws.Workspace/ETL.Folder"` returns `id`, `displayName` and `workspaceId`, and `fab ls "ws.Workspace/ETL.Folder"` lists the items inside it.
- `fab ls "ws.Workspace"` lists every item flat, including items inside folders, and does not list the folders themselves. To list folders use the API:

```bash
WS_ID=$(fab get "ws.Workspace" -q id)
fab api "workspaces/$WS_ID/folders" -q "text.value[].{name:displayName, id:id, parent:parentFolderId}"
fab api "workspaces/$WS_ID/items" -q "text.value[].{name:displayName, folder:folderId}"
```

- Items without a `folderId` sit at the workspace root.
- `fab mkdir "ws.Workspace/ETL.Folder"` creates a folder and fails with `[AlreadyExists]` for a duplicate name. `fab mv` has `-r/--recursive` for workspaces and folders.
- `fab desc .x` prints the valid element types; `Folder` is in the 1.7.0 list.

## REST gotchas

- Create a subfolder with `parentFolderId` in the body. Move a folder with `POST workspaces/<ws>/folders/<id>/move` and `targetParentFolderId`; an empty body `{}` moves it to the root.
- Move an item with `POST workspaces/<ws>/items/<id>/move` and `targetFolderId`; an empty body moves it to the root. Child items (such as a Lakehouse SQL endpoint) move with the parent; a child cannot move alone (`CannotMoveChildOnly`). Contributor role or higher.
- Rename with `PATCH workspaces/<ws>/folders/<id>` and `displayName`.
- Delete only works on an empty folder; move or remove its items first.
- Git integration does not carry workspace folders; items may land at the root after a sync. Unverified against current Git integration docs.
- Folders are visible in the Fabric UI, via the API and via `.Folder` paths in fab.

## Example: move notebooks into a folder

```bash
ETL_ID=$(fab api -X post "workspaces/$WS_ID/folders" -i '{"displayName": "ETL"}' -q "text.id")
for ID in $(fab api "workspaces/$WS_ID/items?type=Notebook" -q "text.value[?starts_with(displayName, 'Extract')].id" | jq -r '.[]'); do
  fab api -X post "workspaces/$WS_ID/items/$ID/move" -i "{\"targetFolderId\": \"$ETL_ID\"}"
done
```

Unverified: this loop and the `fab mv`, `fab rm` and `fab set -q displayName` equivalents for folders were not run on fab 1.7.0; `fab rm` on an item is permanent unless tenant item recovery is on.
