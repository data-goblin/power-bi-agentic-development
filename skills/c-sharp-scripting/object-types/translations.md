# Translations (Cultures)

Translations allow localizing model metadata for different languages. Each culture defines translated names, descriptions, and display folders for model objects.


## Accessing Cultures

```csharp
// All cultures in model
var cultures = Model.Cultures;

// Specific culture
var german = Model.Cultures["de-DE"];

// Check if culture exists
if(Model.Cultures.Contains("de-DE")) {
    var culture = Model.Cultures["de-DE"];
}
```


## Creating Cultures

```csharp
// Add new culture
var culture = Model.AddCulture("de-DE");  // German (Germany)
var culture = Model.AddCulture("fr-FR");  // French (France)
var culture = Model.AddCulture("es-ES");  // Spanish (Spain)
var culture = Model.AddCulture("ja-JP");  // Japanese
```


## Culture Properties

| Property | Type | Description |
|----------|------|-------------|
| `Name` | string | Culture code (e.g., "de-DE") |
| `ObjectTranslations` | Collection | All translations in this culture |


## Setting Translations

Objects have three translation properties:
- `TranslatedNames[culture]` - Localized name
- `TranslatedDescriptions[culture]` - Localized description
- `TranslatedDisplayFolders[culture]` - Localized folder path

### Table Translations

```csharp
var table = Model.Tables["Sales"];
table.TranslatedNames["de-DE"] = "Verkauf";
table.TranslatedDescriptions["de-DE"] = "Verkaufstransaktionen";
```

### Column Translations

```csharp
var column = Model.Tables["Sales"].Columns["ProductName"];
column.TranslatedNames["de-DE"] = "Produktname";
column.TranslatedDescriptions["de-DE"] = "Name des Produkts";
column.TranslatedDisplayFolders["de-DE"] = "Produkt";
```

### Measure Translations

```csharp
var measure = Model.Tables["Sales"].Measures["Total Revenue"];
measure.TranslatedNames["de-DE"] = "Gesamtumsatz";
measure.TranslatedDescriptions["de-DE"] = "Summe aller Verkaufserlöse";
measure.TranslatedDisplayFolders["de-DE"] = "Kennzahlen";
```

### Hierarchy and Level Translations

```csharp
var hierarchy = Model.Tables["Geography"].Hierarchies["Geography"];
hierarchy.TranslatedNames["de-DE"] = "Geografie";

foreach(var level in hierarchy.Levels) {
    if(level.Name == "Country") level.TranslatedNames["de-DE"] = "Land";
    if(level.Name == "State") level.TranslatedNames["de-DE"] = "Bundesland";
    if(level.Name == "City") level.TranslatedNames["de-DE"] = "Stadt";
}
```


## Common Patterns

### Bulk Translate Tables

```csharp
var culture = "de-DE";
var translations = new Dictionary<string, string> {
    {"Sales", "Verkauf"},
    {"Products", "Produkte"},
    {"Customers", "Kunden"},
    {"Date", "Datum"}
};

foreach(var kvp in translations) {
    if(Model.Tables.Contains(kvp.Key)) {
        Model.Tables[kvp.Key].TranslatedNames[culture] = kvp.Value;
    }
}
```

### Export Translations to TSV

```csharp
var culture = "de-DE";
var sb = new System.Text.StringBuilder();
sb.AppendLine("Type\tTable\tName\tTranslation");

// Tables
foreach(var t in Model.Tables) {
    var trans = t.TranslatedNames[culture] ?? "";
    sb.AppendLine($"Table\t{t.Name}\t{t.Name}\t{trans}");
}

// Columns
foreach(var c in Model.AllColumns) {
    var trans = c.TranslatedNames[culture] ?? "";
    sb.AppendLine($"Column\t{c.Table.Name}\t{c.Name}\t{trans}");
}

// Measures
foreach(var m in Model.AllMeasures) {
    var trans = m.TranslatedNames[culture] ?? "";
    sb.AppendLine($"Measure\t{m.Table.Name}\t{m.Name}\t{trans}");
}

SaveFile("translations_" + culture + ".tsv", sb.ToString());
Info("Exported translations to file");
```

### Find Missing Translations

```csharp
var culture = "de-DE";
var missing = new List<string>();

foreach(var t in Model.Tables.Where(t => !t.IsHidden)) {
    if(string.IsNullOrEmpty(t.TranslatedNames[culture])) {
        missing.Add($"Table: {t.Name}");
    }
}

foreach(var c in Model.AllColumns.Where(c => !c.IsHidden && !c.Table.IsHidden)) {
    if(string.IsNullOrEmpty(c.TranslatedNames[culture])) {
        missing.Add($"Column: {c.DaxObjectFullName}");
    }
}

foreach(var m in Model.AllMeasures.Where(m => !m.IsHidden)) {
    if(string.IsNullOrEmpty(m.TranslatedNames[culture])) {
        missing.Add($"Measure: {m.DaxObjectFullName}");
    }
}

if(missing.Any()) {
    Output($"Missing {culture} translations:\n" + string.Join("\n", missing));
} else {
    Info($"All visible objects have {culture} translations");
}
```

### Copy Translations Between Cultures

```csharp
var sourceCulture = "en-US";
var targetCulture = "en-GB";

// Ensure target culture exists
if(!Model.Cultures.Contains(targetCulture)) {
    Model.AddCulture(targetCulture);
}

// Copy all translations
foreach(var t in Model.Tables) {
    var name = t.TranslatedNames[sourceCulture];
    if(!string.IsNullOrEmpty(name)) t.TranslatedNames[targetCulture] = name;

    var desc = t.TranslatedDescriptions[sourceCulture];
    if(!string.IsNullOrEmpty(desc)) t.TranslatedDescriptions[targetCulture] = desc;
}

foreach(var c in Model.AllColumns) {
    var name = c.TranslatedNames[sourceCulture];
    if(!string.IsNullOrEmpty(name)) c.TranslatedNames[targetCulture] = name;

    var folder = c.TranslatedDisplayFolders[sourceCulture];
    if(!string.IsNullOrEmpty(folder)) c.TranslatedDisplayFolders[targetCulture] = folder;
}

foreach(var m in Model.AllMeasures) {
    var name = m.TranslatedNames[sourceCulture];
    if(!string.IsNullOrEmpty(name)) m.TranslatedNames[targetCulture] = name;
}

Info($"Copied translations from {sourceCulture} to {targetCulture}");
```

### Audit All Cultures

```csharp
Info($"Model has {Model.Cultures.Count} cultures:");

foreach(var culture in Model.Cultures) {
    var tableCount = Model.Tables.Count(t => !string.IsNullOrEmpty(t.TranslatedNames[culture.Name]));
    var measureCount = Model.AllMeasures.Count(m => !string.IsNullOrEmpty(m.TranslatedNames[culture.Name]));
    var columnCount = Model.AllColumns.Count(c => !string.IsNullOrEmpty(c.TranslatedNames[culture.Name]));

    Info($"  {culture.Name}: {tableCount} tables, {measureCount} measures, {columnCount} columns");
}
```


## Delete Operations

```csharp
// Delete culture (removes all its translations)
Model.Cultures["de-DE"].Delete();

// Clear specific translation
measure.TranslatedNames["de-DE"] = null;
measure.TranslatedDescriptions["de-DE"] = null;
```


## Common Culture Codes

| Code | Language |
|------|----------|
| `en-US` | English (US) |
| `en-GB` | English (UK) |
| `de-DE` | German (Germany) |
| `fr-FR` | French (France) |
| `es-ES` | Spanish (Spain) |
| `it-IT` | Italian (Italy) |
| `pt-BR` | Portuguese (Brazil) |
| `nl-NL` | Dutch (Netherlands) |
| `ja-JP` | Japanese |
| `zh-CN` | Chinese (Simplified) |
| `ko-KR` | Korean |


## Best Practices

1. **Use standard culture codes** - Follow ISO format (language-COUNTRY)
2. **Translate visible objects first** - Prioritize user-facing content
3. **Maintain consistency** - Use consistent terminology across translations
4. **Export for review** - Let native speakers review translations
5. **Test in Power BI** - Verify translations display correctly
6. **Include display folders** - Translate folder paths for full localization
7. **Document translation process** - Track who translated what and when
