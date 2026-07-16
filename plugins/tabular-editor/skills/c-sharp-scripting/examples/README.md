# Tabular Editor Script Samples

Non-interactive C# scripts for automating Power BI semantic model operations.

## Usage

All scripts in this directory are **non-interactive** and can be run from the CLI without user input.

### From Claude Code Plugin

```bash
te script -s "workspace" -d "model" -S samples/measures/create_sum_measures.csx --save
```

### From Command Line

```bash
te script -s "workspace" -d "model" -S samples/columns/hide_key_columns.csx --save
```

## Script Categories

### Measures (`measures/`)

- **create_sum_measures.csx** - Create SUM measures from selected columns
- **create_countrows_measures.csx** - Create COUNTROWS measures from selected tables
- **create_time_intelligence.csx** - Create YTD, MTD, QTD, PY, YoY, YoY% measures

### Columns (`columns/`)

- **hide_key_columns.csx** - Hide all Key/ID columns and disable summarization
- **disable_summarization.csx** - Disable automatic summarization on all columns

### Display Folders (`display-folders/`)

- **clear_all_display_folders.csx** - Remove all display folders from the model
- **organize_measures_by_type.csx** - Organize measures into folders by naming pattern

### Format Strings (`format-strings/`)

- **apply_format_by_name.csx** - Apply format strings based on measure naming patterns

### Bulk Operations (`bulk-operations/`)

- **add_expression_to_descriptions.csx** - Add DAX expressions to measure descriptions
- **clean_object_names.csx** - Convert CamelCase names to Proper Case Names

## Script Headers

All scripts include:
- **Title** - Brief description
- **Author** - Original author/source
- **Description** - What the script does
- **Usage** - How to run it
- **Non-interactive** - Whether it requires user input

## Customization

Most scripts can be customized by editing variables at the top:
- Date column names for time intelligence
- Naming patterns for organization
- Format string templates
- Prefixes/suffixes to ignore

## Sources

Scripts are sourced from:
- [Tabular Editor Official Docs](https://docs.tabulareditor.com)
- [PowerBI-tips Repository](https://github.com/PowerBI-tips/TabularEditor-Scripts)
- [Tabular Editor Scripts Repository](https://github.com/TabularEditor/Scripts)
- Community contributions

## Contributing

To add new scripts:
1. Follow the header format shown in existing scripts
2. Ensure scripts are non-interactive (no Input(), SelectObject())
3. Test scripts before committing
4. Document any configuration variables
