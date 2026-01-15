// Name: Organize Measures by Type
// Context: Model
// Description: Organizes measures into display folders based on naming patterns

var organizedCount = 0;

foreach(var m in Model.AllMeasures) {
    // Time Intelligence measures
    if(m.Name.Contains(" YTD") || m.Name.Contains(" MTD") || m.Name.Contains(" QTD") ||
       m.Name.Contains(" PY") || m.Name.Contains(" YoY")) {
        m.DisplayFolder = "Time Intelligence";
        organizedCount++;
    }
    // Percentage/Ratio measures
    else if(m.Name.Contains("%") || m.Name.Contains("Percent") || m.Name.Contains("Rate")) {
        m.DisplayFolder = "Ratios";
        organizedCount++;
    }
    // Count measures
    else if(m.Name.StartsWith("# ") || m.Name.Contains("Count")) {
        m.DisplayFolder = "Counts";
        organizedCount++;
    }
    // Average measures
    else if(m.Name.Contains("Avg") || m.Name.Contains("Average")) {
        m.DisplayFolder = "Averages";
        organizedCount++;
    }
    // Sum measures
    else if(m.Name.Contains("Sum") || m.Name.Contains("Total")) {
        m.DisplayFolder = "Totals";
        organizedCount++;
    }
}

Info("Organized " + organizedCount + " measures into display folders");
