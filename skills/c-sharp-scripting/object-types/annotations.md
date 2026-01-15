# Annotations

Annotations store custom metadata on model objects. They are key-value pairs that can be used to track information not represented in standard properties.


## What Are Annotations?

Annotations are string key-value pairs attached to model objects:
- Not visible to end users in Power BI
- Persist with the model
- Useful for automation, documentation, tooling
- Used by Power BI for internal metadata (e.g., field parameters)


## Basic Operations

### Get Annotation

```csharp
// Get annotation value (returns null if not exists)
var value = measure.GetAnnotation("Owner");

// Check if annotation exists
if(measure.GetAnnotation("Owner") != null) {
    Info("Has owner annotation");
}
```

### Set Annotation

```csharp
// Set annotation (creates if not exists, updates if exists)
measure.SetAnnotation("Owner", "Finance Team");
measure.SetAnnotation("LastReviewed", DateTime.Now.ToString("yyyy-MM-dd"));
measure.SetAnnotation("Priority", "High");
```

### Remove Annotation

```csharp
// Remove annotation
measure.RemoveAnnotation("Owner");

// Set to null also removes
measure.SetAnnotation("Owner", null);
```


## Objects That Support Annotations

Most TOM objects support annotations:
- Model
- Tables
- Columns
- Measures
- Relationships
- Roles
- Partitions
- Hierarchies
- Levels
- Calculation Groups
- Calculation Items
- Perspectives
- Cultures
- Expressions (M queries)


## Common Use Cases

### Track Ownership

```csharp
// Tag measures by owner
foreach(var m in Model.Tables["Finance"].Measures) {
    m.SetAnnotation("Owner", "Finance Team");
    m.SetAnnotation("Contact", "finance@company.com");
}
```

### Mark for Review

```csharp
// Flag measures needing review
foreach(var m in Model.AllMeasures.Where(m => string.IsNullOrEmpty(m.Description))) {
    m.SetAnnotation("NeedsReview", "true");
    m.SetAnnotation("ReviewReason", "Missing description");
}
```

### Version Tracking

```csharp
// Track when objects were last modified
Model.SetAnnotation("LastModified", DateTime.Now.ToString("o"));
Model.SetAnnotation("ModifiedBy", "automation");
Model.SetAnnotation("Version", "1.2.3");
```

### Tag for Automation

```csharp
// Tag measures for automated testing
foreach(var m in Model.AllMeasures.Where(m => m.Name.StartsWith("KPI"))) {
    m.SetAnnotation("AutoTest", "true");
    m.SetAnnotation("TestType", "KPI_Validation");
}
```


## Power BI Internal Annotations

Power BI uses annotations for internal features. Common examples:

### Field Parameters

```csharp
// Field parameter column has this annotation
column.SetExtendedProperty(
    "ParameterMetadata",
    "{\"version\":3,\"kind\":2}",
    ExtendedPropertyType.Json
);
```

### PBI ResultType (M Expressions)

```csharp
// Mark M expression as function
var expr = Model.Expressions["MyFunction"];
expr.SetAnnotation("PBI_ResultType", "Function");
```

### Data Category

```csharp
// Some internal features use annotations for data categories
table.SetAnnotation("PBI_NavigationStepName", "Navigation");
```

**Warning:** Don't modify PBI_ prefixed annotations unless you understand their purpose.


## Common Patterns

### Audit Annotations

```csharp
var report = new System.Text.StringBuilder();
report.AppendLine("Annotation Audit");
report.AppendLine("================");

foreach(var m in Model.AllMeasures) {
    // GetAnnotations() returns all annotations
    var annotations = m.GetAnnotations();
    if(annotations.Any()) {
        report.AppendLine($"\n{m.DaxObjectFullName}:");
        foreach(var ann in annotations) {
            report.AppendLine($"  {ann.Key} = {ann.Value}");
        }
    }
}

Output(report.ToString());
```

### Find Objects by Annotation

```csharp
// Find all measures needing review
var needsReview = Model.AllMeasures
    .Where(m => m.GetAnnotation("NeedsReview") == "true");

foreach(var m in needsReview) {
    Info($"Needs review: {m.DaxObjectFullName}");
}
```

### Bulk Set Annotations

```csharp
// Set deployment metadata on all tables
var deployDate = DateTime.Now.ToString("yyyy-MM-dd");
var deployVersion = "2.1.0";

foreach(var t in Model.Tables) {
    t.SetAnnotation("DeployedOn", deployDate);
    t.SetAnnotation("DeployVersion", deployVersion);
}
```

### Copy Annotations Between Objects

```csharp
var source = Model.Tables["Sales"].Measures["Revenue"];
var target = Model.Tables["Sales"].Measures["Revenue YTD"];

// Copy relevant annotations
var annotationsToCopy = new[] { "Owner", "Contact", "Category" };
foreach(var key in annotationsToCopy) {
    var value = source.GetAnnotation(key);
    if(value != null) {
        target.SetAnnotation(key, value);
    }
}
```

### Clear All Custom Annotations

```csharp
// Remove non-PBI annotations from measures
foreach(var m in Model.AllMeasures) {
    var annotations = m.GetAnnotations().ToList();
    foreach(var ann in annotations) {
        // Preserve Power BI internal annotations
        if(!ann.Key.StartsWith("PBI_")) {
            m.RemoveAnnotation(ann.Key);
        }
    }
}
```


## Extended Properties

Extended properties are similar to annotations but typed (JSON, String).

```csharp
// Set extended property (used for field parameters)
column.SetExtendedProperty("MyProperty", "{\"key\":\"value\"}", ExtendedPropertyType.Json);
column.SetExtendedProperty("MyString", "some value", ExtendedPropertyType.String);

// Get extended property
var value = column.GetExtendedProperty("MyProperty");
```


## Best Practices

1. **Use consistent naming** - Establish annotation key conventions (e.g., PascalCase)
2. **Don't modify PBI_ annotations** - These are internal to Power BI
3. **Document annotation meanings** - Track what each annotation key represents
4. **Use for metadata only** - Don't store large data in annotations
5. **Consider using JSON** - For structured annotation values
6. **Clean up obsolete annotations** - Remove annotations no longer needed
7. **Namespace custom annotations** - e.g., "MyCompany_Owner" to avoid conflicts
