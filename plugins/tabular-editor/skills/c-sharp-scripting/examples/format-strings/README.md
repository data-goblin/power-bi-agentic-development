# Format Strings Scripts

Scripts for applying number and date format strings to measures and columns.

## Available Scripts

- `apply_format_by_name.csx` - Apply formats based on object name patterns
- `apply_format_by_pattern.csx` - Apply formats using pattern matching
- `custom_format_millions.csx` - Create custom millions/billions format
- `format_strings.csx` - Apply standard format strings to measures

## Usage Examples

### Execute Inline
```bash
te script "model.bim" -e 'foreach(var m in Model.AllMeasures.Where(m => m.Name.Contains("Amount"))) { m.FormatString = "$#,0.00"; }' --save
```

### Execute Script File
```bash
te script "model.bim" -S samples/format-strings/apply_format_by_pattern.csx --save
te script -s "Production" -d "Sales" -S samples/format-strings/custom_format_millions.csx --save
```

### With Fabric CLI Workflow
```bash
# Export model
fab export "Workspace/Model.SemanticModel" -o ./model -f

# Apply format strings
te script "./model/Model.SemanticModel/definition" -S samples/format-strings/apply_format_by_pattern.csx --save

# Import back
fab import "Workspace/Model.SemanticModel" -i ./model/Model.SemanticModel -f
```

## Common Patterns

### Apply Format by Name Pattern
```csharp
// Currency formats
foreach(var measure in Model.AllMeasures.Where(m =>
    m.Name.Contains("Amount") ||
    m.Name.Contains("Revenue") ||
    m.Name.Contains("Cost"))) {
    measure.FormatString = "$#,0.00";
}

// Percentage formats
foreach(var measure in Model.AllMeasures.Where(m =>
    m.Name.Contains("%") ||
    m.Name.Contains("Percent") ||
    m.Name.Contains("Rate"))) {
    measure.FormatString = "0.00%";
}

// Integer formats
foreach(var measure in Model.AllMeasures.Where(m =>
    m.Name.Contains("Count") ||
    m.Name.Contains("Quantity"))) {
    measure.FormatString = "#,0";
}
```

### Custom Millions Format
```csharp
// Display as millions with "M" suffix
var millionsFormat = "#,0.0,, \"M\"";

foreach(var measure in Model.AllMeasures.Where(m =>
    m.Name.Contains("Revenue") ||
    m.Name.Contains("Sales"))) {
    measure.FormatString = millionsFormat;
}
```

### Conditional Format Strings
```csharp
// Positive/Negative/Zero formats
var conditionalFormat = "#,0;-#,0;0";

// With colors (requires special syntax)
var colorFormat = "#,0;[Red]-#,0;0";

// Currency with conditional
var currencyConditional = "$#,0.00;-$#,0.00;$0.00";
```

### Date Formats
```csharp
// Apply date formats to date columns
foreach(var column in Model.AllColumns.Where(c => c.DataType == DataType.DateTime)) {
    if(column.Name.Contains("Date")) {
        column.FormatString = "mm/dd/yyyy";
    }
    else if(column.Name.Contains("Time")) {
        column.FormatString = "hh:mm:ss";
    }
}
```

## Format String Reference

### Currency Formats
- `"$#,0"` - Dollar, no decimals (e.g., $1,234)
- `"$#,0.00"` - Dollar, 2 decimals (e.g., $1,234.56)
- `"$#,0.00;($#,0.00)"` - Dollar with parentheses for negative
- `"€#,0.00"` - Euro format
- `"£#,0.00"` - Pound format

### Percentage Formats
- `"0%"` - Whole percent (e.g., 12%)
- `"0.0%"` - 1 decimal (e.g., 12.3%)
- `"0.00%"` - 2 decimals (e.g., 12.34%)

### Number Formats
- `"#,0"` - Integer with thousands separator
- `"#,0.00"` - 2 decimal places
- `"0.000"` - 3 decimal places, always show
- `"#,##0"` - Standard number format

### Abbreviated Formats
- `"#,0.0,, \"M\""` - Millions (1,234.5 M)
- `"#,0.0,,, \"B\""` - Billions (1.2 B)
- `"#,0, \"K\""` - Thousands (1,234 K)

### Date/Time Formats
- `"mm/dd/yyyy"` - US date (01/31/2024)
- `"dd/mm/yyyy"` - European date (31/01/2024)
- `"yyyy-mm-dd"` - ISO date (2024-01-31)
- `"mmmm yyyy"` - Month year (January 2024)
- `"hh:mm:ss"` - Time (14:30:00)

### Conditional Formats
- `"#,0;-#,0;0"` - Positive;Negative;Zero
- `"#,0;[Red]-#,0;0"` - With color coding
- `"$#,0.00;($#,0.00);-"` - Currency with parentheses

## Best Practices

1. **Consistent Formats**
   - Use same format for similar measures
   - Document format standards
   - Apply formats systematically

2. **Naming Conventions**
   - Use names that indicate format type
   - Group measures by format needs
   - Make format obvious from name

3. **User Experience**
   - Choose appropriate precision
   - Use abbreviations for large numbers
   - Consider locale/culture

4. **Testing**
   - Test formats with real data
   - Verify in Power BI reports
   - Check edge cases (zero, negative, large values)

## See Also

- [Measures](../measures/)
- [Columns](../columns/)
- [Bulk Operations](../bulk-operations/)
