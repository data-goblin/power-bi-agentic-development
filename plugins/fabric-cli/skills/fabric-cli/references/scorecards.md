# Scorecards and Goals

> **Preview API** -- All Scorecards, Goals, GoalValues, GoalNotes, and GoalStatusRules endpoints are in Preview and may change without notice.

## Overview

Scorecards track KPIs and business objectives in Power BI. Each scorecard lives in a workspace and has an associated semantic model and internal report. Goals are items within a scorecard -- either manual (updated via check-ins) or connected to report data (updated on refresh).

All scorecard operations go through the Power BI REST API audience (`-A powerbi`). The base path is `groups/<ws-id>/scorecards`.

### Licensing

- Authoring, sharing, and checking in require a Power BI Pro license.
- Viewing requires Premium/Fabric F64+ capacity (Free user) or a Pro license.
- Samples and My Workspace content are available to Free users.

### Required Scopes

- Read operations: `Dataset.Read.All`
- Write operations: `Dataset.ReadWrite.All`

---

## Scorecard CRUD

### List Scorecards

```bash
fab api -A powerbi "groups/<ws-id>/scorecards"
```

### Get Scorecard by ID

```bash
fab api -A powerbi "groups/<ws-id>/scorecards(<scorecard-id>)"
```

### Get Scorecard by Report ID

```bash
fab api -A powerbi "groups/<ws-id>/scorecards/GetScorecardByReportId(reportId=<report-id>)"
```

### Create Scorecard

```bash
fab api -A powerbi -X post "groups/<ws-id>/scorecards" -i '{
  "name": "Q1 KPIs",
  "description": "Quarterly performance scorecard"
}'
```

The `name` field is required. Optional fields: `description`, `sensitivityLabelId` (use `00000000-0000-0000-0000-000000000000` for no label).

### Update Scorecard

```bash
fab api -A powerbi -X patch "groups/<ws-id>/scorecards(<scorecard-id>)" -i '{
  "name": "Q1 KPIs (Revised)",
  "description": "Updated quarterly scorecard"
}'
```

### Delete Scorecard

```bash
fab api -A powerbi -X delete "groups/<ws-id>/scorecards(<scorecard-id>)"
```

### Scorecard Properties

| Property | Type | Description |
|----------|------|-------------|
| id | uuid | Scorecard identifier |
| name | string | Display name |
| description | string | Description |
| groupId | uuid | Workspace ID |
| datasetId | uuid | Associated semantic model ID |
| reportId | uuid | Internal report ID |
| goals | Goal[] | Array of goals |
| permissions | enum | None, Read, Write, ReadWrite |
| provisioningStatus | enum | Completed, Deleted, Deprovisioning, Failed, Initialized |
| createdTime | datetime | UTC creation timestamp |
| lastModifiedTime | datetime | UTC last modification timestamp |

Column IDs for `columnSettings`: 0=Name, 1=Owner, 2=Status, 3=Value, 4=Progress, 5=DueDate, 6=Notes.

---

## Goal CRUD

Goals live inside a scorecard. The base path is `groups/<ws-id>/scorecards(<scorecard-id>)/goals`.

### List Goals

```bash
fab api -A powerbi "groups/<ws-id>/scorecards(<scorecard-id>)/goals"
```

### Get Goal by ID

```bash
fab api -A powerbi "groups/<ws-id>/scorecards(<scorecard-id>)/goals(<goal-id>)"
```

### Create Goal

```bash
fab api -A powerbi -X post "groups/<ws-id>/scorecards(<scorecard-id>)/goals" -i '{
  "name": "Revenue Target",
  "startDate": "2026-01-01T00:00:00Z",
  "completionDate": "2026-03-31T00:00:00Z"
}'
```

The `name` field is required. Optional fields:

| Field | Type | Description |
|-------|------|-------------|
| startDate | datetime | UTC, time portion must be zero |
| completionDate | datetime | UTC due date, time portion must be zero |
| parentId | string | Parent goal ID for creating subgoals (max 4 levels deep) |
| valuesFormatString | string | Custom format string for values |
| datesFormatString | string | Custom format string for dates |

### Update Goal

```bash
fab api -A powerbi -X patch "groups/<ws-id>/scorecards(<scorecard-id>)/goals(<goal-id>)" -i '{
  "name": "Revenue Target (Updated)",
  "completionDate": "2026-06-30T00:00:00Z"
}'
```

### Delete Goal

```bash
fab api -A powerbi -X delete "groups/<ws-id>/scorecards(<scorecard-id>)/goals(<goal-id>)"
```

### Move Goals

Reorder or reparent goals within a scorecard:

```bash
fab api -A powerbi -X post "groups/<ws-id>/scorecards(<scorecard-id>)/MoveGoals" -i '{
  "goalRankChanges": [
    { "goalId": "<goal-id>", "rank": 1, "parentId": "<parent-goal-id>" }
  ]
}'
```

### Goal Properties

| Property | Type | Description |
|----------|------|-------------|
| id | uuid | Goal identifier |
| scorecardId | uuid | Parent scorecard ID |
| name | string | Display name |
| startDate | datetime | Start date (UTC) |
| completionDate | datetime | Due date (UTC) |
| parentId | uuid | Parent goal ID (subgoals) |
| level | int32 | Nesting depth in hierarchy |
| rank | int64 | Position among siblings |
| hasStatusRules | boolean | Whether status rules are defined |
| goalValues | GoalValue[] | Check-in values |
| notesCount | int32 | Number of attached notes |
| valuesFormatString | string | Custom value format |
| permissions | bitmask | See permissions table below |

### Goal Permissions (Bitmask)

| Value | Meaning |
|-------|---------|
| None | No access |
| View | View only |
| UpdateCurrentValue | Can update current value |
| UpdateTargetValue | Can update target value |
| UpdateNotes | Can update notes |
| UpdateStatus | Can update status |
| UpdateValues | Can update current + target |
| All | Full update access (values, notes, status) |

---

## Connected Goals

Connected goals link current value and/or target value to data in an existing Power BI report visual. Values update when the underlying semantic model refreshes.

Connection is configured through the Power BI service UI ("Connect to data" flow), not directly via the REST API. The API provides endpoints to trigger refresh and manage connections.

### Refresh Connected Values

Trigger a refresh of the connected current value:

```bash
fab api -A powerbi -X post "groups/<ws-id>/scorecards(<scorecard-id>)/goals(<goal-id>)/RefreshGoalCurrentValue"
```

Trigger a refresh of the connected target value:

```bash
fab api -A powerbi -X post "groups/<ws-id>/scorecards(<scorecard-id>)/goals(<goal-id>)/RefreshGoalTargetValue"
```

### Get Refresh History

```bash
fab api -A powerbi "groups/<ws-id>/scorecards(<scorecard-id>)/goals(<goal-id>)/GetRefreshHistory"
```

### Disconnect Values

Remove the current value connection:

```bash
fab api -A powerbi -X delete "groups/<ws-id>/scorecards(<scorecard-id>)/goals(<goal-id>)/DeleteGoalCurrentValueConnection"
```

Remove the target value connection:

```bash
fab api -A powerbi -X delete "groups/<ws-id>/scorecards(<scorecard-id>)/goals(<goal-id>)/DeleteGoalTargetValueConnection"
```

---

## Check-in Values (GoalValues)

Check-ins record point-in-time snapshots of a goal's progress. Each check-in is keyed by a UTC timestamp (time portion must be zero). The base path is `groups/<ws-id>/scorecards(<scorecard-id>)/goals(<goal-id>)/goalValues`.

### List Check-ins

```bash
fab api -A powerbi "groups/<ws-id>/scorecards(<scorecard-id>)/goals(<goal-id>)/goalValues"
```

Expand notes inline:

```bash
fab api -A powerbi "groups/<ws-id>/scorecards(<scorecard-id>)/goals(<goal-id>)/goalValues?\$expand=notes"
```

### Get Check-in by Timestamp

```bash
fab api -A powerbi "groups/<ws-id>/scorecards(<scorecard-id>)/goals(<goal-id>)/goalValues(<timestamp>)"
```

The timestamp must be in UTC with zeroed time, e.g. `2026-03-28T00:00:00Z`.

### Create Check-in

```bash
fab api -A powerbi -X post "groups/<ws-id>/scorecards(<scorecard-id>)/goals(<goal-id>)/goalValues" -i '{
  "timestamp": "2026-03-28T00:00:00Z",
  "value": 85.0,
  "target": 100.0,
  "status": 1
}'
```

### Update Check-in

```bash
fab api -A powerbi -X patch "groups/<ws-id>/scorecards(<scorecard-id>)/goals(<goal-id>)/goalValues(2026-03-28T00:00:00Z)" -i '{
  "value": 90.0,
  "status": 1
}'
```

### Delete Check-in

```bash
fab api -A powerbi -X delete "groups/<ws-id>/scorecards(<scorecard-id>)/goals(<goal-id>)/goalValues(2026-03-28T00:00:00Z)"
```

### GoalValue Properties

| Property | Type | Description |
|----------|------|-------------|
| timestamp | datetime | UTC date of check-in (time=zero) |
| goalId | uuid | Goal identifier |
| value | double | Current value |
| target | double | Target value |
| status | int32 | Status ID (see table) |
| trend | int32 | Value trend indicator |
| forecast | double | Trend forecast |
| notes | GoalNote[] | Attached notes (expandable) |
| valueDisplayString | string | Formatted current value |
| targetDisplayString | string | Formatted target value |

### Status IDs

| ID | Meaning |
|----|---------|
| 0 | Not started |
| 1 | On track |
| 2 | At risk |
| 3 | Behind |
| 4 | Overdue |
| 5 | Completed |

---

## Notes on Check-ins (GoalNotes)

Notes attach commentary to individual check-ins. The base path is `groups/<ws-id>/scorecards(<scorecard-id>)/goals(<goal-id>)/goalValues(<timestamp>)/notes`.

### Add Note

```bash
fab api -A powerbi -X post \
  "groups/<ws-id>/scorecards(<scorecard-id>)/goals(<goal-id>)/goalValues(2026-03-28T00:00:00Z)/notes" \
  -i '{ "body": "Pipeline throughput improved after infra changes." }'
```

### Update Note

```bash
fab api -A powerbi -X patch \
  "groups/<ws-id>/scorecards(<scorecard-id>)/goals(<goal-id>)/goalValues(2026-03-28T00:00:00Z)/notes(<note-id>)" \
  -i '{ "body": "Revised: throughput gain confirmed at 12%." }'
```

### Delete Note

```bash
fab api -A powerbi -X delete \
  "groups/<ws-id>/scorecards(<scorecard-id>)/goals(<goal-id>)/goalValues(2026-03-28T00:00:00Z)/notes(<note-id>)"
```

### GoalNote Properties

| Property | Type | Description |
|----------|------|-------------|
| id | uuid | Note identifier |
| body | string | Note text |
| content | string | Rich content (JSON with paragraphs/textRuns) |
| goalId | uuid | Goal identifier |
| valueTimestamp | datetime | Parent check-in timestamp |

---

## Status Rules

Status rules automate the status field on a goal based on conditions. Rules evaluate in priority order; the first matching rule sets the status. When no rule matches, the `defaultOutput` status applies.

For connected goals, status rules re-evaluate on scorecard data refresh. For manual goals, rules re-evaluate on check-in.

### Get Status Rules

```bash
fab api -A powerbi "groups/<ws-id>/scorecards(<scorecard-id>)/goals(<goal-id>)/statusRules"
```

### Create or Update Status Rules

```bash
fab api -A powerbi -X post "groups/<ws-id>/scorecards(<scorecard-id>)/goals(<goal-id>)/statusRules" -i '{
  "defaultOutput": 2,
  "rules": [
    {
      "output": 1,
      "conditions": [
        {
          "fieldComparison": {
            "field": "Value",
            "operator": "GreaterThanOrEqual",
            "value": {
              "percentOf": { "field": "Target", "percent": 90.0 }
            }
          }
        }
      ]
    },
    {
      "output": 3,
      "conditions": [
        {
          "fieldComparison": {
            "field": "Value",
            "operator": "LessThan",
            "value": {
              "percentOf": { "field": "Target", "percent": 50.0 }
            }
          }
        }
      ]
    }
  ]
}'
```

This example sets status to "On track" (1) when value >= 90% of target, "Behind" (3) when value < 50% of target, and "At risk" (2) as the default.

### Delete Status Rules

```bash
fab api -A powerbi -X delete "groups/<ws-id>/scorecards(<scorecard-id>)/goals(<goal-id>)/statusRules"
```

### Rule Schema

Rules use `fieldComparison` conditions with AND logic within a single rule. Multiple rules are evaluated in array order (first match wins).

**Comparison fields:** `Value`, `Timestamp`, `Change`

**Operators:** `Equal`, `GreaterThan`, `GreaterThanOrEqual`, `LessThan`, `LessThanOrEqual`

**Value types:**

- Absolute number: `{ "number": 90.0 }`
- Percentage of a field: `{ "percentOf": { "field": "Target", "percent": 90.0 } }`
- Date threshold: `{ "dateTime": "2026-03-31T00:00:00Z" }`
- Field reference: `{ "field": "Target" }`

---

## Common Workflows

### Create a Scorecard with Goals

1. Obtain the workspace ID:

```bash
WS_ID=$(fab get "ws.Workspace" -q "id" | tr -d '"')
```

2. Create the scorecard:

```bash
SC=$(fab api -A powerbi -X post "groups/$WS_ID/scorecards" -i '{
  "name": "Q1 2026 KPIs"
}')
SC_ID=$(echo "$SC" | jq -r '.id')
```

3. Create a parent goal:

```bash
GOAL=$(fab api -A powerbi -X post "groups/$WS_ID/scorecards($SC_ID)/goals" -i '{
  "name": "Revenue",
  "startDate": "2026-01-01T00:00:00Z",
  "completionDate": "2026-03-31T00:00:00Z"
}')
GOAL_ID=$(echo "$GOAL" | jq -r '.id')
```

4. Create a subgoal:

```bash
fab api -A powerbi -X post "groups/$WS_ID/scorecards($SC_ID)/goals" -i "{
  \"name\": \"EMEA Revenue\",
  \"parentId\": \"$GOAL_ID\",
  \"startDate\": \"2026-01-01T00:00:00Z\",
  \"completionDate\": \"2026-03-31T00:00:00Z\"
}"
```

### Manual Check-in

1. Post a check-in with current value, target, and status:

```bash
fab api -A powerbi -X post "groups/$WS_ID/scorecards($SC_ID)/goals($GOAL_ID)/goalValues" -i '{
  "timestamp": "2026-03-28T00:00:00Z",
  "value": 74000,
  "target": 100000,
  "status": 2
}'
```

2. Attach a note explaining the status:

```bash
fab api -A powerbi -X post \
  "groups/$WS_ID/scorecards($SC_ID)/goals($GOAL_ID)/goalValues(2026-03-28T00:00:00Z)/notes" \
  -i '{ "body": "EMEA pipeline delayed; expecting recovery in April." }'
```

### Connected Goal Setup

Connected goals link to data in an existing report visual. The connection itself must be configured through the Power BI service UI. Once connected, use the API to manage refresh:

1. Trigger refresh of current and target values:

```bash
fab api -A powerbi -X post "groups/$WS_ID/scorecards($SC_ID)/goals($GOAL_ID)/RefreshGoalCurrentValue"
fab api -A powerbi -X post "groups/$WS_ID/scorecards($SC_ID)/goals($GOAL_ID)/RefreshGoalTargetValue"
```

2. Check refresh history to confirm success:

```bash
fab api -A powerbi "groups/$WS_ID/scorecards($SC_ID)/goals($GOAL_ID)/GetRefreshHistory"
```

3. To revert a connected goal to manual, disconnect it:

```bash
fab api -A powerbi -X delete "groups/$WS_ID/scorecards($SC_ID)/goals($GOAL_ID)/DeleteGoalCurrentValueConnection"
fab api -A powerbi -X delete "groups/$WS_ID/scorecards($SC_ID)/goals($GOAL_ID)/DeleteGoalTargetValueConnection"
```

---

## Limitations

- No BYOK (Bring Your Own Key) support.
- No row-level security (RLS) support.
- Maximum 4 subgoal nesting levels.
- No publish-to-web or SharePoint embed for scorecard visuals.
- No B2B cross-tenant sharing.
- No Multi-Geo or embedded analytics support.
- Push semantic models do not auto-update goals.
