// Name: Create Time Intelligence Measures
// Context: Measure
// Description: Creates YTD, PY, and YoY measures for selected measures

// Configuration
var dateTableName = "Date";
var dateColumnName = "Date";
var dateRef = "'" + dateTableName + "'[" + dateColumnName + "]";

// Validation
if(!Model.Tables.Contains(dateTableName)) {
    Error("Date table not found: " + dateTableName);
}

if(Selected.Measures.Count == 0) {
    Error("Please select at least one measure");
}

var createdCount = 0;

foreach(var m in Selected.Measures) {
    var table = m.Table;
    var baseName = m.Name;
    var baseRef = m.DaxObjectFullName;

    // Year-to-Date
    var ytd = table.AddMeasure(
        baseName + " YTD",
        "CALCULATE(" + baseRef + ", DATESYTD(" + dateRef + "))"
    );
    ytd.FormatString = m.FormatString;
    ytd.DisplayFolder = "Time Intelligence";
    createdCount++;

    // Prior Year
    var py = table.AddMeasure(
        baseName + " PY",
        "CALCULATE(" + baseRef + ", SAMEPERIODLASTYEAR(" + dateRef + "))"
    );
    py.FormatString = m.FormatString;
    py.DisplayFolder = "Time Intelligence";
    createdCount++;

    // Year-over-Year %
    var yoy = table.AddMeasure(
        baseName + " YoY %",
        @"
VAR CurrentValue = " + baseRef + @"
VAR PriorValue = CALCULATE(" + baseRef + ", SAMEPERIODLASTYEAR(" + dateRef + @"))
RETURN DIVIDE(CurrentValue - PriorValue, PriorValue)
"
    );
    yoy.FormatString = "0.00%";
    yoy.DisplayFolder = "Time Intelligence";
    createdCount++;
}

// Format all new measures
Model.AllMeasures
    .Where(m => m.DisplayFolder == "Time Intelligence")
    .ForEach(m => m.FormatDax());

Info("Created " + createdCount + " time intelligence measures");
