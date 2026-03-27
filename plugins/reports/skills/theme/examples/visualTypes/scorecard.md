# scorecard (Scorecard)

Power BI goals/metrics tracker visual that connects to a Fabric scorecard to display progress against targets.

## Containers

| Container | Key Properties |
|-----------|---------------|
| `header` | `backgroundColor`, `foregroundColor`, `show`, `showCards`, `showTitle`, `showToolbar` |
| `columnHeaders` | `foregroundColor`, `show` |
| `scorecard` | `backgroundColor`, `foregroundColor`, `tableBackgroundColor`, `fontFamily`, `displayMode`, `showCommandBar` |
| `goals` | `backgroundColor`, `foregroundColor` |

## Theme Example

```json
{
  "scorecard": {
    "header": {
      "show": true,
      "showTitle": true,
      "showToolbar": false,
      "backgroundColor": { "solid": { "color": "#252423" } },
      "foregroundColor": { "solid": { "color": "#FFFFFF" } }
    },
    "columnHeaders": {
      "show": true,
      "foregroundColor": { "solid": { "color": "#605E5C" } }
    },
    "scorecard": {
      "backgroundColor": { "solid": { "color": "#FFFFFF" } },
      "foregroundColor": { "solid": { "color": "#252423" } },
      "tableBackgroundColor": { "solid": { "color": "#F3F2F1" } },
      "fontFamily": "Segoe UI",
      "displayMode": "list",
      "showCommandBar": false
    },
    "goals": {
      "backgroundColor": { "solid": { "color": "#FFFFFF" } },
      "foregroundColor": { "solid": { "color": "#252423" } }
    }
  }
}
```

## Notes

- The `scorecard` container uses `foregroundColor` / `backgroundColor` (not `fontColor` / `backColor`) — naming differs from table-family visuals.
- `scorecard.scorecardId` and `scorecard.scorecardReference` are connection properties set at report level, not in theme.
- Theme control is intentionally limited; most scorecard appearance (status colours, KPI icons) is governed by the connected Fabric scorecard definition.
