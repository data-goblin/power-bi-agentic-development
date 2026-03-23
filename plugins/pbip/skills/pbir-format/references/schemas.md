# Power BI PBIR Schemas

## Schema Locations

All schemas are hosted at:
\`\`\`
https://developer.microsoft.com/json-schemas/
\`\`\`

Source repository:
\`\`\`
https://github.com/microsoft/json-schemas
\`\`\`

## Core PBIR Schemas

### Visual Container (2.2.0)
**URL:** \`https://developer.microsoft.com/json-schemas/fabric/item/report/definition/visualContainer/2.2.0/schema.json\`

Defines visual containers, their properties, and layout.

**Download:**
\`\`\`bash
curl -s https://developer.microsoft.com/json-schemas/fabric/item/report/definition/visualContainer/2.2.0/schema.json > visualContainer.schema.json
\`\`\`

**Usage:** Referenced in \`visual.json\` files

### Semantic Query (1.3.0)
**URL:** \`https://developer.microsoft.com/json-schemas/fabric/item/report/definition/semanticQuery/1.3.0/schema.json\`

Defines query expressions, measures, columns, and data references.

**Download:**
\`\`\`bash
curl -s https://developer.microsoft.com/json-schemas/fabric/item/report/definition/semanticQuery/1.3.0/schema.json > semanticQuery.schema.json
\`\`\`

**Key definitions:**
- \`QueryExpressionContainer\`: Expression types (Measure, Column, Literal, etc.)
- \`QueryMeasureExpression\`: Measure references
- \`ThemeDataColor\`: Theme color references

### Report Extensions (1.0.0)
**URL:** \`https://developer.microsoft.com/json-schemas/fabric/item/report/definition/reportExtension/1.0.0/schema.json\`

Defines thin report measures and extension entities.

**Download:**
\`\`\`bash
curl -s https://developer.microsoft.com/json-schemas/fabric/item/report/definition/reportExtension/1.0.0/schema.json > reportExtension.schema.json
\`\`\`

**Usage:** Referenced in \`reportExtensions.json\`

### Formatting Object Definitions (1.4.0)
**URL:** \`https://developer.microsoft.com/json-schemas/fabric/item/report/definition/formattingObjectDefinitions/1.4.0/schema.json\`

Defines selectors and formatting patterns.

**Download:**
\`\`\`bash
curl -s https://developer.microsoft.com/json-schemas/fabric/item/report/definition/formattingObjectDefinitions/1.4.0/schema.json > formattingObjectDefinitions.schema.json
\`\`\`

**Key definitions:**
- \`Selector\`: metadata, data, id selectors
- \`DataRepetitionSelector\`: scopeId, dataViewWildcard
- \`DataViewWildcard\`: matchingOption values

### Page Definition (2.0.0)
**URL:** \`https://developer.microsoft.com/json-schemas/fabric/item/report/definition/page/2.0.0/schema.json\`

Defines page properties and settings.

**Download:**
\`\`\`bash
curl -s https://developer.microsoft.com/json-schemas/fabric/item/report/definition/page/2.0.0/schema.json > page.schema.json
\`\`\`

**Usage:** Referenced in \`page.json\` files

## Quick Download Script

Download all schemas to current directory:

\`\`\`bash
#!/bin/bash
BASE_URL="https://developer.microsoft.com/json-schemas/fabric/item/report/definition"

schemas=(
  "visualContainer/2.2.0/schema.json"
  "semanticQuery/1.3.0/schema.json"
  "reportExtension/1.0.0/schema.json"
  "formattingObjectDefinitions/1.4.0/schema.json"
  "page/2.0.0/schema.json"
)

for schema in "${schemas[@]}"; do
  filename=$(basename "$schema")
  curl -s "$BASE_URL/$schema" > "$filename"
  echo "Downloaded: $filename"
done
\`\`\`

## Validation

Use \`scripts/validate_visual.py\` to validate visual.json files:

\`\`\`bash
python3 scripts/validate_visual.py path/to/visual.json
\`\`\`

## Key Schema Patterns

### dataViewWildcard.matchingOption

From \`formattingObjectDefinitions\` schema:

| Value | Constant | Description |
|-------|----------|-------------|
| 0 | Default | Match Identities and Totals |
| 1 | Instances | Match Instances with Identities only (per-point) |
| 2 | Totals | Match Totals only |

**Usage:**
\`\`\`json
{
  "dataViewWildcard": {
    "matchingOption": 1  // Per-point evaluation
  }
}
\`\`\`

### Expression Types

From \`semanticQuery\` schema, all valid \`expr\` types:

- \`Literal\`: Fixed values
- \`ThemeDataColor\`: Theme colors
- \`Measure\`: DAX measures
- \`Column\`: Table columns
- \`Aggregation\`: Aggregated expressions
- \`Conditional\`: If/then logic
- \`Arithmetic\`: Math operations
- \`Comparison\`: Comparisons
- \`And\`/\`Or\`/\`Not\`: Logical operations

### Selector Types

From \`formattingObjectDefinitions\` schema:

\`\`\`json
{
  "metadata": "string",              // Series-level
  "data": [                          // Data-level
    {
      "scopeId": {...},              // Specific category
      "wildcard": [...],             // All instances (deprecated)
      "roles": [...],                // By role
      "total": [...],                // Totals
      "dataViewWildcard": {...}      // Match by pattern
    }
  ],
  "id": "string"                     // User-defined
}
\`\`\`

## Schema Exploration

### Find all expression types:
\`\`\`bash
curl -s https://developer.microsoft.com/json-schemas/fabric/item/report/definition/semanticQuery/1.3.0/schema.json | \
  jq -r '.definitions.QueryExpressionContainer.properties | keys[]'
\`\`\`

### Find all selector properties:
\`\`\`bash
curl -s https://developer.microsoft.com/json-schemas/fabric/item/report/definition/formattingObjectDefinitions/1.4.0/schema.json | \
  jq -r '.definitions.Selector.properties | keys[]'
\`\`\`

### Search for specific pattern:
\`\`\`bash
# Find all references to "strokeColor"
gh search code --repo microsoft/json-schemas "strokeColor" --json path
\`\`\`

## Version History

Power BI schemas use semantic versioning. Check for updates:

\`\`\`bash
# List all visualContainer versions
gh api repos/microsoft/json-schemas/contents/fabric/item/report/definition/visualContainer
\`\`\`

## Local Caching

Store schemas locally for offline work:

\`\`\`bash
mkdir -p ~/.power-bi-schemas
cd ~/.power-bi-schemas
# Run download script above
\`\`\`

Reference in validation tools:
\`\`\`python
import json
import jsonschema

with open('~/.power-bi-schemas/visualContainer.schema.json') as f:
    schema = json.load(f)

with open('visual.json') as f:
    visual = json.load(f)

jsonschema.validate(visual, schema)
\`\`\`

## Useful JMESPath Queries

Extract specific parts of definitions:

\`\`\`bash
# Get all visual object types
fab get "Workspace.Workspace/Report.Report" -q "definition.parts[?path=='definition/pages/*/visuals/*/visual.json'].payload | [].visual.visualType"

# Get all measure references
fab get "Workspace.Workspace/Report.Report" -q "definition.parts[?path=='definition/reportExtensions.json'].payload | [0].entities[].measures[].name"

# Find all selectors with dataViewWildcard
jq '.visual.objects | .. | select(.dataViewWildcard?)' visual.json
\`\`\`
