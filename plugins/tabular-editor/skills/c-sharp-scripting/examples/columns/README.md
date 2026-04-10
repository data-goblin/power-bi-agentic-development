# Columns Scripts

Scripts for managing columns in Tabular models.

## Available Scripts

- `add_calculated_column.csx` - Add calculated columns to tables
- `disable_summarization.csx` - Disable default summarization for columns
- `hide_key_columns.csx` - Hide key and ID columns across model
- `hide_keys.csx` - Hide key columns in specific tables
- `set_data_category.csx` - Set data categories for geographic columns
- `set-column-properties.csx` - Set multiple column properties at once
- `set-column-data-type.csx` - Change column data types
- `set-column-summarizeby.csx` - Configure aggregation behavior
- `set-column-sortby.csx` - Set sort-by columns
- `set-column-format-string.csx` - Apply format strings to columns
- `set-source-column.csx` - Map column to source
- `disable-available-in-mdx.csx` - Disable MDX availability
- `set-group-by-columns.csx` - Configure group-by columns
- `set-alignment.csx` - Set text alignment
- `set-is-key.csx` - Mark columns as keys
- `set-is-nullable.csx` - Configure null handling
- `set-is-unique.csx` - Mark unique columns
- `set-description.csx` - Add column descriptions
- `set-is-default-image.csx` - Set default image columns

## Usage Examples

### Execute Inline
```bash
te script "model.bim" -e 'foreach(var col in Model.AllColumns.Where(c => c.Name.EndsWith("ID"))) { col.IsHidden = true; }' --save
```

### Execute Script File
```bash
te script "model.bim" -S samples/columns/hide_key_columns.csx --save
te script -s "Production" -d "Sales" -S samples/columns/disable_summarization.csx --save
```

### With Fabric CLI Workflow
```bash
# Export model
fab export "Workspace/Model.SemanticModel" -o ./model -f

# Run column scripts
te script "./model/Model.SemanticModel/definition" -S samples/columns/hide_key_columns.csx --save
te script "./model/Model.SemanticModel/definition" -S samples/columns/set_data_category.csx --save

# Import back
fab import "Workspace/Model.SemanticModel" -i ./model/Model.SemanticModel -f
```

## Common Patterns

### Hide Key Columns
```csharp
foreach(var table in Model.Tables) {
    foreach(var column in table.Columns) {
        if(column.Name.EndsWith("Key") || column.Name.EndsWith("ID")) {
            column.IsHidden = true;
            column.SummarizeBy = AggregateFunction.None;
        }
    }
}
```

### Disable Summarization
```csharp
// Disable for all columns
foreach(var column in Model.AllColumns) {
    column.SummarizeBy = AggregateFunction.None;
}

// Only for text columns
foreach(var column in Model.AllColumns.Where(c => c.DataType == DataType.String)) {
    column.SummarizeBy = AggregateFunction.None;
}
```

### Set Data Categories
```csharp
// Mark geographic columns
Model.Tables["Geography"].Columns["Country"].DataCategory = "Country";
Model.Tables["Geography"].Columns["State"].DataCategory = "StateOrProvince";
Model.Tables["Geography"].Columns["City"].DataCategory = "City";
Model.Tables["Geography"].Columns["Postal Code"].DataCategory = "PostalCode";
```

### Add Calculated Column
```csharp
var table = Model.Tables["Sales"];
var col = table.AddCalculatedColumn("Full Name");
col.Expression = "[First Name] & \" \" & [Last Name]";
col.DataType = DataType.String;
col.IsHidden = false;
```

### Set Sort-By Column
```csharp
// Sort month names by month number
var monthName = Model.Tables["Date"].Columns["Month Name"];
var monthNumber = Model.Tables["Date"].Columns["Month Number"];
monthName.SortByColumn = monthNumber;
```

### Apply Format Strings
```csharp
// Format date columns
foreach(var col in Model.AllColumns.Where(c => c.DataType == DataType.DateTime)) {
    col.FormatString = "mm/dd/yyyy";
}

// Format currency columns
foreach(var col in Model.AllColumns.Where(c => c.Name.Contains("Amount"))) {
    col.FormatString = "$#,0.00";
}
```

## Property Reference

### Column Properties
- `Name` - Column name
- `Description` - Column description
- `DataType` - Data type (String, Int64, Double, DateTime, Boolean, etc.)
- `IsHidden` - Visibility flag
- `DisplayFolder` - Display folder path
- `FormatString` - Number/date format
- `DataCategory` - Data category (Country, City, WebUrl, ImageUrl, etc.)
- `SummarizeBy` - Default aggregation (None, Sum, Min, Max, Count, etc.)
- `SortByColumn` - Column used for sorting
- `IsKey` - Mark as key column
- `IsNullable` - Allow null values
- `IsUnique` - Mark as unique
- `Table` - Parent table reference

### Data Types
- `DataType.String` - Text
- `DataType.Int64` - Integer
- `DataType.Double` - Decimal
- `DataType.DateTime` - Date/time
- `DataType.Boolean` - True/false
- `DataType.Decimal` - Precise decimal

### Data Categories
- `"Country"` - Country names
- `"StateOrProvince"` - State/province
- `"City"` - City names
- `"PostalCode"` - Postal codes
- `"Continent"` - Continents
- `"WebUrl"` - Web URLs
- `"ImageUrl"` - Image URLs
- `"Latitude"` - Geographic latitude
- `"Longitude"` - Geographic longitude

### Aggregate Functions
- `AggregateFunction.None` - No aggregation
- `AggregateFunction.Sum` - Sum values
- `AggregateFunction.Count` - Count rows
- `AggregateFunction.Min` - Minimum value
- `AggregateFunction.Max` - Maximum value
- `AggregateFunction.Average` - Average value

## Best Practices

1. **Hide Technical Columns**
   - Hide all key/ID columns
   - Hide intermediate calculated columns
   - Use IsHidden to reduce clutter

2. **Disable Summarization**
   - Disable for text columns
   - Disable for key columns
   - Only enable for numeric measures

3. **Data Categories**
   - Use for geographic columns
   - Enables map visualizations
   - Use ImageUrl for image columns

4. **Sort-By Columns**
   - Sort month names by month number
   - Sort custom orderings
   - Improves user experience

## See Also

- [Tables](../tables/)
- [Measures](../measures/)
- [Format Strings](../format-strings/)
- [Display Folders](../display-folders/)
