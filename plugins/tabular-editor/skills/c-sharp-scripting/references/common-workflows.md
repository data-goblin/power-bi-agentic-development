# Common C# Script Workflows

Frequently used script patterns for Tabular Editor.

## Bulk Format Measures

```csharp
var count = 0;
foreach(var m in Model.AllMeasures) {
    if(!string.IsNullOrEmpty(m.Expression)) {
        m.FormatDax();
        count++;
    }
}
Info("Formatted " + count + " measures");
```

## Create Time Intelligence Measures

```csharp
var baseMeasure = Model.Tables["Metrics"].Measures["Sales Amount"];
var table = baseMeasure.Table;

var ytd = table.AddMeasure(
    baseMeasure.Name + " YTD",
    "CALCULATE([" + baseMeasure.Name + "], DATESYTD('Date'[Date]))"
);
ytd.FormatString = baseMeasure.FormatString;
ytd.DisplayFolder = "Time Intelligence";

var py = table.AddMeasure(
    baseMeasure.Name + " PY",
    "CALCULATE([" + baseMeasure.Name + "], SAMEPERIODLASTYEAR('Date'[Date]))"
);
py.FormatString = baseMeasure.FormatString;
py.DisplayFolder = "Time Intelligence";

Info("Created time intelligence measures");
```

## Configure RLS

```csharp
var role = Model.AddRole("Regional Access");
role.ModelPermission = ModelPermission.Read;

// Add table filter
var salesPerm = role.TablePermissions.Find("Sales");
if(salesPerm == null) {
    salesPerm = role.AddTablePermission(Model.Tables["Sales"]);
}
salesPerm.FilterExpression = "[Region] = USERNAME()";

Info("Configured RLS for " + role.Name);
```

## Audit Hidden Objects

```csharp
var hidden = new System.Text.StringBuilder();
hidden.AppendLine("Hidden Objects Report:");

foreach(var t in Model.Tables.Where(t => t.IsHidden)) {
    hidden.AppendLine("  Table: " + t.Name);
}

foreach(var c in Model.AllColumns.Where(c => c.IsHidden && !c.Table.IsHidden)) {
    hidden.AppendLine("  Column: " + c.DaxObjectFullName);
}

foreach(var m in Model.AllMeasures.Where(m => m.IsHidden)) {
    hidden.AppendLine("  Measure: " + m.DaxObjectFullName);
}

Output(hidden.ToString());
```
