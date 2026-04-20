# Property Catalogue

Formatting properties for all 49 visual types. Universal containers are detailed below;
for type-specific containers use `pbir schema describe "type.container"` to get full property details.

## Discovery Commands

```bash
pbir schema containers card               # List containers for a type
pbir schema describe card.title            # Properties with types, ranges, enums
pbir visuals format "path" -v              # Current values on a live visual
pbir visuals properties -s "marker"        # Fuzzy search across all types
pbir set "path.container.property" --value X  # Set any property
```

## Universal Containers

Present on all/most visual types. Set via `pbir set "path.CONTAINER.PROPERTY" --value X`

### background

| Property | Type | Constraints |
|----------|------|-------------|
| color | object |  |
| show | boolean |  |
| transparency | number |  |

### border

| Property | Type | Constraints |
|----------|------|-------------|
| color | object |  |
| radius | number |  |
| show | boolean |  |
| width | number |  |

### divider

| Property | Type | Constraints |
|----------|------|-------------|
| color | object |  |
| ignorePadding | boolean |  |
| show | boolean |  |
| style | string | solid, dashed, dotted |
| width | number |  |

### dropShadow

| Property | Type | Constraints |
|----------|------|-------------|
| angle | number |  |
| color | object |  |
| position | string | Outer, Inner |
| preset | string | 10 values |
| shadowBlur | number |  |
| shadowDistance | number |  |
| shadowSpread | number |  |
| show | boolean |  |
| transparency | number |  |

### general

| Property | Type | Constraints |
|----------|------|-------------|
| formatString | string |  |

### lockAspect

| Property | Type | Constraints |
|----------|------|-------------|
| show | boolean |  |

### padding

| Property | Type | Constraints |
|----------|------|-------------|
| bottom | number |  |
| left | number |  |
| right | number |  |
| top | number |  |

### spacing

| Property | Type | Constraints |
|----------|------|-------------|
| customizeSpacing | boolean |  |
| spaceBelowSubTitle | number |  |
| spaceBelowTitle | number |  |
| spaceBelowTitleArea | number |  |
| verticalSpacing | number |  |

### stylePreset

| Property | Type | Constraints |
|----------|------|-------------|
| name | string |  |

### subTitle

| Property | Type | Constraints |
|----------|------|-------------|
| alignment | string | left, center, right |
| bold | boolean |  |
| fontColor | object |  |
| fontFamily | string |  |
| fontSize | number | min=6; max=45 |
| heading | string | Normal, Heading2, Heading3, Heading4, Heading5, Heading6 |
| italic | boolean |  |
| show | boolean |  |
| text | string |  |
| titleWrap | boolean |  |
| underline | boolean |  |

### title

| Property | Type | Constraints |
|----------|------|-------------|
| alignment | string | left, center, right |
| background | object |  |
| bold | boolean |  |
| fontColor | object |  |
| fontFamily | string |  |
| fontSize | number | min=6; max=45 |
| heading | string | Normal, Heading2, Heading3, Heading4, Heading5, Heading6 |
| italic | boolean |  |
| show | boolean |  |
| text | string |  |
| titleWrap | boolean |  |
| underline | boolean |  |

### visualHeader

| Property | Type | Constraints |
|----------|------|-------------|
| background | object |  |
| border | object |  |
| foreground | object |  |
| show | boolean |  |
| showCommentButton | boolean |  |
| showCopyVisualImageButton | boolean |  |
| showDrillDownExpandButton | boolean |  |
| showDrillDownLevelButton | boolean |  |
| showDrillRoleSelector | boolean |  |
| showDrillToggleButton | boolean |  |
| showDrillUpButton | boolean |  |
| showFilterRestatementButton | boolean |  |
| showFocusModeButton | boolean |  |
| showFollowVisualButton | boolean |  |
| showOptionsMenu | boolean |  |
| showPersonalizeVisualButton | boolean |  |
| showPinButton | boolean |  |
| showSeeDataLayoutToggleButton | boolean |  |
| showSetAlertButton | boolean |  |
| showSmartNarrativeButton | boolean |  |
| showTooltipButton | boolean |  |
| showVisualErrorButton | boolean |  |
| showVisualInformationButton | boolean |  |
| showVisualWarningButton | boolean |  |
| transparency | number |  |

### visualHeaderTooltip

| Property | Type | Constraints |
|----------|------|-------------|
| background | object |  |
| bold | boolean |  |
| fontFamily | string |  |
| fontSize | number | min=6; max=45 |
| italic | boolean |  |
| section | string |  |
| text | string |  |
| themedBackground | object |  |
| themedTitleFontColor | object |  |
| titleFontColor | object |  |
| transparency | number |  |
| type | string | Default, Canvas |
| underline | boolean |  |

### visualLink

| Property | Type | Constraints |
|----------|------|-------------|
| bookmark | string |  |
| dataFunction | object |  |
| disabledTooltip | string |  |
| drillthroughSection | string |  |
| enabledTooltip | string |  |
| navigationSection | string |  |
| show | boolean |  |
| showDefaultTooltip | boolean |  |
| suppressDefaultTooltip | boolean |  |
| tooltip | string |  |
| tooltipPlaceholderText | string |  |
| type | string | 9 values |
| webUrl | string |  |

### visualTooltip

| Property | Type | Constraints |
|----------|------|-------------|
| actionFontColor | object |  |
| background | object |  |
| bold | boolean |  |
| fontFamily | string |  |
| fontSize | number | min=6; max=45 |
| italic | boolean |  |
| section | string |  |
| show | boolean |  |
| themedBackground | object |  |
| themedTitleFontColor | object |  |
| themedValueFontColor | object |  |
| titleFontColor | object |  |
| transparency | number |  |
| type | string | Default, Canvas |
| underline | boolean |  |
| valueFontColor | object |  |

## Type-Specific Container Index

Containers unique to each visual type. Run `pbir schema describe "type.container"`
to see full property details with types, ranges, and descriptions.

**actionButton** (76 props): fill, glow, icon, outline, rotation, shadow, shape, text
**advancedSlicerVisual** (192 props): accentBar, actionState, data, fillCustom, glowCustom, icon, image, label, layout, outline, overFlow, rotation, selection, selectionIcon, shadowCustom, shapeCustomRectangle, value
**aiNarratives** (9 props): narrativeSelection, text, userPrompt
**areaChart** (348 props): annotationTemplate, categoryAxis, dataPoint, filters, labels, layout, legend, lineStyles, markers, plotArea, referenceLine, scalarKey, seriesLabels, smallMultiplesLayout, subheader, trend, valueAxis, xAxisReferenceLine, y1AxisReferenceLine, y2Axis, zoom
**azureMap** (156 props): barChart, bubbleLayer, categoryLabels, commonDataOptions, dataPoint, filledMap, heatMapLayer, labels, legend, mapControls, pathLayer, referenceLayer, tileLayer, traffic
**barChart** (303 props): annotationTemplate, categoryAxis, dataPoint, error, filters, labels, layout, legend, plotArea, ribbonBands, smallMultiplesLayout, subheader, totals, trend, valueAxis, xAxisReferenceLine, y1AxisReferenceLine, zoom
**bookmarkNavigator** (74 props): accentBar, bookmarks, fill, glow, layout, outline, rotation, shadow, shape, text
**card** (18 props): categoryLabels, labels, wordWrap
**cardVisual** (394 props): accentBar, cardCalloutArea, cardImage, fillCustom, glowCustom, grid, image, label, layout, outline, overFlow, referenceLabel, referenceLabelDetail, referenceLabelLayout, referenceLabelTitle, referenceLabelValue, rotation, shadowCustom, shapeCustomRectangle, smallMultiplesAccentBar, smallMultiplesBorder, smallMultiplesCellBackGround, smallMultiplesGrid, smallMultiplesHeader, smallMultiplesLayout, smallMultiplesOuterShape, smallMultiplesOverFlow, value
**clusteredBarChart** (303 props): annotationTemplate, categoryAxis, dataPoint, error, filters, labels, layout, legend, plotArea, referenceLine, smallMultiplesLayout, subheader, trend, valueAxis, xAxisReferenceLine, y1AxisReferenceLine, zoom
**clusteredColumnChart** (303 props): annotationTemplate, categoryAxis, dataPoint, error, filters, labels, layout, legend, plotArea, referenceLine, smallMultiplesLayout, subheader, trend, valueAxis, xAxisReferenceLine, y1AxisReferenceLine, zoom
**columnChart** (303 props): annotationTemplate, categoryAxis, dataPoint, error, filters, labels, layout, legend, plotArea, ribbonBands, smallMultiplesLayout, subheader, totals, trend, valueAxis, xAxisReferenceLine, y1AxisReferenceLine, zoom
**decompositionTreeVisual** (47 props): analysis, categoryLabels, dataBars, dataLabels, insights, levelHeader, tree
**donutChart** (36 props): annotationTemplate, dataPoint, labels, legend, slices
**filledMap** (34 props): categoryLabels, dataPoint, labels, legend, mapControls, mapStyles, stroke
**filter**: universal containers only
**funnel** (33 props): categoryAxis, dataPoint, labels, percentBarLabel
**gauge** (33 props): axis, calloutValue, dataPoint, labels, target
**group**: universal containers only
**hundredPercentStackedAreaChart** (332 props): annotationTemplate, categoryAxis, dataPoint, filters, labels, layout, legend, lineStyles, markers, plotArea, scalarKey, seriesLabels, smallMultiplesLayout, subheader, totals, trend, valueAxis, xAxisReferenceLine, y1AxisReferenceLine, y2Axis, zoom
**hundredPercentStackedBarChart** (303 props): annotationTemplate, categoryAxis, dataPoint, error, filters, labels, layout, legend, plotArea, ribbonBands, smallMultiplesLayout, subheader, totals, trend, valueAxis, xAxisReferenceLine, y1AxisReferenceLine, zoom
**hundredPercentStackedColumnChart** (303 props): annotationTemplate, categoryAxis, dataPoint, error, filters, labels, layout, legend, plotArea, ribbonBands, smallMultiplesLayout, subheader, totals, trend, valueAxis, xAxisReferenceLine, y1AxisReferenceLine, zoom
**image** (28 props): image, imageScaling
**keyDriversVisual** (17 props): keyDrivers, keyDriversDrillVisual, keyInfluencersVisual
**kpi** (43 props): goals, indicator, lastDate, status, trendline
**lineChart** (430 props): annotationTemplate, anomalyDetection, categoryAxis, dataPoint, error, filters, forecast, labels, layout, legend, lineStyles, markers, plotArea, referenceLine, scalarKey, seriesLabels, smallMultiplesLayout, subheader, trend, valueAxis, xAxisReferenceLine, y1AxisReferenceLine, y2Axis, zoom
**lineClusteredColumnComboChart** (378 props): annotationTemplate, categoryAxis, dataPoint, error, filters, labels, layout, legend, lineStyles, markers, plotArea, referenceLine, seriesLabels, smallMultiplesLayout, subheader, trend, valueAxis, xAxisReferenceLine, y1AxisReferenceLine, zoom
**lineStackedColumnComboChart** (356 props): annotationTemplate, categoryAxis, dataPoint, error, filters, labels, layout, legend, lineStyles, markers, plotArea, seriesLabels, smallMultiplesLayout, subheader, totals, valueAxis, xAxisReferenceLine, y1AxisReferenceLine, zoom
**listSlicer** (202 props): accentBar, actionState, data, expansionIcon, fillCustom, glowCustom, icon, image, label, layout, outline, overFlow, rotation, selection, selectionIcon, shadowCustom, shapeCustomRectangle, value
**map** (45 props): bubbles, categoryLabels, dataPoint, heatMap, legend, mapControls, mapStyles
**multiRowCard** (27 props): card, cardTitle, categoryLabels, dataLabels
**pieChart** (36 props): annotationTemplate, dataPoint, labels, legend, slices
**pivotTable** (140 props): accessibility, annotationTemplate, blankRows, columnFormatting, columnHeaders, columnTotal, columnWidth, grid, rowHeaders, rowTotal, sparklines, subTotals, total, values
**pythonVisual** (2 props): script
**qnaVisual** (30 props): hiddenProperties, inputBox, suggestions
**rdlVisual** (20 props): autoFilter, export, parameterMapping, reportInfo, toolbar
**ribbonChart** (303 props): annotationTemplate, categoryAxis, dataPoint, error, filters, labels, layout, legend, plotArea, ribbonBands, smallMultiplesLayout, subheader, totals, trend, valueAxis, xAxisReferenceLine, y1AxisReferenceLine, zoom
**scatterChart** (215 props): bubbles, categoryAxis, categoryLabels, clustering, colorBorder, colorByCategory, currentFrameIndex, dataPoint, fillPoint, legend, markers, plotArea, plotAreaShading, ratioLine, referenceLine, trend, valueAxis, xAxisReferenceLine, y1AxisReferenceLine, zoom
**scorecard** (93 props): columnHeaders, detailsPane, goals, header, scorecard, visualization
**scriptVisual** (2 props): script
**shape** (56 props): fill, glow, outline, rotation, shadow, shape, text
**shapeMap** (22 props): dataPoint, defaultColors, legend, shape, zoom
**slicer** (69 props): data, date, dateRange, header, items, numericInputStyle, pendingChangesIcon, searchBox, selection, slider
**stackedAreaChart** (332 props): annotationTemplate, categoryAxis, dataPoint, filters, labels, layout, legend, lineStyles, markers, plotArea, scalarKey, seriesLabels, smallMultiplesLayout, subheader, totals, trend, valueAxis, xAxisReferenceLine, y1AxisReferenceLine, y2Axis, zoom
**tableEx** (76 props): accessibility, clustering, columnFormatting, columnHeaders, columnWidth, grid, sparklines, total, values
**textSlicer** (54 props): applyButton, inputText, inputTextBox, slicerSettings
**textbox** (5 props): text, values
**treemap** (31 props): categoryLabels, dataPoint, labels, layout, legend
**waterfallChart** (105 props): breakdown, categoryAxis, labels, legend, plotArea, sentimentColors, valueAxis, y1AxisReferenceLine

## Entity Types

Non-visual objects (report settings, page background, filter pane).
Use `pbir schema describe "entity.container"` for details.

**page**: background, outspace, outspacePane, pageSize, filterCard, pageInformation, pageRefresh, personalizeVisual
**report**: settings, outspacePane, section
**theme**: colors, textClasses
**filter_config**: shell
**bookmark_config**: options

## Summary

- 49 visual types
- 15 universal containers (detailed above)
- 12627 total property slots across all types
- Use `pbir schema describe` for type-specific property details
