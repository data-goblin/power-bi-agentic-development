# BPA Rule Examples

This directory contains example BPA rule sets for Tabular Editor.

## Important: Tabular Editor Compatibility

### Line Endings (CRLF)

Tabular Editor on Windows requires **CRLF line endings** (`\r\n`). Files with Unix line endings (LF only) may fail to load or show empty rule collections.

To convert a file to CRLF:
```bash
# macOS/Linux
sed -i 's/$/\r/' rules.json

# Or use the validation script with --fix flag
python validate_rules.py --fix rules.json
```

### File Paths

When adding rule files in Tabular Editor:
- **Use absolute paths** (e.g., `C:\BPARules\my-rules.json`)
- **Avoid relative paths** with `..\..\..` - TE may fail to resolve these
- URLs work fine (e.g., `https://raw.githubusercontent.com/...`)

### JSON Format Requirements

- No `_comment` fields - TE's JSON parser doesn't allow extra properties
- Avoid `null` values for optional fields - omit the field entirely instead
- Use standard JSON encoding (UTF-8, no BOM)

## Files

### power-query-operations-rules.json

Comprehensive BPA rules for detecting Power Query anti-patterns:

**Duplicate Detection (3 rules):**
- `PQ_AVOID_TABLE_DISTINCT` - Detects Table.Distinct operations
- `PQ_AVOID_REMOVE_DUPLICATES` - Detects Table.RemoveDuplicates operations
- `PQ_DUPLICATE_DETECTION_COMPREHENSIVE` - Comprehensive rule covering all duplicate removal

**Join/Merge Operations (4 rules):**
- `PQ_AVOID_TABLE_NESTEDJOIN` - Detects Table.NestedJoin (severity 3)
- `PQ_AVOID_TABLE_JOIN` - Detects Table.Join (severity 3)
- `PQ_AVOID_FUZZY_JOINS` - Detects fuzzy join operations (severity 3)
- `PQ_MERGE_OPERATIONS_COMPREHENSIVE` - Comprehensive rule covering all join/merge patterns

**Advanced Patterns (3 rules):**
- `PQ_TABLE_COMBINE_WITH_DISTINCT` - Detects Table.Combine + duplicate removal patterns
- `PQ_BUFFER_BEFORE_JOINS` - Detects Table.Buffer usage before joins
- `PQ_EXPAND_AFTER_NESTEDJOIN` - Detects expand column operations after nested joins

### course-3-business-case-bpa-rules.json

Business case example rules from training materials demonstrating various BPA patterns including:
- Table naming conventions
- Duplicate removal detection
- Auto-DateTime table detection
- Column count limits
- Relationship best practices
- Data type recommendations
- Redundant column detection
- Display folder organization
- Format string requirements

### comprehensive-rules.json

Complete reference set of BPA rules covering:
- DAX expressions
- Metadata
- Performance
- Model layout
- Naming conventions
- Formatting
- Governance

## Usage

Import these rule sets into Tabular Editor via:
1. Tools -> Manage BPA Rules
2. Click "Add..."
3. Enter the **absolute file path** or URL
4. Click "OK"

Or reference them in your `BPARules.json` file in the model directory.

## Validation

Use the validation script to check rules before loading in TE:

```bash
# Validate rules
python scripts/validate_rules.py examples/my-rules.json

# Validate and fix line endings
python scripts/validate_rules.py --fix examples/my-rules.json

# Schema validation only
python scripts/validate_rules.py --schema-only examples/my-rules.json
```
