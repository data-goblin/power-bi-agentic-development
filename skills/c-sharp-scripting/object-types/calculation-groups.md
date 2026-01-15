# Calculation Groups

Calculation groups apply dynamic calculations (time intelligence, currency conversion, etc.) across all measures.

## Concepts

- **Calculation Group** - A special table containing calculation items
- **Calculation Item** - A DAX expression using `SELECTEDMEASURE()` to transform any measure
- **Precedence** - Order of evaluation when multiple calculation groups apply

## Key Properties

### Calculation Group (Table)

| Property | Type | Description |
|----------|------|-------------|
| `Name` | string | Calculation group name |
| `Precedence` | int | Evaluation order (lower = earlier) |
| `Description` | string | Documentation text |
| `CalculationItems` | Collection | Items in the group |
| `Columns` | Collection | Contains the Name column |

### Calculation Item

| Property | Type | Description |
|----------|------|-------------|
| `Name` | string | Item name (displays in slicers) |
| `Expression` | string | DAX formula using `SELECTEDMEASURE()` |
| `FormatStringExpression` | string | Dynamic format string (optional) |
| `Description` | string | Documentation text |
| `Ordinal` | int | Sort order in group |

## Common Methods

| Method | Description |
|--------|-------------|
| `Model.AddCalculationGroup(name)` | Create new calculation group |
| `CalcGroup.AddCalculationItem(name)` | Add item with empty expression |
| `CalcGroup.AddCalculationItem(name, expression)` | Add item with DAX |
| `CalculationItem.Delete()` | Remove calculation item |
| `CalcGroup.Delete()` | Remove entire calculation group |

## Access Patterns

```csharp
// All calculation groups
foreach(var cg in Model.CalculationGroups) { }

// All items in a group
var timeIntel = Model.CalculationGroups["Time Intelligence"];
foreach(var item in timeIntel.CalculationItems) { }

// Check existence
if(Model.CalculationGroups.Contains("Time Intelligence")) { }
```

## CRUD Operations

### Create Calculation Group
```csharp
var cg = Model.AddCalculationGroup("Time Intelligence");
cg.Precedence = 10;
cg.Description = "Standard time intelligence calculations";
cg.IsHidden = true;  // Hide from report view
```

### Add Calculation Items
```csharp
// Current period (passthrough)
var current = cg.AddCalculationItem("Current", "SELECTEDMEASURE()");
current.Ordinal = 0;

// Year-to-Date
var ytd = cg.AddCalculationItem("YTD");
ytd.Expression = @"
CALCULATE(
    SELECTEDMEASURE(),
    DATESYTD('Date'[Date])
)
";
ytd.Ordinal = 1;

// Prior Year
var py = cg.AddCalculationItem("Prior Year");
py.Expression = @"
CALCULATE(
    SELECTEDMEASURE(),
    SAMEPERIODLASTYEAR('Date'[Date])
)
";
py.Ordinal = 2;

// Year-over-Year %
var yoy = cg.AddCalculationItem("YoY %");
yoy.Expression = @"
VAR CurrentValue = SELECTEDMEASURE()
VAR PriorValue = CALCULATE(SELECTEDMEASURE(), SAMEPERIODLASTYEAR('Date'[Date]))
RETURN DIVIDE(CurrentValue - PriorValue, PriorValue)
";
yoy.FormatStringExpression = "\"0.00%\"";
yoy.Ordinal = 3;
```

### Update Calculation Item
```csharp
var item = cg.CalculationItems["YTD"];
item.Expression = "CALCULATE(SELECTEDMEASURE(), DATESYTD('Date'[Date]))";
item.Description = "Year-to-date accumulation";
```

### Delete
```csharp
// Delete single item
cg.CalculationItems["Old Item"].Delete();

// Delete entire group
Model.CalculationGroups["Old Group"].Delete();
```

## Common Patterns

### Time Intelligence Group
```csharp
var cg = Model.AddCalculationGroup("Time Intelligence");
cg.Precedence = 10;

cg.AddCalculationItem("Current", "SELECTEDMEASURE()").Ordinal = 0;
cg.AddCalculationItem("YTD", "CALCULATE(SELECTEDMEASURE(), DATESYTD('Date'[Date]))").Ordinal = 1;
cg.AddCalculationItem("QTD", "CALCULATE(SELECTEDMEASURE(), DATESQTD('Date'[Date]))").Ordinal = 2;
cg.AddCalculationItem("MTD", "CALCULATE(SELECTEDMEASURE(), DATESMTD('Date'[Date]))").Ordinal = 3;
cg.AddCalculationItem("PY", "CALCULATE(SELECTEDMEASURE(), SAMEPERIODLASTYEAR('Date'[Date]))").Ordinal = 4;
```

### Currency Conversion Group
```csharp
var cg = Model.AddCalculationGroup("Currency");
cg.Precedence = 20;  // Higher than time intelligence

cg.AddCalculationItem("Local", "SELECTEDMEASURE()").Ordinal = 0;

var converted = cg.AddCalculationItem("Converted");
converted.Expression = @"
SELECTEDMEASURE() *
SELECTEDVALUE(
    ExchangeRates[Rate],
    1
)
";
converted.Ordinal = 1;
```

### Format All Items
```csharp
foreach(var cg in Model.CalculationGroups) {
    foreach(var item in cg.CalculationItems) {
        item.FormatDax();
    }
}
```

### List All Calculation Items
```csharp
foreach(var cg in Model.CalculationGroups) {
    Info("Group: " + cg.Name + " (Precedence: " + cg.Precedence + ")");
    foreach(var item in cg.CalculationItems.OrderBy(i => i.Ordinal)) {
        Info("  - " + item.Name);
    }
}
```

## Precedence Guidelines

| Range | Use Case |
|-------|----------|
| 1-10 | Core time intelligence |
| 11-20 | Currency conversion |
| 21-30 | Comparison calculations |
| 31+ | Presentation/formatting |

Lower precedence values are evaluated first.

## Best Practices

1. **Hide calc groups** - Set IsHidden = true to avoid confusion
2. **Include Current/Default** - Always have a passthrough item
3. **Set Ordinal** - Control sort order in slicers
4. **Use precedence wisely** - Order matters for combined calculations
5. **Document with Description** - Explain complex expressions
6. **Format DAX** - Use FormatDax() for readability

## Reference Examples

See `samples/calculation-groups/` for working examples.
