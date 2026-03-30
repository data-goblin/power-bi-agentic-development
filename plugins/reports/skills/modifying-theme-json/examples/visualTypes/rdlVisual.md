# rdlVisual (Paginated Report Visual)

Embeds a Power BI paginated report (SSRS/RDL) inside a Power BI report page as a visual.

## Containers

| Container    | Key properties                                                                                          |
|--------------|---------------------------------------------------------------------------------------------------------|
| `title`      | `show`, `text`, `fontFamily`, `fontSize`, `fontColor`, `bold`                                           |
| `background` | `show`, `color`, `transparency`                                                                         |
| `border`     | `show`, `color`, `width`, `radius`                                                                      |
| `dropShadow` | `show`, `preset`, `color`, `shadowBlur`, `transparency`                                                 |
| `padding`    | `top`, `right`, `bottom`, `left`                                                                        |
| `toolbar`    | `show`, `position`, `pageNavigation`, `paramButton`, `openReportButton`, `useFloatingToolbar`            |
| `reportInfo` | `reportId`, `workspaceId`, `reference`                                                                  |
| `export`     | `show`, `exportPDF`, `exportExcel`, `exportWord`, `exportPPTX`, `exportCSV`, `exportXML`, `exportMHTML`, `exportAccessiblePDF` |

## Theme Example

```json
{
  "name": "My Theme",
  "visualStyles": {
    "rdlVisual": {
      "*": {
        "title": [{ "fontFamily": "Segoe UI", "fontSize": 12, "bold": false }],
        "background": [{ "show": true, "color": { "solid": { "color": "#FFFFFF" } }, "transparency": 0 }],
        "border": [{ "show": true, "color": { "solid": { "color": "#E0E0E0" } }, "width": 1 }],
        "toolbar": [{ "show": true, "position": 0, "pageNavigation": true, "paramButton": true }],
        "export": [{ "show": true, "exportPDF": true, "exportExcel": true }]
      }
    }
  }
}
```

## Notes

- The `reportInfo` container (`reportId`, `workspaceId`, `reference`) identifies which paginated report to embed and is set per-visual, not via theme.
- The content of the paginated report itself (fonts, colors, layout defined in the RDL) is not controlled by Power BI report themes — style it in the paginated report directly (Power BI Report Builder or Fabric).
- `toolbar.position` accepts `0` (top) or `1` (bottom); `useFloatingToolbar` makes the toolbar appear only on hover.
