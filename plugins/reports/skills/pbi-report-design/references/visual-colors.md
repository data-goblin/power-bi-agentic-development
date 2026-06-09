# Visual Colors

Guidelines for effective color usage in Power BI reports.

## Color Principles

### Use Theme Colors

Prefer theme colors over hex codes:

```json
// Good - uses theme color
"expr": {"ThemeDataColor": {"ColorId": 1, "Percent": 0}}

// Avoid in visuals - use only in extension measures
"expr": {"Literal": {"Value": "'#118DFF'"}}
```

### Semantic Colors

Use these theme color names in extension measures:

| Color Name | Meaning | Typical Color |
|------------|---------|---------------|
| `"good"` | Positive, on-target | Green |
| `"bad"` | Negative, off-target | Red |
| `"neutral"` | Unchanged, baseline | Gray/Yellow |
| `"minColor"` | Gradient minimum | Red/Orange |
| `"midColor"` | Gradient midpoint | Yellow/White |
| `"maxColor"` | Gradient maximum | Green/Blue |

### Extension Measure Pattern

```dax
// Return theme color names, not hex codes
Color Measure =
IF([Value] >= [Target], "good",
IF([Value] >= [Target] * 0.9, "neutral", "bad"))
```

## Color Contrast

### WCAG 2.1 Requirements

| Element | Minimum Ratio |
|---------|---------------|
| Normal text | 4.5:1 |
| Large text (18pt+) | 3:1 |
| UI components | 3:1 |

### Common Contrast Issues

| Background | Text | Ratio | Status |
|------------|------|-------|--------|
| White (#FFF) | Dark gray (#333) | 12.6:1 | Pass |
| White (#FFF) | Medium gray (#777) | 4.5:1 | Pass (barely) |
| White (#FFF) | Light gray (#AAA) | 2.9:1 | Fail |
| Light blue (#E3F2FD) | Blue (#1976D2) | 4.8:1 | Pass |

## Color Categories

### Data Colors (dataColors)

Primary series colors in theme:

```json
"dataColors": [
  "#118DFF",  // Blue (primary)
  "#12239E",  // Dark blue
  "#E66C37",  // Orange
  "#6B007B",  // Purple
  "#E044A7",  // Pink
  "#744EC2"   // Violet
]
```

### Background Colors

Use muted, light colors:

- White: `#FFFFFF`
- Light gray: `#F5F5F5`, `#FAFAFA`
- Light blue: `#F0F8FF`, `#E3F2FD`

### Accent Colors

For highlights and emphasis:

- Use sparingly
- Reserve bright colors for important data
- Don't use red/orange unless indicating problems

## Choosing the CF Basis

Pick the basis before touching `pbir visuals cf`; picking wrong produces valid JSON that misleads readers.

Each basis encodes a claim about the data:

- **Gradient:** the measure is continuous and comparable across rows ("more is darker"). Valid only for a magnitude on a single scale. A signed variance with no explicit center miscolors the midpoint and re-stretches on every refresh.
- **Rules:** discrete business-defined bands (RAG, SLA met/missed) whose cut points come from policy, not the data's min/max. These survive refresh without shifting.
- **Field value (measure-driven):** the color or icon is itself data that a measure computed. Most flexible; prefer it for anything non-trivial. Rule: if the logic has more than two thresholds or depends on another measure, make it measure-driven rather than an inline rules array.
- **Icons:** a status faster to scan than a number. Use sparingly on a triage/status column; never on the primary value column.

Apply CF to the secondary signal (variance, gap, status), not the headline value. Data bars on the one primary magnitude, color scale on the variance column; never both on the same column.

Prefer theme tokens over hex in every basis (`pbir visuals cf ... --theme-colors` to convert existing hex assignments).

### CF Pitfalls

- A signed-measure gradient with no center colors zero as mid-gray noise; set the center explicitly to 0 or use rules
- `IconOnly` hides the number; only use it where the number itself is irrelevant
- Overlapping or gappy rule bounds silently leave rows uncolored; promote fiddly logic to a measure you can test with `pbir model -q`

## Conditional Formatting Colors

### Best Practices

1. **Theme tokens over hex** -- use `--theme-colors` to convert existing hex CF assignments to tokens; changing the theme then cascades everywhere
2. **Measure-driven conversion** -- use `--to-measure` to promote built-in gradient/rules CF to a measure expression; logic becomes testable and versionable
3. **Sparingly applied** -- CF should highlight exceptions; formatting every column means nothing stands out
4. **Accessible** -- use blue/orange instead of red/green; always pair color with a secondary cue (icon, text, shape)
5. **Theme-first** -- check that `good`, `bad`, and `neutral` sentiment colors exist in the theme before applying CF; add them if missing (e.g., `good="#00B050"`, `bad="#FF0000"`, `neutral="#FFC000"`)

### Positive/Negative Pattern

```json
// In extension measure (preferred)
"expression": "IF([Value] >= 0, \"good\", \"bad\")"
```

Theme defines actual colors:

```json
"good": "#00B050",   // Green
"bad": "#FF0000",    // Red
"neutral": "#FFC000" // Yellow/Orange
```

### Gradient Pattern

For continuous scales, use theme tokens not hex:

```
minColor -> bad end of scale (e.g., "minColor" or "bad")
midColor -> neutral midpoint (e.g., "midColor" or "neutral")
maxColor -> good end of scale (e.g., "maxColor" or "good")
```

### Traffic Light Pattern

| Range | Color Name | Meaning |
|-------|------------|---------|
| < 50% | `"bad"` | Critical |
| 50-80% | `"neutral"` | Warning |
| > 80% | `"good"` | On track |

### Data Bars

Data bars provide magnitude scanning in tables/matrices. Apply to primary measure columns. Use muted colors that don't overwhelm the text values.

## Color Don'ts

### Avoid

1. **Too many colors** - Maximum 6-8 distinct colors per visual
2. **Pure black** - Use dark gray (#333) instead
3. **Neon/bright colors** - Cause eye strain
4. **Red for positive** - Confuses users
5. **Color-only meaning** - Always pair with text/icons

### Never Use

- Rainbow gradients
- Clashing color combinations
- Low contrast combinations
- Brand colors on data points (unless intentional)

## Accessibility Tips

### Color Blindness

Test with color blindness simulators:

- Protanopia (red-blind): ~1% of males
- Deuteranopia (green-blind): ~1% of males
- Tritanopia (blue-blind): rare

**Safe combinations:**

- Blue + Orange (instead of Red + Green)
- Blue + Yellow
- Dark + Light variants of same hue

### Alternative Indicators

Pair colors with:

- Icons (up/down arrows)
- Patterns (solid/hatched)
- Text labels
- Shapes (markers)
