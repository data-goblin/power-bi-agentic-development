# Calculation Groups Scripts

Scripts for creating and managing calculation groups in Tabular models.

## Available Scripts

- `time_intelligence.csx` - Create time intelligence calculation group (YTD, MTD, QTD, YoY, etc.)
- `currency_conversion.csx` - Create currency conversion calculation group

## Usage Examples

### Execute Script File
```bash
te script "model.bim" -S samples/calculation-groups/time_intelligence.csx --save
te script -s "Production" -d "Sales" -S samples/calculation-groups/currency_conversion.csx --save
```

### Execute Inline
```bash
te script "model.bim" -e 'var cg = Model.AddCalculationGroup("Time Intelligence"); cg.AddCalculationItem("YTD", "CALCULATE(SELECTEDMEASURE(), DATESYTD(Date[Date]))");' --save
```

### With Fabric CLI Workflow
```bash
# Export model
fab export "Workspace/Model.SemanticModel" -o ./model -f

# Create calculation groups
te script "./model/Model.SemanticModel/definition" -S samples/calculation-groups/time_intelligence.csx --save

# Import back
fab import "Workspace/Model.SemanticModel" -i ./model/Model.SemanticModel -f
```

## Common Patterns

### Create Calculation Group with Items
```csharp
// Create calculation group
var cg = Model.AddCalculationGroup("Time Intelligence");
cg.Precedence = 10;
cg.Description = "Time intelligence calculations";

// Add calculation items
var ytd = cg.AddCalculationItem("YTD");
ytd.Expression = "CALCULATE(SELECTEDMEASURE(), DATESYTD('Date'[Date]))";
ytd.Ordinal = 0;

var mtd = cg.AddCalculationItem("MTD");
mtd.Expression = "CALCULATE(SELECTEDMEASURE(), DATESMTD('Date'[Date]))";
mtd.Ordinal = 1;
```

### Year-over-Year Calculation
```csharp
var yoy = cg.AddCalculationItem("YoY %");
yoy.Expression = @"
VAR CurrentValue = SELECTEDMEASURE()
VAR PriorValue = CALCULATE(SELECTEDMEASURE(), SAMEPERIODLASTYEAR('Date'[Date]))
RETURN
    DIVIDE(CurrentValue - PriorValue, PriorValue)
";
yoy.FormatString = "0.0%";
yoy.Ordinal = 5;
```

### Currency Conversion
```csharp
var cg = Model.AddCalculationGroup("Currency");
cg.Precedence = 20;

var usd = cg.AddCalculationItem("USD");
usd.Expression = "SELECTEDMEASURE()";

var eur = cg.AddCalculationItem("EUR");
eur.Expression = "SELECTEDMEASURE() * 0.85";
```

### Set Precedence
```csharp
// Lower precedence evaluates first
foreach(var cg in Model.CalculationGroups) {
    if(cg.Name == "Time Intelligence") {
        cg.Precedence = 10;
    }
    else if(cg.Name == "Currency") {
        cg.Precedence = 20;
    }
}
```

## Property Reference

### CalculationGroup Properties
- `Name` - Calculation group name
- `Description` - Description
- `Precedence` - Evaluation order (lower = first)
- `CalculationItems` - Collection of calculation items
- `AddCalculationItem(name, expression)` - Add new calculation item

### CalculationItem Properties
- `Name` - Item name
- `Expression` - DAX expression using SELECTEDMEASURE()
- `FormatString` - Optional format override
- `Ordinal` - Display order
- `Description` - Item description

## Best Practices

1. **Precedence**
   - Use lower precedence for time intelligence (e.g., 10)
   - Use higher precedence for formatting/currency (e.g., 20)
   - Leave gaps (10, 20, 30) for future additions

2. **SELECTEDMEASURE()**
   - Always use SELECTEDMEASURE() to reference the base measure
   - Use variables for clarity in complex calculations
   - Test with different base measures

3. **Format Strings**
   - Override format for percentage calculations
   - Maintain base measure format when not specified
   - Use FormatString property on calculation items

4. **Naming**
   - Use clear, concise names (YTD, MTD, PY)
   - Use consistent naming across calculation groups
   - Document complex calculations in descriptions

## See Also

- [Measures](../measures/)
- [Format Strings](../format-strings/)
- [Tables](../tables/)
