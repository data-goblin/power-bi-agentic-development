# Promoting Visual Formatting to Theme

"Promoting" means taking formatting that currently lives in a bespoke `visual.json` override and moving it up into the theme, so it applies automatically to all visuals of that type (or all visuals globally). This is the primary maintenance operation for keeping theme compliance over time.

---

## Understanding the Two Formatting Scopes

Power BI's visual formatting is split into two distinct scopes in `visual.json`:

### `visualContainerObjects` — Container Chrome

Properties that belong to the visual's frame/container, independent of the visual type:

```
title         — title bar: visibility, text, font, color, alignment
subTitle      — subtitle bar
background    — container fill: visibility, color, transparency
border        — container border: visibility, width, color, radius
dropShadow    — shadow: visibility, angle, distance, blur, spread
padding       — inner spacing: top, bottom, left, right
divider       — separator line between title and content
visualHeader  — top-right header buttons (focus mode, filter icon, etc.)
```

These are the same properties regardless of whether the visual is a card, line chart, or table.

### `objects` — Chart-Specific Formatting

Properties that belong to the visual content itself and vary by visual type:

```
legend           — legend visibility, position, font
categoryAxis     — X-axis: visibility, font, labels, gridlines
valueAxis        — Y-axis: visibility, font, start point, gridlines
dataPoint        — series colors, markers
labels / dataLabels  — data label visibility, font, format
columnHeaders    — table/matrix column header styling
values           — table/matrix cell values
items            — slicer item font and color
indicator        — KPI indicator font
...
```

The available keys in `objects` differ per visual type. The theme JSON schema is the authoritative reference: https://github.com/microsoft/powerbi-desktop-samples/tree/main/Report%20Theme%20JSON%20Schema

---

## How Visual.json Properties Map to Theme Properties

Both `visualContainerObjects` and `objects` from `visual.json` map to the **same** `visualStyles[type][state]` section in the theme JSON. The scope split in visual.json doesn't exist in the theme — everything lives under the visual type key.

```
visual.json                             theme.json
─────────────────────────────────────────────────────────────────
visual.visualContainerObjects.title  →  visualStyles["<type>"]["*"].title
visual.visualContainerObjects.border →  visualStyles["<type>"]["*"].border
visual.objects.legend                →  visualStyles["<type>"]["*"].legend
visual.objects.categoryAxis          →  visualStyles["<type>"]["*"].categoryAxis
```

The wrapper array `[{...}]` structure is required in both locations.

---

## Wildcard vs Visual-Type: Which Level to Target?

The key question when promoting is whether the setting should apply to:

| Applies to... | Target in theme |
|---------------|-----------------|
| **All visual types** | `visualStyles["*"]["*"].<property>` |
| **One specific visual type** | `visualStyles["<type>"]["*"].<property>` |

### Use Wildcard When

- The property is container chrome (`visualContainerObjects`) that should be uniform: title font, default padding, shadow disabled, border disabled
- The same chart property should apply across all visual types that support it (e.g., `dataLabels.fontSize` set consistently everywhere)
- Setting a baseline that specific visual types can override as needed

### Use Visual-Type When

- The property is chart-specific and only meaningful for that type: legend position for line charts, slicer item font, KPI indicator size
- Different visual types need different values for the same property (e.g., title `show: true` globally, but `show: false` for `textbox`)
- You don't want the setting to bleed into visual types where it might cause issues

### The Override Cascade

Visual-type overrides always win over the wildcard. So:
- Set the wildcard as the global default
- Override specific types where exceptions are needed
- Visual-level `visual.json` still overrides everything (which is what you're trying to remove)

---

## Step-by-Step Promotion Workflow

### 1. Identify What to Promote

Read a visual.json and inspect both scopes:

```bash
# See what container chrome overrides exist
jq '.visual.visualContainerObjects | keys // []' visual.json

# See what chart-specific overrides exist
jq '.visual.objects | keys // []' visual.json

# See the full content of a specific key
jq '.visual.objects.legend' visual.json
jq '.visual.visualContainerObjects.title' visual.json
```

### 2. Decide the Target Level

Ask:
- Is this formatting unique to this visual type? → Visual-type (`["lineChart"]["*"]`)
- Should every visual in the report have this? → Wildcard (`["*"]["*"]`)
- Does the theme already set this elsewhere? → Check before overwriting

```bash
# Check what the theme currently has for this property (wildcard)
jq '.visualStyles["*"]["*"].legend' "$THEME"

# Check what the theme has for the specific type
jq '.visualStyles.lineChart["*"].legend' "$THEME"
```

### 3. Write the Value to the Theme

Always use the temp file pattern to avoid truncation. Always validate immediately after.

```bash
# Example: promote legend position from a line chart to the visual-type level
jq '.visualStyles.lineChart["*"].legend = [{"position": "Bottom", "show": true}]' \
  "$THEME" > "$THEME.tmp" && mv "$THEME.tmp" "$THEME"
jq empty "$THEME"

# Example: promote title font to the wildcard (applies to all visuals)
jq '.visualStyles["*"]["*"].title[0].fontFamily = "'\'Segoe UI Semibold\'', wf_segoe-ui_semibold, helvetica, arial, sans-serif"' \
  "$THEME" > "$THEME.tmp" && mv "$THEME.tmp" "$THEME"
jq empty "$THEME"

# Example: chain multiple promotions in one jq expression
jq '
  .visualStyles.lineChart["*"].legend = [{"position": "Bottom", "show": true}] |
  .visualStyles.lineChart["*"].categoryAxis[0].fontSize = 11 |
  .visualStyles.lineChart["*"].valueAxis[0].gridlineWeight = 1
' "$THEME" > "$THEME.tmp" && mv "$THEME.tmp" "$THEME"
jq empty "$THEME"
```

### 4. Remove the Override from the Visual

After promoting to the theme, remove the redundant visual-level override:

```bash
# Remove a specific chart property override
jq 'del(.visual.objects.legend)' visual.json > tmp && mv tmp visual.json

# Remove a specific container override
jq 'del(.visual.visualContainerObjects.title)' visual.json > tmp && mv tmp visual.json

# Remove the entire objects section if completely cleared
jq 'del(.visual.objects)' visual.json > tmp && mv tmp visual.json

# Always validate after
jq empty visual.json
```

> Only delete the specific keys you promoted. Never delete the entire `objects` if any keys remain — especially conditional formatting expressions.

### 5. Verify

After promoting and removing:

1. Check the theme has the value: `jq '.visualStyles.lineChart["*"].legend' "$THEME"`
2. Check the visual no longer has the override: `jq '.visual.objects.legend' visual.json` (should return `null`)
3. Redeploy and visually verify the visual still renders correctly

If the visual looks different after removing the override:
- The value you removed might have been intentionally different from the theme value
- The property structure might differ between `objects` and `visualStyles` — compare the JSON shape
- Check if another visual.json key is now controlling the rendering

---

## Common Property Mappings

### Container Chrome Properties (visualContainerObjects → visualStyles)

| visual.json path | Theme path (visual-type) | Theme path (wildcard) |
|------------------|--------------------------|----------------------|
| `visualContainerObjects.title[0].show` | `visualStyles["<type>"]["*"].title[0].show` | `visualStyles["*"]["*"].title[0].show` |
| `visualContainerObjects.title[0].fontSize` | `visualStyles["<type>"]["*"].title[0].fontSize` | `visualStyles["*"]["*"].title[0].fontSize` |
| `visualContainerObjects.title[0].fontFamily` | `visualStyles["<type>"]["*"].title[0].fontFamily` | `visualStyles["*"]["*"].title[0].fontFamily` |
| `visualContainerObjects.background[0].show` | `visualStyles["<type>"]["*"].background[0].show` | `visualStyles["*"]["*"].background[0].show` |
| `visualContainerObjects.border[0].show` | `visualStyles["<type>"]["*"].border[0].show` | `visualStyles["*"]["*"].border[0].show` |
| `visualContainerObjects.dropShadow[0].show` | `visualStyles["<type>"]["*"].dropShadow[0].show` | `visualStyles["*"]["*"].dropShadow[0].show` |
| `visualContainerObjects.padding[0].top` | `visualStyles["<type>"]["*"].padding[0].top` | `visualStyles["*"]["*"].padding[0].top` |

### Chart-Specific Properties (objects → visualStyles)

These vary by visual type. The table below shows common ones; the theme JSON schema contains the full list.

| Visual type | visual.json path | Theme path |
|-------------|------------------|------------|
| All charts | `objects.legend[0].position` | `visualStyles["<type>"]["*"].legend[0].position` |
| All charts | `objects.legend[0].show` | `visualStyles["<type>"]["*"].legend[0].show` |
| Line/Bar/Area | `objects.categoryAxis[0].fontSize` | `visualStyles["<type>"]["*"].categoryAxis[0].fontSize` |
| Line/Bar/Area | `objects.valueAxis[0].start` | `visualStyles["<type>"]["*"].valueAxis[0].start` |
| Line/Bar/Area | `objects.labels[0].show` | `visualStyles["<type>"]["*"].labels[0].show` |
| Card | `objects.labels[0].fontSize` | `visualStyles.card["*"].labels[0].fontSize` |
| KPI | `objects.indicator[0].fontSize` | `visualStyles.kpi["*"].indicator[0].fontSize` |
| Slicer | `objects.items[0].fontSize` | `visualStyles.slicer["*"].items[0].fontSize` |
| Table | `objects.columnHeaders[0].fontSize` | `visualStyles.tableEx["*"].columnHeaders[0].fontSize` |
| Matrix | `objects.rowHeaders[0].fontSize` | `visualStyles.matrix["*"].rowHeaders[0].fontSize` |

---

## Handling Colors When Promoting

When a visual uses a hardcoded hex color in `objects` or `visualContainerObjects`:

```json
"fontColor": {"solid": {"color": "#1971c2"}}
```

Decide whether to:
1. **Keep as hex** — fine if the color is intentionally fixed and shouldn't change with palette updates
2. **Convert to ThemeDataColor** — better if the color should track the theme palette

```json
// ThemeDataColor: references dataColors[0] from the theme palette
"fontColor": {
  "solid": {
    "color": {
      "ThemeDataColor": {"ColorId": 0, "Percent": 0}
    }
  }
}
```

Use ThemeDataColor in themes when the color should stay linked to the palette. Use bare hex when the color is intentionally independent.

---

## Batch Promotion: Moving a Property Across Many Visuals

When the same override exists across many visuals of the same type, promote once and batch-clear:

```bash
# Step 1: Identify the value from one representative visual
jq '.visual.objects.legend[0].position' path/to/one/visual.json

# Step 2: Promote to theme
jq '.visualStyles.lineChart["*"].legend[0].position = "Bottom"' \
  "$THEME" > "$THEME.tmp" && mv "$THEME.tmp" "$THEME"

# Step 3: Remove the override from all line chart visuals
find Report.Report/definition/pages -name "visual.json" -print0 | \
  xargs -0 -I{} sh -c \
  'TYPE=$(jq -r ".visual.visualType" "{}"); \
   [ "$TYPE" = "lineChart" ] && \
   jq "del(.visual.objects.legend)" "{}" > "{}.tmp" && mv "{}.tmp" "{}"'

# Step 4: Validate all
find Report.Report/definition/pages -name "visual.json" -print0 | \
  xargs -0 -I{} sh -c 'jq empty "{}" && echo "OK: {}"'
```
