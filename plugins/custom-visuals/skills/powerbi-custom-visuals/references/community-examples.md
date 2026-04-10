# Example custom visuals on GitHub

Microsoft open-sources the full source of official tutorials and many certified
visuals under the `microsoft` org. Read one close to the target before writing from
scratch; the patterns (dataView access, formatting model, interactivity, D3 render)
transfer directly. All repos are at `https://github.com/microsoft/<name>`.

## Start here (tutorials)

```yaml
PowerBI-visuals-circlecard:   the canonical first visual; IVisual basics, format pane, the develop-circle-card tutorial
PowerBI-visuals-sampleBarChart: the reference bar chart; dataView mapping, scales, selection, the certification repo layout
powerbi-visuals-sampleslicer:  building a slicer-style visual (filtering, selection state)
```

## Production visuals worth reading

```yaml
powerbi-visuals-gantt:      timeline / task bars; date handling, custom layout
powerbi-visuals-sankey:     flow diagram; link/node modelling, D3 sankey
powerbi-visuals-sunburst:   multilevel donut; hierarchy data roles, drill
powerbi-visuals-timeline:   date-range slicer; granularity, range selection
PowerBI-visuals-ChicletSlicer: image/button slicer; rich selection and per-state formatting
PowerBI-visuals-WordCloud:  text layout; async layout work inside update
PowerBI-visuals-PowerKPI:   KPI with trend; multi-measure formatting, analytics pane
PowerBI-visuals-NetworkNavigator / -ForceGraph: force-directed graphs; heavy interaction
PowerBI-visuals-Tornado:    paired bars; comparative encoding
powerbi-visuals-heatmap:    matrix encoding; color scales
```

## What to extract

- **dataView access**: how the visual reads `categorical` vs `matrix` and guards empty data
- **formatting model**: how `capabilities.json` objects map to format-pane cards and slices
- **selection and cross-filter**: use of the selection manager and `supportsHighlight`
- **performance**: incremental render and avoiding full redraws on every `update`
- **certification shape**: the `certification` branch, `.gitignore`, eslint config, no unsafe calls

To find more, search the org for `powerbi-visuals` and sort by stars, or browse the
"Examples of Power BI visuals" page in the Microsoft Learn visuals docs.
