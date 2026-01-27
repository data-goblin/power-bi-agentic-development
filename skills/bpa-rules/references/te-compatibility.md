# Tabular Editor Compatibility

BPA rule files must follow specific formatting requirements for Tabular Editor to load them correctly. Files that don't follow these rules may show empty rule collections or fail to load entirely.

## Line Endings (CRLF Required)

Tabular Editor on Windows requires **Windows line endings (CRLF, `\r\n`)**. Files with Unix line endings (LF only) will fail to load or show empty rule collections.

To convert a file to CRLF:
```bash
# macOS/Linux
sed -i 's/$/\r/' rules.json

# Or use the validation script
python scripts/validate_rules.py --fix rules.json
```

## File Paths

When adding rule files in Tabular Editor:
- **Use absolute paths** (e.g., `C:\BPARules\my-rules.json`)
- **Avoid relative paths** with `..\..\..` - TE may fail to resolve these
- URLs work reliably (e.g., `https://raw.githubusercontent.com/...`)

## JSON Format Requirements

**No extra properties:** TE's JSON parser is strict. Only use allowed fields:
- `ID`, `Name`, `Category`, `Description`, `Severity`, `Scope`, `Expression`
- `FixExpression`, `CompatibilityLevel`, `Source`, `Remarks`

**Avoid these patterns:**
```json
// BAD: _comment fields not allowed
{ "_comment": "Section header", "ID": "RULE1", ... }

// BAD: Runtime fields (TE adds these, don't include them)
{ "ID": "RULE1", "ObjectCount": 0, "ErrorMessage": null, ... }

// GOOD: FixExpression can be null or omitted
{ "ID": "RULE1", "FixExpression": null, ... }
{ "ID": "RULE1", "Name": "...", "Severity": 2, "Scope": "Measure", "Expression": "..." }
```

**Note:** `FixExpression: null` is valid. `ErrorMessage` and `ObjectCount` are runtime fields that TE adds -- do not include them in rule definitions.

## Regex Expression Syntax

When using `RegEx.IsMatch()` in expressions:

**No `@` prefix:** Do not use C# verbatim string prefix
```csharp
// BAD: @ prefix not supported
RegEx.IsMatch(Expression, @"FILTER\s*\(\s*ALL")

// GOOD: Standard escaping
RegEx.IsMatch(Expression, "FILTER\\s*\\(\\s*ALL")
```

**No RegexOptions parameter:** TE doesn't support the options parameter
```csharp
// BAD: RegexOptions not supported
RegEx.IsMatch(Name, "^DATE$", RegexOptions.IgnoreCase)

// GOOD: Use inline flag or pattern only
RegEx.IsMatch(Name, "(?i)^DATE$")
RegEx.IsMatch(Name, "^(DATE|date|Date)$")
```

## Correct Scope Names

Use the exact scope names from the TOM enum. Common mistakes:

| Wrong | Correct |
|-------|---------|
| `Role` | `ModelRole` |
| `Member` | `ModelRoleMember` |
| `Expression` | `NamedExpression` |
| `DataSource` | `ProviderDataSource` or `StructuredDataSource` |

**Note:** `Column` is valid as a backwards-compatible alias for `DataColumn, CalculatedColumn, CalculatedTableColumn`.

## Validation Script

Use the validation script to check and fix TE compatibility issues:

```bash
# Check for issues
python scripts/validate_rules.py rules.json

# Auto-fix issues (CRLF, remove nulls, remove _comment)
python scripts/validate_rules.py --fix rules.json
```

The script checks:
- Line endings (CRLF)
- No `_comment` fields
- No `null` values for optional fields
- Valid scope names
- Expression syntax warnings

## File Locations

BPA rules can exist in multiple locations (evaluated in order of priority):

| Location | Path / Source | Description |
|----------|---------------|-------------|
| **Built-in Best Practices** | Internal to TE3 | Default rules bundled with Tabular Editor 3 |
| **URL** | Any valid URL (e.g., `https://raw.githubusercontent.com/TabularEditor/BestPracticeRules/master/BPARules-standard.json`) | Remote rule collections loaded from web |
| **Rules within current model** | Model annotations | Rules embedded in model metadata |
| **Rules for local user** | `%LocalAppData%\TabularEditor3\BPARules.json` | User-specific rules on Windows |
| **Rules on local machine** | `%ProgramData%\TabularEditor3\BPARules.json` | Machine-wide rules for all users |

### Built-in Rules (TE3 Only)

Tabular Editor 3 includes built-in BPA rules embedded in the application. These are **not** stored as separate JSON files but are compiled into the DLLs.

**Configuration:** `%LocalAppData%\TabularEditor3\Preferences.json`
- `BuiltInBpaRules`: `"Enable"` | `"Disable"` | `"EnableWithWarnings"`
- `DisabledBuiltInRuleIds`: Array of rule IDs to disable

**Built-in Rule IDs:**

| ID | Category | Description |
|----|----------|-------------|
| `TE3_BUILT_IN_DATA_COLUMN_SOURCE` | Schema | Data column source validation |
| `TE3_BUILT_IN_EXPRESSION_REQUIRED` | Schema | Expression required for calculated objects |
| `TE3_BUILT_IN_AVOID_PROVIDER_PARTITIONS_STRUCTURED` | Data Sources | Avoid provider partitions with structured sources |
| `TE3_BUILT_IN_SET_ISAVAILABLEINMDX_FALSE` | Performance | Set IsAvailableInMdx to false for non-MDX columns |
| `TE3_BUILT_IN_DATE_TABLE_EXISTS` | Schema | Date table should exist |
| `TE3_BUILT_IN_MANY_TO_MANY_SINGLE_DIRECTION` | Relationships | Many-to-many should use single direction |
| `TE3_BUILT_IN_RELATIONSHIP_SAME_DATATYPE` | Relationships | Relationship columns should have same data type |
| `TE3_BUILT_IN_AVOID_INVALID_CHARACTERS_NAMES` | Naming | Avoid invalid characters in names |
| `TE3_BUILT_IN_AVOID_INVALID_CHARACTERS_DESCRIPTIONS` | Metadata | Avoid invalid characters in descriptions |
| `TE3_BUILT_IN_SET_ISAVAILABLEINMDX_TRUE_NECESSARY` | Performance | Set IsAvailableInMdx true only when necessary |
| `TE3_BUILT_IN_REMOVE_UNUSED_DATA_SOURCES` | Maintenance | Remove unused data sources |
| `TE3_BUILT_IN_VISIBLE_TABLES_NO_DESCRIPTION` | Metadata | Visible tables should have descriptions |
| `TE3_BUILT_IN_VISIBLE_COLUMNS_NO_DESCRIPTION` | Metadata | Visible columns should have descriptions |
| `TE3_BUILT_IN_VISIBLE_MEASURES_NO_DESCRIPTION` | Metadata | Visible measures should have descriptions |
| `TE3_BUILT_IN_VISIBLE_CALCULATION_GROUPS_NO_DESCRIPTION` | Metadata | Visible calculation groups should have descriptions |
| `TE3_BUILT_IN_VISIBLE_UDF_NO_DESCRIPTION` | Metadata | Visible UDFs should have descriptions |
| `TE3_BUILT_IN_PERSPECTIVES_NO_OBJECTS` | Schema | Perspectives should contain objects |
| `TE3_BUILT_IN_CALCULATION_GROUPS_NO_ITEMS` | Schema | Calculation groups should have items |
| `TE3_BUILT_IN_TRIM_OBJECT_NAMES` | Naming | Object names should be trimmed |
| `TE3_BUILT_IN_FORMAT_STRING_COLUMNS` | Formatting | Columns should have format strings |
| `TE3_BUILT_IN_TRANSLATE_DISPLAY_FOLDERS` | Translations | Display folders should be translated |
| `TE3_BUILT_IN_TRANSLATE_DESCRIPTIONS` | Translations | Descriptions should be translated |
| `TE3_BUILT_IN_TRANSLATE_VISIBLE_NAMES` | Translations | Visible names should be translated |
| `TE3_BUILT_IN_TRANSLATE_HIERARCHY_LEVELS` | Translations | Hierarchy levels should be translated |
| `TE3_BUILT_IN_TRANSLATE_PERSPECTIVES` | Translations | Perspectives should be translated |
| `TE3_BUILT_IN_SPECIFY_APPLICATION_NAME` | Metadata | Specify application name |
| `TE3_BUILT_IN_POWERBI_LATEST_COMPATIBILITY` | Compatibility | Use latest Power BI compatibility level |

### Cross-Platform Access (macOS/Linux)

When working on macOS or Linux with Tabular Editor installed in a Windows VM:

**Parallels on macOS:**
```
/Users/<macUser>/Library/Parallels/Windows Disks/{VM-UUID}/[C] <DiskName>.hidden/
```

Full paths to BPA rules:
- **User-level:** `<ParallelsRoot>/Users/<WinUser>/AppData/Local/TabularEditor3/BPARules.json`
- **Machine-level:** `<ParallelsRoot>/ProgramData/TabularEditor3/BPARules.json`

**Other platforms:**
- **VMware Fusion** - Check `/Volumes/` for mounted Windows drives
- **WSL on Windows** - `/mnt/c/Users/<username>/AppData/Local/TabularEditor3/`

**Note:** The VM must be running for the filesystem to be accessible. If paths appear empty, start the Windows VM first.

### Model-Embedded Rules

Model-embedded rules can be stored in two formats:

| Format | Location | Syntax |
|--------|----------|--------|
| **model.bim** (JSON) | `model.annotations` array | `{ "name": "BestPracticeAnalyzer", "value": "[{...rules...}]" }` |
| **TMDL** | `model.tmdl` file | `annotation BestPracticeAnalyzer = [{...rules...}]` |

**File format:** All locations use the same JSON array format containing rule objects.

**Priority:** When the same rule ID exists in multiple locations, rules are merged with local rules taking precedence over remote/built-in rules.
