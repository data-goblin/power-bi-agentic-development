# Promoting Visual Formatting to Theme

Move bespoke `visual.json` overrides into the theme so they apply automatically. This is the primary operation for maintaining theme compliance.

## Two Formatting Scopes in visual.json

### `visualContainerObjects` -- Container Chrome

Frame/container properties, identical across all visual types:

| Key | Controls |
|-----|----------|
| `title` | Title bar: visibility, text, font, color |
| `subTitle` | Subtitle bar |
| `background` | Container fill |
| `border` | Container border |
| `dropShadow` | Shadow |
| `padding` | Inner spacing |
| `divider` | Separator line |
| `visualHeader` | Header buttons (focus, filter icon) |

### `objects` -- Chart-Specific Formatting

Properties that vary by visual type: `legend`, `categoryAxis`, `valueAxis`, `dataPoint`, `labels`, `columnHeaders`, `items`, `indicator`, etc. The theme JSON schema is the authoritative reference.

## Mapping: visual.json to theme.json

Both scopes map to the **same** `visualStyles[type][state]` section. The scope split in visual.json does not exist in the theme.

```
visual.visualContainerObjects.title  -->  visualStyles["<type>"]["*"].title
visual.objects.legend                -->  visualStyles["<type>"]["*"].legend
```

Array wrapper `[{...}]` is required in both locations.

## Decision Framework

Before promoting, audit the report and discuss placement with the user.

### 1. Audit Overrides

```bash
find Report.Report/definition/pages -name "visual.json" -print0 | \
  xargs -0 -I{} sh -c \
  'TYPE=$(jq -r ".visual.visualType" "{}"); \
   for k in $(jq -r ".visual.objects // {} | keys[]" "{}"); do echo "objects.$k | $TYPE"; done; \
   for k in $(jq -r ".visual.visualContainerObjects // {} | keys[]" "{}"); do echo "vCO.$k | $TYPE"; done' \
  | sort | uniq -c | sort -rn
```

Properties appearing on many visuals are promotion candidates. One-offs stay in visual.json.

### 2. Classify Each Override

- **Same value across all instances?** Strong promotion candidate.
- **Conditional formatting expression?** Never promote. Per-visual by nature.
- **Field-bound selector** (`metadata: "Sales.Revenue"`)? Cannot be promoted.

### 3. Wildcard vs Visual-Type

| Property | Wildcard `["*"]["*"]` | Visual-type `["<type>"]["*"]` | Notes |
|----------|:-----:|:-----:|-------|
| `title.show` | Default on | Off for `textbox`, `image`, `shape` | Decorative visuals suppress titles |
| `title.fontSize` | Yes | Rarely | Consistent across report |
| `title.fontFamily` | Yes | Rarely | Consistent across report |
| `subTitle.show` | Yes | -- | Global preference |
| `background.show` | Yes | Off for `textbox`, `image` | Decorative visuals need transparent bg |
| `border.show` | Default off | On for `card`/`cardVisual` if desired | Cards may use borders for separation |
| `dropShadow.show` | Off | -- | Off everywhere for accessibility |
| `padding` | Yes | Override for `tableEx`, `pivotTable` | Tables need different padding |
| `legend.show` | -- | Per type | Line charts show; bar charts often hide |
| `legend.position` | -- | Per type | Bottom for line; right for donut |
| `labels.show` | -- | Per type | Bar charts benefit; line charts often not |
| `labels.fontSize` | If consistent | Per type if sizes differ | Readability varies by chart density |
| `categoryAxis` | -- | Per type | Axes are chart-specific |
| `valueAxis.gridlineShow` | -- | Per type | Depends on chart purpose |
| `items.textSize` | -- | `slicer` only | Slicer-specific |
| `columnHeaders` | -- | `tableEx`, `pivotTable` | Table/matrix specific |

### 4. Visual Types Needing Overrides

**`textbox`, `image`, `shape`** -- Suppress title, background, border, shadow, divider. Decorative visuals; wildcard data-visual defaults would clutter them.

**`card` / `cardVisual`** -- Larger title font, specific label sizing, tighter padding. KPI-focused typography.

**`kpi`** -- Indicator-specific formatting (display units, font size) unique to this type.

**`slicer` / `advancedSlicerVisual`** -- Item font size, selection colors, header visibility. Slicer-specific.

**`tableEx` / `pivotTable`** -- Column/row headers, grid styling, alternating rows, column widths. Most unique formatting properties of any type.

**`lineChart`** -- Line width, markers, interpolation, area fill. Legend and axis formatting often differs from bar charts.

### 5. Present to User

After auditing, present a summary and ask for confirmation before acting:

> "8 of 12 visuals override title to Segoe UI Semibold 14pt. All bar charts hide legend. All textboxes suppress chrome. Line charts use smooth interpolation.
>
> Proposal:
> - **Wildcard**: title font, dropShadow off, border off, padding 8px
> - **textbox/image/shape**: title off, background off, border off
> - **barChart**: legend off
> - **lineChart**: smooth interpolation, markers off
> - **Leave bespoke**: conditional formatting on KPIs, per-series line styles
>
> Confirm or adjust?"

## Promotion Workflow

### With pbir CLI (preferred)

```bash
pbir theme push-visual "Report.Report/Page.Page/Visual.Visual" --dry-run
pbir theme push-visual "Report.Report/Page.Page/Visual.Visual"
```

### Manual (jq fallback)

**Identify:**
```bash
jq '.visual.objects | keys // []' visual.json
jq '.visual.visualContainerObjects | keys // []' visual.json
```

**Check existing theme values:**
```bash
jq '.visualStyles["*"]["*"].legend' "$THEME"
jq '.visualStyles.lineChart["*"].legend' "$THEME"
```

**Write to theme:**
```bash
jq '.visualStyles.lineChart["*"].legend = [{"position": "Bottom", "show": true}]' \
  "$THEME" > "$THEME.tmp" && mv "$THEME.tmp" "$THEME"
jq empty "$THEME"
```

**Remove from visual:**
```bash
jq 'del(.visual.objects.legend)' visual.json > tmp && mv tmp visual.json
jq empty visual.json
```

> Never delete `objects` entirely if conditional formatting keys remain.

**Verify:** Check theme has value, visual no longer has override, visual renders correctly.

## Color Handling

Hardcoded hex in visuals -- decide whether to keep as hex or convert to ThemeDataColor:

```json
// Hex (independent of palette)
"fontColor": {"solid": {"color": "#1971c2"}}

// ThemeDataColor (tracks palette)
"fontColor": {"solid": {"color": {"ThemeDataColor": {"ColorId": 0, "Percent": 0}}}}
```

Use ThemeDataColor when the color should track palette changes.

## Batch Promotion

Same override across many visuals of one type -- promote once, batch-clear:

```bash
# Promote
jq '.visualStyles.lineChart["*"].legend[0].position = "Bottom"' \
  "$THEME" > "$THEME.tmp" && mv "$THEME.tmp" "$THEME"

# Clear from all lineChart visuals
find Report.Report/definition/pages -name "visual.json" -print0 | \
  xargs -0 -I{} sh -c \
  'TYPE=$(jq -r ".visual.visualType" "{}"); \
   [ "$TYPE" = "lineChart" ] && \
   jq "del(.visual.objects.legend)" "{}" > "{}.tmp" && mv "{}.tmp" "{}"'

# Validate
find Report.Report/definition/pages -name "visual.json" -print0 | \
  xargs -0 -I{} sh -c 'jq empty "{}"'
```

## Property Mapping Quick Reference

### Container Chrome

| visual.json | Theme (wildcard) |
|-------------|-----------------|
| `visualContainerObjects.title[0].show` | `visualStyles["*"]["*"].title[0].show` |
| `visualContainerObjects.title[0].fontSize` | `visualStyles["*"]["*"].title[0].fontSize` |
| `visualContainerObjects.background[0].show` | `visualStyles["*"]["*"].background[0].show` |
| `visualContainerObjects.border[0].show` | `visualStyles["*"]["*"].border[0].show` |
| `visualContainerObjects.dropShadow[0].show` | `visualStyles["*"]["*"].dropShadow[0].show` |
| `visualContainerObjects.padding[0].top` | `visualStyles["*"]["*"].padding[0].top` |

### Chart-Specific (use visual-type, not wildcard)

| Visual type | visual.json | Theme |
|-------------|-------------|-------|
| All charts | `objects.legend[0].show` | `visualStyles["<type>"]["*"].legend[0].show` |
| Line/Bar/Area | `objects.categoryAxis[0].fontSize` | `visualStyles["<type>"]["*"].categoryAxis[0].fontSize` |
| Card | `objects.labels[0].fontSize` | `visualStyles.card["*"].labels[0].fontSize` |
| KPI | `objects.indicator[0].fontSize` | `visualStyles.kpi["*"].indicator[0].fontSize` |
| Slicer | `objects.items[0].textSize` | `visualStyles.slicer["*"].items[0].textSize` |
| Table | `objects.columnHeaders[0].fontSize` | `visualStyles.tableEx["*"].columnHeaders[0].fontSize` |
| Matrix | `objects.rowHeaders[0].fontSize` | `visualStyles.pivotTable["*"].rowHeaders[0].fontSize` |
