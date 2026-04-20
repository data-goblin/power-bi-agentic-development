# Report Exploration Workflow

Systematic process for understanding, analyzing, and documenting existing Power BI reports.

## Quick Discovery

Start with these commands to orient:

```bash
pbir ls                                          # Find all reports
pbir tree "Report.Report" -v                     # Full structure with fields
pbir validate "Report.Report"                    # Health check
```

## Systematic Exploration

### 1. Report-Level Analysis

```bash
# Report metadata and settings
pbir get "Report.Report"                         # Report name, pages, theme
pbir report json "Report.Report"                 # Full report.json
pbir model "Report.Report"                       # Model connection (workspace, model name/ID)
pbir model "Report.Report" -d                    # Model tables, columns, measures

# Report-level components
pbir filters list "Report.Report"                # Report-level filters
pbir bookmarks list "Report.Report"              # Navigation bookmarks
pbir annotations list "Report.Report"            # Report annotations/metadata
pbir dax measures list "Report.Report"           # Extension measures (thin report)
```

### 2. Page Inventory

```bash
# List all pages
pbir ls "Report.Report"                          # Pages, filters, theme

# For each page:
pbir cat "Report.Report/PageName.Page"           # Page JSON config
pbir get "Report.Report/PageName.Page"           # Page dimensions, display option
pbir ls "Report.Report/PageName.Page"            # Visuals on page (if tree not sufficient)
```

### 3. Visual Deep Dive

```bash
# For visuals of interest:
pbir cat "Report.Report/Page.Page/Visual.Visual"          # Full visual JSON
pbir visuals properties "Report.Report/Page.Page/Visual.Visual"  # Property tree
pbir visuals format "Report.Report/Page.Page/Visual.Visual"      # Merged theme + visual values
pbir visuals query "Report.Report/Page.Page/Visual.Visual"       # DAX query
pbir visuals bind "Report.Report/Page.Page/Visual.Visual" --show # Data bindings
pbir get "Report.Report/Page.Page/Visual.Visual"                 # All properties flat
```

### 4. Data Model Understanding

```bash
# Fields used in report
pbir fields list "Report.Report"                 # All unique fields with types
pbir fields find "Revenue" "Report.Report"       # Find field usage with locations

# Model exploration (requires Fabric connection)
pbir model "Report.Report" -d -t Sales           # Specific table definition
pbir model "Report.Report" -q "EVALUATE TOPN(5, 'Sales')"
pbir model "Report.Report" -q "EVALUATE INFO.TABLES()"
```

### 5. Theme and Styling Analysis

```bash
pbir cat "Report.Report/theme"                  # Full theme JSON
pbir theme colors "Report.Report"                # Color palette with visual usage audit
pbir theme text-classes "Report.Report"          # Text style definitions
pbir theme fonts "Report.Report"                 # Font usage
pbir theme validate "Report.Report"              # Theme structure validation
```

## Common Exploration Patterns

### Finding Problematic Visuals

```bash
# Find visuals without descriptive names
pbir find "Report.Report/**/*.Visual" --json | grep -i "visual\d"
```

### Analyzing Filter Usage

```bash
# Report-level filters
pbir filters list "Report.Report"
```

### Performance Assessment

```bash
# Extension measure count
pbir dax measures list "Report.Report"
```

## Troubleshooting

### Report Won't Open or Validate
```bash
pbir validate "Report.Report"                    # Detailed validation
pbir schema check "Report.Report"                # Schema version compliance
```

### Data Issues
```bash
pbir model "Report.Report" -q 'EVALUATE ROW("Test", 1)'    # Test connectivity
pbir fields list "Report.Report"                             # Check field references
```

### Theme Issues
```bash
pbir theme validate "Report.Report"
pbir theme colors "Report.Report"                # Check for unused colors
pbir visuals format "Report.Report/Page.Page/Visual.Visual"  # See theme cascade
```
