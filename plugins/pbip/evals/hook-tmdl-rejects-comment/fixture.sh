set -e
d=Shop.SemanticModel/definition
mkdir -p "$d/tables"
printf '{\n  "version": "4.2",\n  "settings": {}\n}\n' > Shop.SemanticModel/definition.pbism
printf 'database Shop\n\tcompatibilityLevel: 1702\n' > "$d/database.tmdl"
printf 'model Model\n\tculture: en-US\n\tdefaultPowerBIDataSourceVersion: powerBI_V3\n\nref table Product\n' > "$d/model.tmdl"
cat > "$d/tables/Product.tmdl" <<'TMDL'
table Product

	measure 'Product Count' = COUNTROWS(Product)
		formatString: #,0

	column Name
		dataType: string
		summarizeBy: none
		sourceColumn: Name

	partition Product = m
		mode: import
		source =
				let
				    Source = #table(type table [Name = text], {{"Bike"}, {"Helmet"}})
				in
				    Source
TMDL
