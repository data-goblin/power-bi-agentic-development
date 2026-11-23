set -eu
mkdir -p Bikes.SemanticModel/definition/tables Bikes.Report/definition/pages/Overview
printf '%s\n' 'database Bikes' '	compatibilityLevel: 1702' > Bikes.SemanticModel/definition/database.tmdl
printf '%s\n' 'model Model' '	culture: en-US' '	defaultPowerBIDataSourceVersion: powerBI_V3' '	discourageImplicitMeasures' '' 'ref table Sales' 'ref table Product' > Bikes.SemanticModel/definition/model.tmdl
cat > Bikes.SemanticModel/definition/tables/Product.tmdl <<'TMDL'
table Product

	column Category
		dataType: string
		sourceColumn: [Category]

	partition Product = calculated
		mode: import
		source = DATATABLE ( "Category", STRING, { { "Road" }, { "Mountain" } } )
TMDL
cat > Bikes.SemanticModel/definition/tables/Sales.tmdl <<'TMDL'
table Sales

	column Amount
		dataType: double
		isHidden
		summarizeBy: none
		sourceColumn: [Amount]

	column Returned
		dataType: double
		isHidden
		summarizeBy: none
		sourceColumn: [Returned]

	measure 'Total Sales' = SUM ( Sales[Amount] )

	measure 'Returned Sales' = SUM ( Sales[Returned] )

	partition Sales = calculated
		mode: import
		source = DATATABLE ( "Amount", DOUBLE, "Returned", DOUBLE, { { 100, 0 }, { 250, 50 } } )
TMDL
cat > Bikes.SemanticModel/definition.pbism <<'JSON'
{
  "$schema": "https://developer.microsoft.com/json-schemas/fabric/item/semanticModel/definitionProperties/1.0.0/schema.json",
  "version": "4.2",
  "settings": {}
}
JSON
cat > Bikes.Report/definition.pbir <<'JSON'
{
  "$schema": "https://developer.microsoft.com/json-schemas/fabric/item/report/definitionProperties/2.0.0/schema.json",
  "version": "4.0",
  "datasetReference": {
    "byPath": {
      "path": "../Bikes.SemanticModel"
    }
  }
}
JSON
cat > Bikes.Report/definition/report.json <<'JSON'
{
  "$schema": "https://developer.microsoft.com/json-schemas/fabric/item/report/definition/report/3.3.0/schema.json",
  "themeCollection": {}
}
JSON
cat > Bikes.Report/definition/version.json <<'JSON'
{
  "$schema": "https://developer.microsoft.com/json-schemas/fabric/item/report/definition/versionMetadata/1.0.0/schema.json",
  "version": "2.0.0"
}
JSON
cat > Bikes.Report/definition/pages/pages.json <<'JSON'
{
  "$schema": "https://developer.microsoft.com/json-schemas/fabric/item/report/definition/pagesMetadata/1.1.0/schema.json",
  "pageOrder": ["Overview"],
  "activePageName": "Overview"
}
JSON
cat > Bikes.Report/definition/pages/Overview/page.json <<'JSON'
{
  "$schema": "https://developer.microsoft.com/json-schemas/fabric/item/report/definition/page/2.1.0/schema.json",
  "name": "Overview",
  "displayName": "Overview",
  "displayOption": "FitToPage",
  "height": 720,
  "width": 1280
}
JSON
