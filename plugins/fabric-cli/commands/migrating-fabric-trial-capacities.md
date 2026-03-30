---
description: Migrate workspaces from trial capacity to production capacity
argument-hint: [target-capacity]
---

# Migrate Trial Capacity Workspaces

Migrate workspaces from Fabric trial capacity to a production capacity: $ARGUMENTS

## Step 1: Audit Trial Workspaces

```bash
# List all capacities
fab ls .capacities

# List workspaces on trial capacity
fab ls -l | grep "Trial-"

# Count trial workspaces
fab ls -l | grep "Trial-" | wc -l
```

## Step 2: Identify Target Capacity

```bash
# List available capacities
fab ls .capacities -l

# Get capacity details
fab get ".capacities/TargetCapacity.Capacity"
```

## Step 3: Migrate Single Workspace

```bash
# Assign workspace to new capacity
fab assign ".capacities/TargetCapacity.Capacity" -W "WorkspaceName.Workspace" -f
```

## Step 4: Bulk Migration

```bash
# Migrate all trial workspaces to target capacity
TARGET_CAPACITY="ProductionCapacity"

fab ls -l | grep "Trial-" | cut -d' ' -f1 | while read ws; do
  echo "Migrating: $ws"
  fab assign ".capacities/$TARGET_CAPACITY.Capacity" -W "$ws" -f
done
```

## Step 5: Verify Migration

```bash
# Check workspace capacity assignment
fab get "WorkspaceName.Workspace" -q "capacityId"

# Verify no workspaces remain on trial
fab ls -l | grep "Trial-" | wc -l
```

## Migration Script

```bash
#!/bin/bash
# migrate-trial-to-prod.sh

TARGET_CAPACITY="${1:-ProductionCapacity}"
LOG_FILE="migration_$(date +%Y%m%d_%H%M%S).log"

echo "=== Trial Capacity Migration ===" | tee "$LOG_FILE"
echo "Target: $TARGET_CAPACITY" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

# Get trial workspaces
TRIAL_WORKSPACES=$(fab ls -l | grep "Trial-" | cut -d' ' -f1)
COUNT=$(echo "$TRIAL_WORKSPACES" | wc -l | tr -d ' ')

echo "Found $COUNT workspaces on trial capacity" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

for ws in $TRIAL_WORKSPACES; do
  echo "Migrating: $ws" | tee -a "$LOG_FILE"
  if fab assign ".capacities/$TARGET_CAPACITY.Capacity" -W "$ws" -f 2>&1 | tee -a "$LOG_FILE"; then
    echo "  SUCCESS" | tee -a "$LOG_FILE"
  else
    echo "  FAILED" | tee -a "$LOG_FILE"
  fi
done

echo "" | tee -a "$LOG_FILE"
echo "=== Migration Complete ===" | tee -a "$LOG_FILE"
```

## Pre-Migration Checklist

- [ ] Verify target capacity has sufficient CUs
- [ ] Check target capacity region matches workspaces
- [ ] Ensure you have admin permissions on workspaces
- [ ] Back up critical items before migration
- [ ] Schedule during low-usage period

## Notes

- Capacity assignment is immediate but may briefly affect running jobs
- Cross-region migration is not supported
- Trial capacity expires after 60 days
- Some features may differ between trial and production capacities
