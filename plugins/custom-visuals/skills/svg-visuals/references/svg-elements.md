# SVG Elements Reference for DAX

Quick reference for SVG elements commonly used in DAX measures. All examples use single quotes for SVG attributes to avoid DAX double-quote escaping.

## Rectangle

```dax
"<rect x='10' y='5' width='50' height='10' fill='#2196F3' rx='2'/>"
```

| Attribute | Description |
|-----------|-------------|
| x, y | Position |
| width, height | Dimensions |
| fill | Fill color |
| stroke | Border color |
| stroke-width | Border thickness |
| opacity | 0-1 transparency |
| rx, ry | Corner radius |

## Circle

```dax
"<circle cx='50' cy='10' r='5' fill='#F44336'/>"
```

| Attribute | Description |
|-----------|-------------|
| cx, cy | Center position |
| r | Radius |
| fill, stroke, opacity | Styling |

## Line

```dax
"<line x1='0' y1='10' x2='100' y2='10' stroke='#333333' stroke-width='2'/>"
```

| Attribute | Description |
|-----------|-------------|
| x1, y1 | Start point |
| x2, y2 | End point |
| stroke | Color |
| stroke-width | Thickness |
| stroke-dasharray | Dash pattern (e.g., `'4,2'`) |

## Polyline (Sparklines)

```dax
"<polyline fill='none' stroke='#01B8AA' stroke-width='3' points='0,50 10,30 20,40 30,10'/>"
```

| Attribute | Description |
|-----------|-------------|
| points | Space-separated `x,y` pairs |
| fill | `none` for line only, color for area fill |
| stroke | Line color |
| stroke-width | Line thickness |

Build points with CONCATENATEX:
```dax
VAR Lines = CONCATENATEX(Table, [X] & "," & [Y], " ", [SortColumn])
```

## Text

```dax
"<text x='50' y='10' font-size='12' fill='#333333' font-weight='bold' text-anchor='middle' dominant-baseline='middle'>Label</text>"
```

| Attribute | Description |
|-----------|-------------|
| x, y | Position |
| font-size | Size in px |
| fill | Text color |
| font-weight | `normal`, `bold`, `700` |
| font-family | `Segoe UI` recommended |
| text-anchor | `start`, `middle`, `end` |
| dominant-baseline | `auto`, `middle`, `hanging` |

## Path (Arcs, Curves)

```dax
"<path d='M 10,10 L 50,10 L 30,30 Z' fill='#4CAF50'/>"
```

| Command | Meaning | Example |
|---------|---------|---------|
| M x,y | Move to | `M 10,10` |
| L x,y | Line to | `L 50,10` |
| A rx ry rot large-arc sweep x y | Arc | `A 40 40 0 0 1 90 50` |
| C x1 y1 x2 y2 x y | Cubic bezier | |
| Q x1 y1 x y | Quadratic bezier | |
| Z | Close path | |

Arc for gauge/donut:
```dax
"<path d='M 10 50 A 40 40 0 0 1 90 50' fill='none' stroke='#2196F3' stroke-width='8'/>"
```

## Group

```dax
"<g transform='translate(10,10)'>" & _Shape1 & _Shape2 & "</g>"
```

| Transform | Example |
|-----------|---------|
| translate(x, y) | Move group |
| rotate(angle) | Rotate around origin |
| scale(x, y) | Scale group |

## Gradient Definition

```dax
"<defs><linearGradient id='grad' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='#0000FF'/><stop offset='1' stop-color='#00000000'/></linearGradient></defs>"
```

Reference in fill: `fill='url(#grad)'`

| Attribute | Description |
|-----------|-------------|
| id | Reference name |
| x1, y1, x2, y2 | Gradient direction (0-1 normalized) |
| gradientUnits | `objectBoundingBox` (default) or `userSpaceOnUse` |
| stop offset | Position along gradient (0-1) |
| stop-color | Color at this stop |

## SVG Container

```dax
"<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'>"
```

| Attribute | Description |
|-----------|-------------|
| xmlns | Required: `http://www.w3.org/2000/svg` |
| viewBox | Coordinate system: `minX minY width height` |
| width, height | Fixed dimensions (optional with viewBox) |
| preserveAspectRatio | `none` to stretch, `xMidYMid meet` to maintain ratio |

## Common Patterns

### Responsive sizing
Use `viewBox` instead of fixed width/height:
```dax
"<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 30'>"
```

### Hex colors

Always use `#` directly in SVG attributes -- e.g., `fill='#01B8AA'`. Do not use `%23` URL encoding -- this causes `VisualDataProxyExecutionUnknownError` in image visuals and is unreliable in other visual types. Avoid named colors (`blue`, `red`) -- always use hex.

```dax
VAR LineColor = "#01B8AA"
```

### Coordinate inversion
SVG Y=0 is at top; invert for charts:
```dax
VAR _Y = 100 - [NormalizedValue]  -- Flips so higher values go up
```

### Render order
Elements render in document order (first = back, last = front). Place backgrounds before foreground elements.
