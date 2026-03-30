# Creating Workspaces

## Create Workspace with Large Storage Format

**Step 1:** List available capacities

```bash
fab ls .capacities
```

**Step 2:** Create workspace on chosen capacity

```bash
fab mkdir "Workspace Name.Workspace" -P capacityName="MyCapacity"
```

**Step 3:** Get workspace ID

```bash
fab get "Workspace Name.Workspace" -q "id"
```

**Step 4:** Set default storage format to Large

```bash
fab api -A powerbi -X patch "groups/<workspace-id>" -i '{"defaultDatasetStorageFormat":"Large"}'
```

Done. The workspace now defaults to Large storage format for all new semantic models.
