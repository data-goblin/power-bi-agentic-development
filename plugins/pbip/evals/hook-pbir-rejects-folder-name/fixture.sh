set -e
r=Shop.Report
p=$r/definition/pages/Overview
mkdir -p "$p/visuals/card1"
S=https://developer.microsoft.com/json-schemas/fabric/item/report
printf '{\n  "$schema": "%s/definitionProperties/2.0.0/schema.json",\n  "version": "4.0",\n  "datasetReference": {\n    "byPath": {\n      "path": "../Shop.SemanticModel"\n    }\n  }\n}\n' "$S" > $r/definition.pbir
printf '{\n  "$schema": "%s/definition/report/3.3.0/schema.json",\n  "themeCollection": {}\n}\n' "$S" > $r/definition/report.json
printf '{\n  "$schema": "%s/definition/versionMetadata/1.0.0/schema.json",\n  "version": "2.0.0"\n}\n' "$S" > $r/definition/version.json
printf '{\n  "$schema": "%s/definition/pagesMetadata/1.1.0/schema.json",\n  "pageOrder": ["Overview"],\n  "activePageName": "Overview"\n}\n' "$S" > $r/definition/pages/pages.json
printf '{\n  "$schema": "%s/definition/page/2.1.0/schema.json",\n  "name": "Overview",\n  "displayName": "Overview",\n  "displayOption": "FitToPage",\n  "height": 720,\n  "width": 1280\n}\n' "$S" > $p/page.json
printf '{\n  "$schema": "%s/definition/visualContainer/2.7.0/schema.json",\n  "name": "card1",\n  "position": {"x": 20, "y": 20, "z": 0, "height": 120, "width": 240},\n  "visual": {"visualType": "card"}\n}\n' "$S" > $p/visuals/card1/visual.json
