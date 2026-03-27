# bookmarkNavigator (Bookmark Navigator)

A navigation bar that renders a set of bookmarks as clickable tiles, allowing readers to switch report states.

## Containers

| Container   | Key properties                                                                                           |
|-------------|----------------------------------------------------------------------------------------------------------|
| `title`     | `show`, `text`, `fontFamily`, `fontSize`, `fontColor`, `bold`                                            |
| `background`| `show`, `color`, `transparency`                                                                          |
| `border`    | `show`, `color`, `width`, `radius`                                                                       |
| `dropShadow`| `show`, `preset`, `color`, `shadowBlur`, `transparency`                                                  |
| `padding`   | `top`, `right`, `bottom`, `left`                                                                         |
| `text`      | `show`, `fontFamily`, `fontSize`, `fontColor`, `bold`, `italic`, `underline`, `horizontalAlignment`, `verticalAlignment` |
| `fill`      | `show`, `fillColor`, `transparency`                                                                      |
| `outline`   | `show`, `lineColor`, `weight`, `transparency`                                                            |
| `shape`     | `tileShape`, `roundEdge`, `rectangleRoundedCurve`, `chevronAngle`                                        |
| `layout`    | `orientation`, `columnCount`, `rowCount`, `cellPadding`                                                  |
| `bookmarks` | `bookmarkGroup`, `selectedBookmark`, `allowDeselectionBookmark`, `deselectionBookmark`, `hideDeselectedBookmark` |

## Theme Example

```json
{
  "name": "My Theme",
  "visualStyles": {
    "bookmarkNavigator": {
      "*": {
        "title": [{ "show": false }],
        "background": [{ "show": false }],
        "text": [{
          "fontFamily": "Segoe UI",
          "fontSize": 11,
          "fontColor": { "solid": { "color": "#252423" } },
          "bold": false,
          "horizontalAlignment": "center",
          "verticalAlignment": "middle"
        }],
        "fill": [{
          "show": true,
          "fillColor": { "solid": { "color": "#F3F2F1" } },
          "transparency": 0
        }],
        "outline": [{
          "show": true,
          "lineColor": { "solid": { "color": "#C8C6C4" } },
          "weight": 1,
          "transparency": 0
        }],
        "shape": [{ "tileShape": "rectangle", "roundEdge": 4 }],
        "layout": [{ "orientation": 2, "cellPadding": 4 }]
      }
    }
  }
}
```

## Notes

- `text` styles the label on each bookmark tile; `fill` and `outline` control the tile background and border respectively — these are the three primary styling containers.
- `layout.orientation` accepts `0`, `1`, or `2`; `shape.tileShape` accepts values including `"rectangle"`, `"arrow"`, `"arrowChevron"`, `"arrowPentagon"`, and others — see `pbir schema describe bookmarkNavigator.shape` for the full set.
- The `bookmarks` container controls behaviour (which bookmark group to show, deselection handling) rather than appearance, so it is typically set per-visual rather than via theme.
