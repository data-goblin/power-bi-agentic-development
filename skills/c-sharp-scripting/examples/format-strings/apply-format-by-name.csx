// Name: Apply Format Strings by Name
// Context: Model
// Description: Applies appropriate format strings to measures based on naming patterns

var formattedCount = 0;

foreach(var m in Model.AllMeasures) {
    // Skip measures that already have format strings
    if(!string.IsNullOrEmpty(m.FormatString)) continue;

    var name = m.Name.ToLower();

    // Currency measures
    if(name.Contains("revenue") || name.Contains("sales") || name.Contains("cost") ||
       name.Contains("price") || name.Contains("amount") || name.Contains("$")) {
        m.FormatString = "$#,0";
        formattedCount++;
    }
    // Percentage measures
    else if(name.Contains("%") || name.Contains("percent") || name.Contains("rate") ||
            name.Contains("margin") || name.Contains("ratio")) {
        m.FormatString = "0.00%";
        formattedCount++;
    }
    // Count measures (no decimals)
    else if(name.StartsWith("# ") || name.Contains("count") || name.Contains("quantity") ||
            name.Contains("units")) {
        m.FormatString = "#,0";
        formattedCount++;
    }
    // Decimal measures
    else if(name.Contains("average") || name.Contains("avg") || name.Contains("mean")) {
        m.FormatString = "#,0.00";
        formattedCount++;
    }
}

Info("Applied format strings to " + formattedCount + " measures");
