---
name: fabric-capacity
description: "Read Fabric capacity utilization and per-item CU from the Capacity Metrics app model, repair that app, and start or pause a capacity. Use when a capacity is busy, throttled or at 90 or 100 percent, when asked what consumes CUs, for current utilization or carry forward, or to query or fix the Metrics app model."
---

# Fabric Capacity

Read capacity utilization and per-item CU from the Microsoft Fabric Capacity Metrics semantic model with `fab`, and start or pause a capacity. Needs the `fabric-cli` plugin; its `references/capacity-cost.md` covers budget math, smoothing and throttling. Learn: https://learn.microsoft.com/en-us/fabric/enterprise/metrics-app

## Where the numbers live

```yaml
live (DirectQuery, CapacityMetricsCES connector):
  CU Detail:                 per 30 s timepoint; Interactive, Background, CU limit, SKU
  Timepoint CU Detail:       same, per timepoint detail page
  Metrics By Item [And Day|And Hour|And Operation]: CU (s), Duration (s), Operations, Users per item
  System Events:             pause, resume, state changes
import (fresh only after a model refresh; a Pro workspace allows 8 scheduled refreshes a day, Unverified for this workspace):
  Capacities, Items, Workspaces, Timepoints/Dates calendars
  Average utilization (last 1 hour | last 24 hours | last 7 days): measures on the Health page
not available:               Azure Monitor metrics for Microsoft.Fabric/capacities (Unverified; not found in the Azure Monitor supported-metrics index)
```

Anything that must be current (a status bar, "what is using the capacity now") needs the DirectQuery tables.

## Query with fab

The model sits in a Pro workspace, so there is no XMLA endpoint and `te` cannot connect. Use `executeQueries` through fab. DirectQuery tables need the capacity passed as an M parameter inside a `DEFINE` block; without it the connector fails, and the error reads like a credential problem.

```bash
cat > "$TMPDIR/cu.dax" <<'EOF'
DEFINE
  MPARAMETER 'CapacitiesList' = {"<CAPACITY-ID-UPPERCASE>"}
  VAR point = MINX(TOPN(2, 'CU Detail', 'CU Detail'[Window start time], DESC), 'CU Detail'[Window start time])
EVALUATE
ROW("pct", CALCULATE(
  DIVIDE(SUM('CU Detail'[Interactive]) + SUM('CU Detail'[Background]), MAX('CU Detail'[Base capacity units]) * 30),
  'CU Detail'[Window start time] = point) * 100)
EOF
BODY=$(jq -cn --rawfile q "$TMPDIR/cu.dax" '{queries: [{query: $q}]}')
fab api -A powerbi "groups/<metrics-ws-id>/datasets/<metrics-model-id>/executeQueries" -X post -i "$BODY"
```

- `CU Detail` values are CU-seconds per 30 s timepoint, already smoothed; utilization % = (Interactive + Background) / (Base capacity units * 30). `CU limit` is a ratio (1.0), not a denominator
- The newest timepoint can hold a whole background operation charged at its start (thousands of percent); read the one before it
- Capacity IDs: `fab api -A powerbi capacities`
- Per item for a day: `SUMMARIZECOLUMNS(Items[Workspace name], Items[Item kind], Items[Item name], TREATAS({DATE(y,m,d)}, 'Metrics By Item And Day'[Date]), "CUs", SUM('Metrics By Item And Day'[CU (s)]))`
- Schema: `INFO.VIEW.TABLES()`, `INFO.VIEW.COLUMNS()`, `INFO.VIEW.MEASURES()` work over `executeQueries`; `INFO.TABLES()` and measure expressions do not
- fab paths break on names containing `/`; use IDs with `fab api`

## Start and pause

```bash
fab get ".capacities/<name>.Capacity" -q properties.state   # Active | Paused
fab start ".capacities/<name>.Capacity" -f
fab stop  ".capacities/<name>.Capacity" -f                  # bills the carry forward at once
```

`fab get` output ends in `\r`; strip it before comparing.

## Keeping the metrics app alive

Seen on one tenant; install steps: https://learn.microsoft.com/en-us/fabric/enterprise/metrics-app-install

- The data source OAuth token expires after 90 days without use (`AADSTS700082`); refresh stops silently. Re-enter the credential, then refresh
- Saving the credential with "Skip test connection" ticked refreshes fine but fails every DirectQuery with `The credentials provided for the CapacityMetricsCES source are invalid` (`QueryUserError`). Save again with the box unticked; open the settings page with `?alwaysPromptForContentProviderCreds=true` to force a fresh OAuth prompt and choose the capacity admin account
- If it still fails after several credential re-entries, delete the app workspace and install the app fresh (`UTC_offset` in standard time, OAuth2); a fresh install has new workspace and model IDs
- Updating an old app version (47 from 2024 could not serve DirectQuery) keeps the IDs but appends a date to the workspace name; rename it back, since fab and te paths break on `/`
- The credential account must be a capacity admin of every capacity queried. Keep the workspace on shared capacity; moving it to PPU for XMLA did not help

## Cost hazards

Planning sessions and SQL databases of app backends can fill a small F SKU on their own; numbers and sources: `fabric-cli` `capacity-cost.md`.
