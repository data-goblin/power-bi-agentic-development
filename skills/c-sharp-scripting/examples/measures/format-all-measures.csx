// Format DAX in all measures across the model

var count = 0;
var errors = new System.Collections.Generic.List<string>();

foreach(var m in Model.AllMeasures) {
    try {
        m.FormatDax();
        count++;
    }
    catch(Exception ex) {
        errors.Add(m.DaxObjectFullName + ": " + ex.Message);
    }
}

Info("Formatted " + count + " measures");

if(errors.Count > 0) {
    Warning("Errors in " + errors.Count + " measures:");
    foreach(var err in errors) {
        Warning("  " + err);
    }
}
