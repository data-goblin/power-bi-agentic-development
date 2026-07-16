# KPIs Scripts

Scripts for managing Key Performance Indicators (KPIs) in Tabular models.

## Available Scripts

- `add-kpi.csx` - Create a new KPI
- `delete-kpi.csx` - Remove a KPI
- `list-kpis.csx` - List all KPIs in the model
- `modify-kpi.csx` - Update KPI properties
- `NOTE.md` - Additional documentation

## Usage Examples

### Execute Inline
```bash
te script "model.bim" -e 'var m = Model.Tables["Sales"].Measures["Total Sales"]; m.KPI.TargetExpression = "[Sales Target]"; m.KPI.StatusGraphic = "Traffic Light";' --save
```

### Execute Script File
```bash
te script "model.bim" -S samples/kpis/add-kpi.csx --save
te script -s "Production" -d "Sales" -S samples/kpis/list-kpis.csx
```

### With Fabric CLI Workflow
```bash
# Export model
fab export "Workspace/Model.SemanticModel" -o ./model -f

# Create KPIs
te script "./model/Model.SemanticModel/definition" -S samples/kpis/add-kpi.csx --save

# Import back
fab import "Workspace/Model.SemanticModel" -i ./model/Model.SemanticModel -f
```

## Common Patterns

### Create Basic KPI
```csharp
var measure = Model.Tables["Sales"].Measures["Total Sales"];

// Create KPI
var kpi = measure.KPI;
kpi.TargetExpression = "[Sales Target]";
kpi.StatusExpression = @"
VAR Ratio = DIVIDE([Total Sales], [Sales Target], 0)
RETURN
    SWITCH(
        TRUE(),
        Ratio >= 1, 1,
        Ratio >= 0.9, 0,
        -1
    )
";
kpi.StatusGraphic = "Traffic Light - Single";
```

### Set KPI with Trend
```csharp
var measure = Model.Tables["Sales"].Measures["Revenue"];
var kpi = measure.KPI;

// Target
kpi.TargetExpression = "[Revenue Target]";

// Status
kpi.StatusExpression = @"
IF([Revenue] >= [Revenue Target], 1, -1)
";
kpi.StatusGraphic = "Traffic Light - Single";

// Trend
kpi.TrendExpression = @"
VAR CurrentRevenue = [Revenue]
VAR PriorRevenue = CALCULATE([Revenue], DATEADD('Date'[Date], -1, MONTH))
RETURN
    IF(CurrentRevenue > PriorRevenue, 1,
       IF(CurrentRevenue = PriorRevenue, 0, -1))
";
kpi.TrendGraphic = "Standard Arrow";
```

### List All KPIs
```csharp
foreach(var measure in Model.AllMeasures.Where(m => m.KPI != null)) {
    Info($"KPI: {measure.Name}");
    Info($"  Target: {measure.KPI.TargetExpression}");
    Info($"  Status: {measure.KPI.StatusGraphic}");
}
```

### Delete KPI
```csharp
var measure = Model.Tables["Sales"].Measures["Total Sales"];
if(measure.KPI != null) {
    measure.RemoveKPI();
    Info("KPI removed from measure");
}
```

## Property Reference

### KPI Properties
- `TargetExpression` - DAX expression for target value
- `TargetDescription` - Description of target
- `TargetFormatString` - Format string for target
- `StatusExpression` - DAX expression for status (-1, 0, 1)
- `StatusDescription` - Description of status
- `StatusGraphic` - Visual indicator type
- `TrendExpression` - DAX expression for trend (-1, 0, 1)
- `TrendDescription` - Description of trend
- `TrendGraphic` - Visual indicator type

### Status/Trend Graphics
- `"Traffic Light - Single"` - Single traffic light
- `"Traffic Light"` - Three traffic lights
- `"Road Signs"` - Road sign indicators
- `"Traffic Light Quad"` - Four traffic lights
- `"Standard Arrow"` - Arrow indicator
- `"Status Arrow - Ascending"` - Ascending arrow
- `"Status Arrow - Descending"` - Descending arrow
- `"Shapes"` - Shape indicators
- `"Variance Arrow"` - Variance arrow
- `"Cylinder"` - Cylinder indicator
- `"Faces"` - Smiley face indicator
- `"Thermometer"` - Thermometer

### Status/Trend Values
- `1` - Good/Positive (Green/Up)
- `0` - Neutral/Flat (Yellow/Flat)
- `-1` - Bad/Negative (Red/Down)

## Common Patterns

### Sales KPI with Target
```csharp
var salesMeasure = Model.Tables["Sales"].Measures["Total Sales"];
var kpi = salesMeasure.KPI;

kpi.TargetExpression = "[Sales Target]";
kpi.StatusExpression = @"
VAR PercentOfTarget = DIVIDE([Total Sales], [Sales Target], 0)
RETURN
    SWITCH(
        TRUE(),
        PercentOfTarget >= 1.0, 1,   // Green
        PercentOfTarget >= 0.9, 0,   // Yellow
        -1                            // Red
    )
";
kpi.StatusGraphic = "Traffic Light - Single";
```

### Performance KPI with Trend
```csharp
var perfMeasure = Model.Tables["Performance"].Measures["Efficiency"];
var kpi = perfMeasure.KPI;

kpi.TargetExpression = "0.95";  // 95% target

kpi.StatusExpression = @"
IF([Efficiency] >= 0.95, 1,
   IF([Efficiency] >= 0.85, 0, -1))
";

kpi.TrendExpression = @"
VAR Current = [Efficiency]
VAR Prior = CALCULATE([Efficiency], PREVIOUSMONTH('Date'[Date]))
RETURN
    IF(Current > Prior, 1,
       IF(Current = Prior, 0, -1))
";

kpi.StatusGraphic = "Shapes";
kpi.TrendGraphic = "Standard Arrow";
```

## Best Practices

1. **Target Definition**
   - Use measures for dynamic targets
   - Use constants for fixed targets
   - Document target calculation logic

2. **Status Thresholds**
   - Define clear threshold ranges
   - Use consistent logic across KPIs
   - Document threshold rationale

3. **Trend Calculation**
   - Compare to relevant period
   - Handle missing data gracefully
   - Use consistent trend logic

4. **Graphics Selection**
   - Choose appropriate visual indicators
   - Use consistent graphics across similar KPIs
   - Consider user familiarity

## See Also

- [Measures](../measures/)
- [Calculation Groups](../calculation-groups/)
- [Format Strings](../format-strings/)
