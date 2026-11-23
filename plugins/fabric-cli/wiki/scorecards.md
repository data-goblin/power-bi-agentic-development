---
title: Scorecards and goals REST API gotchas
summary: "Preview scorecard and goal endpoints via fab api -A powerbi: path syntax, midnight UTC timestamps, status ids, status rules and limits."
kind: gotcha
status: current
sources:
  - url: https://learn.microsoft.com/en-us/rest/api/power-bi/scorecards%28preview%29
  - url: https://learn.microsoft.com/en-us/rest/api/power-bi/goals%28preview%29/post
  - url: https://learn.microsoft.com/en-us/rest/api/power-bi/goals-status-rules%28preview%29/post
  - url: https://learn.microsoft.com/en-us/power-bi/create-reports/service-goals-introduction
tools:
  fab: 1.9.0
last_updated: 2026-11-23
last_verified: 2026-11-23
review_cadence_days: 90
skills: [fabric-cli/fabric-cli]
---

# Scorecards and goals REST API gotchas

Learn: [Scorecards (Preview)](https://learn.microsoft.com/en-us/rest/api/power-bi/scorecards%28preview%29), [Goals (Preview)](https://learn.microsoft.com/en-us/rest/api/power-bi/goals%28preview%29/post), [GoalValues (Preview)](https://learn.microsoft.com/en-us/rest/api/power-bi/goal-values%28preview%29/post), [GoalsStatusRules (Preview)](https://learn.microsoft.com/en-us/rest/api/power-bi/goals-status-rules%28preview%29/get), [Goals introduction and limits](https://learn.microsoft.com/en-us/power-bi/create-reports/service-goals-introduction).

fab has no scorecard command. All endpoints are preview and use the Power BI audience (`-A powerbi`); scopes are `Dataset.Read.All` for reads and `Dataset.ReadWrite.All` for writes. Authoring and check-ins need a Pro license.

## Path syntax

OData key syntax with parentheses, not slashes:

```yaml
scorecard: groups/<ws-id>/scorecards(<scorecard-id>)
goal: groups/<ws-id>/scorecards(<scorecard-id>)/goals(<goal-id>)
check-in: .../goals(<goal-id>)/goalValues(2026-03-28T00:00:00Z)
note: .../goalValues(<timestamp>)/notes(<note-id>)
by report: groups/<ws-id>/scorecards/GetScorecardByReportId(reportId=<report-id>)
```

## Gotchas

- `startDate`, `completionDate` and every check-in `timestamp` must be UTC with a zero time part; the timestamp is the check-in key.
- Subgoals use `parentId`, at most 4 levels; a scorecard holds at most 1,000 goals. Reorder or reparent with `MoveGoals` (`goalRankChanges`).
- Status ids: 0 Not started, 1 On track, 2 At risk, 3 Behind, 4 Overdue, 5 Completed.
- `columnSettings` column ids: 0 Name, 1 Owner, 2 Status, 3 Value, 4 Progress, 5 DueDate, 6 Notes.
- A scorecard owns a hidden semantic model (`datasetId`) and an internal report (`reportId`).
- Connecting a goal to a report visual is a Power BI service UI step. The API only refreshes (`RefreshGoalCurrentValue`, `RefreshGoalTargetValue`), reads `GetRefreshHistory` and disconnects (`DeleteGoalCurrentValueConnection`, `DeleteGoalTargetValueConnection`). Connected values cannot be edited by check-in.
- Connected goals update only when the semantic model refreshes; goals on push models never update.
- Status rules: first matching rule in array order wins, conditions inside a rule are AND, `defaultOutput` applies when none match. Fields are `Value`, `Timestamp`, `Change`; operators `Equal`, `GreaterThan`, `GreaterThanOrEqual`, `LessThan`, `LessThanOrEqual`. Rules re-evaluate on data refresh (connected) or check-in (manual).
- Not supported: BYOK, row-level security, publish to web, SharePoint embed, cross-tenant sharing, Multi-Geo, embedded analytics.

## Example: scorecard, goal, check-in with status rules

```bash
WS_ID=$(fab get "ws.Workspace" -q id)
SC_ID=$(fab api -A powerbi -X post "groups/$WS_ID/scorecards" -i '{"name": "Q1 KPIs"}' -q "text.id")
GOAL_ID=$(fab api -A powerbi -X post "groups/$WS_ID/scorecards($SC_ID)/goals" -i '{"name": "Revenue", "startDate": "2026-01-01T00:00:00Z", "completionDate": "2026-03-31T00:00:00Z"}' -q "text.id")
fab api -A powerbi -X post "groups/$WS_ID/scorecards($SC_ID)/goals($GOAL_ID)/goalValues" -i '{"timestamp": "2026-03-28T00:00:00Z", "value": 74000, "target": 100000, "status": 2}'
fab api -A powerbi -X post "groups/$WS_ID/scorecards($SC_ID)/goals($GOAL_ID)/statusRules" -i '{"defaultOutput": 2, "rules": [{"output": 1, "conditions": [{"fieldComparison": {"field": "Value", "operator": "GreaterThanOrEqual", "value": {"percentOf": {"field": "Target", "percent": 90.0}}}}]}]}'
```

The rule above sets On track when Value is at least 90 percent of Target and At risk otherwise. Value types in a condition: `{"number": 90.0}`, `{"percentOf": {...}}`, `{"dateTime": "..."}`, `{"field": "Target"}`.

The bodies follow the Learn request definitions: Goals Post takes `name` (required) with optional `startDate` and `completionDate`, GoalValues Post takes `timestamp` (required) with `value`, `target` and `status`, and [GoalsStatusRules Post](https://learn.microsoft.com/en-us/rest/api/power-bi/goals-status-rules%28preview%29/post) takes `defaultOutput` (required) and `rules`.
