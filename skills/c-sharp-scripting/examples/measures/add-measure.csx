// Add a single measure to a table
// Usage: Adapt table name, measure name, and expression

var tableName = "Sales";
var measureName = "Total Sales";
var expression = "SUM(Sales[Amount])";
var formatString = "$#,0";
var displayFolder = "Key Metrics";
var description = "Total sales amount";

// Validate table exists
if(!Model.Tables.Contains(tableName)) {
    Error("Table '" + tableName + "' not found");
}

var table = Model.Tables[tableName];

// Check measure doesn't already exist
if(table.Measures.Contains(measureName)) {
    Error("Measure '" + measureName + "' already exists");
}

// Create measure
var m = table.AddMeasure(measureName, expression);
m.FormatString = formatString;
m.DisplayFolder = displayFolder;
m.Description = description;
m.FormatDax();

Info("Created measure: " + m.Name);
