// Name: Initialize Model
// Context: Model
// Description: Common initialization tasks: hide keys, disable summarization, create base measures

// Step 1: Hide all key columns
var hiddenCount = 0;
foreach(var table in Model.Tables) {
    foreach(var column in table.Columns) {
        if(column.Name.Contains("Key") || column.Name.EndsWith("ID")) {
            column.IsHidden = true;
            hiddenCount++;
        }
        // Disable summarization for all columns
        column.SummarizeBy = AggregateFunction.None;
    }
}
Info("Step 1: Hidden " + hiddenCount + " key columns, disabled summarization");

// Step 2: Set format strings by pattern
foreach(var m in Model.AllMeasures) {
    var name = m.Name.ToLower();
    if(name.Contains("sales") || name.Contains("revenue") || name.Contains("amount"))
        m.FormatString = "$#,0";
    else if(name.Contains("%") || name.Contains("rate") || name.Contains("margin"))
        m.FormatString = "0.00%";
    else if(name.Contains("count") || name.Contains("quantity"))
        m.FormatString = "#,0";
}
Info("Step 2: Applied format strings");

// Step 3: Format all DAX
Model.AllMeasures.FormatDax();
Info("Step 3: Formatted DAX");

Info("Model initialization complete!");
