// Create a standard time intelligence calculation group
// Requires a date table with a Date column

var cgName = "Time Intelligence";
var dateTableName = "Date";
var dateColumnName = "Date";

// Check date table exists
if(!Model.Tables.Contains(dateTableName)) {
    Error("Date table '" + dateTableName + "' not found");
}

// Check calc group doesn't exist
if(Model.CalculationGroups.Contains(cgName)) {
    Error("Calculation group '" + cgName + "' already exists");
}

var dateRef = "'" + dateTableName + "'[" + dateColumnName + "]";

// Create calculation group
var cg = Model.AddCalculationGroup(cgName);
cg.Precedence = 10;
cg.Description = "Standard time intelligence calculations";
cg.IsHidden = true;

// Current (passthrough)
var current = cg.AddCalculationItem("Current", "SELECTEDMEASURE()");
current.Ordinal = 0;

// Year-to-Date
var ytd = cg.AddCalculationItem("YTD");
ytd.Expression = "CALCULATE(SELECTEDMEASURE(), DATESYTD(" + dateRef + "))";
ytd.Ordinal = 1;

// Quarter-to-Date
var qtd = cg.AddCalculationItem("QTD");
qtd.Expression = "CALCULATE(SELECTEDMEASURE(), DATESQTD(" + dateRef + "))";
qtd.Ordinal = 2;

// Month-to-Date
var mtd = cg.AddCalculationItem("MTD");
mtd.Expression = "CALCULATE(SELECTEDMEASURE(), DATESMTD(" + dateRef + "))";
mtd.Ordinal = 3;

// Prior Year
var py = cg.AddCalculationItem("Prior Year");
py.Expression = "CALCULATE(SELECTEDMEASURE(), SAMEPERIODLASTYEAR(" + dateRef + "))";
py.Ordinal = 4;

// Prior Year YTD
var pyytd = cg.AddCalculationItem("PY YTD");
pyytd.Expression = @"
CALCULATE(
    SELECTEDMEASURE(),
    DATESYTD(SAMEPERIODLASTYEAR(" + dateRef + @"))
)
";
pyytd.Ordinal = 5;

// Year-over-Year %
var yoy = cg.AddCalculationItem("YoY %");
yoy.Expression = @"
VAR CurrentValue = SELECTEDMEASURE()
VAR PriorValue = CALCULATE(SELECTEDMEASURE(), SAMEPERIODLASTYEAR(" + dateRef + @"))
RETURN DIVIDE(CurrentValue - PriorValue, PriorValue)
";
yoy.FormatStringExpression = "\"0.00%\"";
yoy.Ordinal = 6;

// Format all items
foreach(var item in cg.CalculationItems) {
    item.FormatDax();
}

Info("Created calculation group: " + cgName + " with " + cg.CalculationItems.Count + " items");
