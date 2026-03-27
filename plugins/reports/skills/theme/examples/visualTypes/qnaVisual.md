# qnaVisual (Q&A Visual)

Provides a natural language question-and-answer interface that generates visuals from typed queries.

## Containers

| Container    | Key properties                                                                                                                             |
|--------------|--------------------------------------------------------------------------------------------------------------------------------------------|
| `title`      | `show`, `text`, `fontFamily`, `fontSize`, `fontColor`, `bold`                                                                             |
| `background` | `show`, `color`, `transparency`                                                                                                            |
| `border`     | `show`, `color`, `width`, `radius`                                                                                                         |
| `dropShadow` | `show`, `preset`, `color`, `shadowBlur`, `transparency`                                                                                    |
| `padding`    | `top`, `right`, `bottom`, `left`                                                                                                           |
| `inputBox`   | `questionFontFamily`, `questionFontSize`, `questionFontColor`, `questionBold`, `questionItalic`, `questionUnderline`, `background`, `restatementFontFamily`, `restatementFontSize`, `restatementFontColor`, `hoverColor`, `acceptedColor`, `errorColor`, `warningColor`, `commitButtonBackgroundColor` |
| `suggestions`| `show`, `headerFontFamily`, `headerFontSize`, `headerFontColor`, `headerBold`, `cardFontFamily`, `cardFontSize`, `cardFontColor`, `cardBold`, `cardBackground` |

## Theme Example

```json
{
  "name": "My Theme",
  "visualStyles": {
    "qnaVisual": {
      "*": {
        "title": [{ "fontFamily": "Segoe UI", "fontSize": 12, "bold": false }],
        "background": [{ "show": true, "color": { "solid": { "color": "#FFFFFF" } }, "transparency": 0 }],
        "inputBox": [{
          "questionFontFamily": "Segoe UI",
          "questionFontSize": 14,
          "questionFontColor": { "solid": { "color": "#252423" } },
          "background": { "solid": { "color": "#F3F2F1" } },
          "acceptedColor": { "solid": { "color": "#107C10" } },
          "errorColor": { "solid": { "color": "#D13438" } }
        }],
        "suggestions": [{
          "show": true,
          "headerFontFamily": "Segoe UI Semibold",
          "headerFontSize": 11,
          "headerFontColor": { "solid": { "color": "#252423" } },
          "cardFontFamily": "Segoe UI",
          "cardFontSize": 11,
          "cardFontColor": { "solid": { "color": "#605E5C" } }
        }]
      }
    }
  }
}
```

## Notes

- `inputBox` has separate font properties for the question text (`questionFontFamily`, `questionFontSize`, `questionFontColor`) and the restatement line (`restatementFontFamily`, `restatementFontSize`, `restatementFontColor`) — these are distinct fields, not a single `fontFamily`/`fontColor`.
- `suggestions` similarly splits header and card typography; `show` controls whether the suggestions panel appears at all.
- State colors (`acceptedColor`, `errorColor`, `warningColor`) provide semantic feedback and should maintain sufficient contrast against the `background` object color.
