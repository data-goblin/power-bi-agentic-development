// Move Selected Measures to Display Folder
// Demonstrates: Selected object, SelectObject for folder choice

// Check if measures are selected
if (!Selected.Measures.Any())
{
    Error("Please select one or more measures first");
    return;
}

// Get unique existing display folders
var existingFolders = Model.AllMeasures
    .Select(m => m.DisplayFolder)
    .Where(f => !string.IsNullOrEmpty(f))
    .Distinct()
    .OrderBy(f => f)
    .ToList();

// Let user pick or enter folder
string targetFolder;

if (existingFolders.Any())
{
    // Show selection dialog
    var options = new List<string> { "<New Folder>" };
    options.AddRange(existingFolders);

    var selected = SelectObject(options, null, "Select target display folder:");

    if (selected == "<New Folder>")
    {
        // In real script, you'd use a WinForms input dialog here
        targetFolder = "New Folder";
    }
    else
    {
        targetFolder = selected;
    }
}
else
{
    targetFolder = "Measures";
}

// Apply to selected measures
var count = 0;
foreach (var m in Selected.Measures)
{
    m.DisplayFolder = targetFolder;
    count++;
}

Info($"Moved {count} measure(s) to folder: {targetFolder}");
