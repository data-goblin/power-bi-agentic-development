# aiNarratives (AI Narratives)

AI-generated natural language summary visual that produces text descriptions of data from connected visuals or manual prompts.

## Containers

| Container | Key Properties |
|-----------|---------------|
| `text` | `fontColor`, `fontFamily`, `fontSize`, `textAlignment` |
| `summary` | `autoRefresh` |

## Theme Example

```json
{
  "name": "My Theme",
  "visualStyles": {
    "aiNarratives": {
      "*": {
        "text": [
          {
            "fontColor": { "solid": { "color": "#252423" } },
            "fontFamily": "Segoe UI",
            "fontSize": 11,
            "textAlignment": "Left"
          }
        ],
        "summary": [
          {
            "autoRefresh": false
          }
        ]
      }
    }
  }
}
```

## Notes

- `text` is the only container with visual styling properties; `fontColor`, `fontFamily`, `fontSize`, and `textAlignment` cover all available text formatting.
- `summary.autoRefresh` is a behaviour toggle (re-run AI generation on data refresh), not a style property — consider whether setting this at theme level is appropriate for your report.
- Background, border, and title styling use the shared `background`, `border`, and `title` containers common to all visuals, not `aiNarratives`-specific containers.
