# Cultures Scripts

Scripts for managing cultures and translations in Tabular models.

## Available Scripts

- `add-culture.csx` - Add a new culture to the model
- `delete-culture.csx` - Remove a culture from the model
- `list-cultures.csx` - List all cultures in the model
- `modify-translations.csx` - Update translations for objects

## Usage Examples

### Execute Inline
```bash
te script "model.bim" -e 'var culture = Model.AddCulture("es-ES"); culture.Name = "Spanish";' --save
```

### Execute Script File
```bash
te script "model.bim" -S samples/cultures/add-culture.csx --save
te script -s "Production" -d "Sales" -S samples/cultures/modify-translations.csx --save
```

### With Fabric CLI Workflow
```bash
# Export model
fab export "Workspace/Model.SemanticModel" -o ./model -f

# Add cultures
te script "./model/Model.SemanticModel/definition" -S samples/cultures/add-culture.csx --save

# Import back
fab import "Workspace/Model.SemanticModel" -i ./model/Model.SemanticModel -f
```

## Common Patterns

### Add Culture
```csharp
// Add Spanish culture
var culture = Model.AddCulture("es-ES");
culture.Name = "Spanish";
```

### Set Translations
```csharp
// Translate table name
var culture = Model.Cultures["es-ES"];
Model.Tables["Sales"].TranslatedNames[culture] = "Ventas";

// Translate column name
Model.Tables["Sales"].Columns["Amount"].TranslatedNames[culture] = "Cantidad";

// Translate measure
Model.Tables["Sales"].Measures["Total Sales"].TranslatedNames[culture] = "Ventas Totales";
```

### List All Cultures
```csharp
foreach(var culture in Model.Cultures) {
    Info("Culture: " + culture.Name + " (" + culture.LinguisticMetadata.Language + ")");
}
```

### Delete Culture
```csharp
var culture = Model.Cultures["es-ES"];
if(culture != null) {
    culture.Delete();
    Info("Deleted culture: es-ES");
}
```

### Bulk Translate Objects
```csharp
var culture = Model.Cultures["es-ES"];

// Translate all measures
foreach(var measure in Model.AllMeasures) {
    // Example: append " (ES)" to measure names
    measure.TranslatedNames[culture] = measure.Name + " (ES)";
}
```

## Property Reference

### Culture Properties
- `Name` - Culture name (e.g., "es-ES")
- `LinguisticMetadata.Language` - Language code
- `TranslatedNames` - Translation dictionary

### Translation Properties
- `TranslatedNames[culture]` - Get/set translated name
- `TranslatedDescriptions[culture]` - Get/set translated description
- `TranslatedDisplayFolders[culture]` - Get/set translated display folder

## Common Culture Codes

- `"en-US"` - English (United States)
- `"es-ES"` - Spanish (Spain)
- `"fr-FR"` - French (France)
- `"de-DE"` - German (Germany)
- `"it-IT"` - Italian (Italy)
- `"pt-BR"` - Portuguese (Brazil)
- `"ja-JP"` - Japanese (Japan)
- `"zh-CN"` - Chinese (Simplified)
- `"ko-KR"` - Korean (Korea)
- `"nl-NL"` - Dutch (Netherlands)

## Best Practices

1. **Add Cultures First**
   - Add all required cultures before adding translations
   - Use standard culture codes (e.g., "es-ES", not "spanish")
   - Provide culture name for clarity

2. **Systematic Translation**
   - Translate all visible objects
   - Keep translations consistent
   - Use professional translation services for production

3. **Testing**
   - Test with each culture in Power BI
   - Verify translations appear correctly
   - Check for truncation issues

4. **Maintenance**
   - Update translations when adding new objects
   - Document translation keys
   - Version control translation files

## See Also

- [Tables](../tables/)
- [Measures](../measures/)
- [Columns](../columns/)
