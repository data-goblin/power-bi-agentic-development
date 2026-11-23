---
description: Move workspaces from a Fabric trial capacity to another capacity (dry run first, assigns only after approval)
argument-hint: "<target-capacity-name>"
disable-model-invocation: true
allowed-tools: Bash(fab ls:*), Bash(fab get:*), Bash(fab exists:*), Bash(fab assign:*)
---

Move the workspaces on the trial capacity to the capacity named in `$ARGUMENTS`. If no target was given, list `fab ls .capacities -l` and ask which one.

`fab assign` changes a live workspace and has no dry-run flag; the dry run below is a printed plan. Never run the assign step before the user has seen the plan and said go.

## 1. Plan (read only)

Select by capacity, never by splitting `fab ls -l` text: workspace names contain spaces (`AI Testing Workspace`), and `-q` prints one whole name per line.

```bash
TARGET="$ARGUMENTS"
fab ls .capacities -l --output_format json -q "[?name=='$TARGET.Capacity'].{sku:sku,region:region,state:state}"
fab ls .capacities -q "[?starts_with(name, 'Trial')].name"
fab ls -l -q "[?starts_with(capacityName, 'Trial')].{name:name,region:capacityRegion}"
```

Show the user a list of `workspace -> target (SKU, region, state)` and stop on any of these:

- the target is not found, is paused (`Inactive`) or is an F SKU that is already throttled (see the `fabric-cli` skill, capacity cost)
- a workspace region differs from the target region: Learn says a workspace holding Fabric items cannot move across regions without deleting them
- the trial has expired or expires soon: after expiry, non-Power BI Fabric items are kept for 7 days only (https://learn.microsoft.com/en-us/fabric/fundamentals/fabric-trial)

Moving workspaces adds their background jobs and schedules to the target's CU budget; estimate that before approval.

## 2. Assign (only after approval)

```bash
TARGET="$ARGUMENTS"
fab ls -l -q "[?starts_with(capacityName, 'Trial')].name" | while IFS= read -r ws; do
  echo "Assigning: $ws"
  fab assign ".capacities/$TARGET.Capacity" -W "$ws" -f || echo "FAILED: $ws"
done
```

## 3. Verify

```bash
fab ls -l -q "[?capacityName=='$ARGUMENTS'].name"
fab ls -l -q "[?starts_with(capacityName, 'Trial')].name"
```

The second list must be empty. Report any workspace that failed or stayed on the trial capacity.
