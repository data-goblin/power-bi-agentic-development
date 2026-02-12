---
name: pbip-project-operations
description: This skill should be used when the user asks to "rename a table", "rename a measure", "fork a PBIP project", "update Entity references", "PBIP project structure", "cascade rename", "update report JSON", "fix broken references after rename", "create a copy of a PBIP project", "find all references to a table", or mentions PBIP file editing, report visual JSON, or post-rename verification. Provides expert guidance for project-level operations on Power BI Project (PBIP) files including table/measure renames, project forking, and report JSON updates.
---

# PBIP Project Operations

Expert guidance for project-level operations on Power BI Project (PBIP) files, including cascading renames, project forking, and report JSON updates.

## When to Use This Skill

Activate automatically when tasks involve:

- Renaming tables or measures across a PBIP project
- Forking or duplicating a PBIP project
- Updating report visual JSON after model changes
- Finding all references to a table, column, or measure
- Understanding PBIP file structure and conventions
- Post-rename verification to catch missed references

## Critical

- **SparklineData metadata** in visual JSON files contains table and measure references in a special selector format: `SparklineData(_Measures.Measure Name_[Date.Hierarchy.Level])`. These are easy to miss during renames because they embed Entity references in a compact string, not the usual JSON structure.
- **DAX query files exist in two locations**: `<Name>.SemanticModel/DAXQueries/` and `<Name>.Report/DAXQueries/`. Always check both during renames.
- **`PBI_FormatHint` annotations** may be re-added by Power BI tooling even when they conflict with an explicit `formatString`. Do not remove them; Power BI wants both present.
- **Report JSON Entity references** appear in multiple nested structures: `SourceRef.Entity`, `queryRef`, `nativeQueryRef`, filter conditions, conditional formatting expressions, and SparklineData metadata selectors. A simple find-and-replace on `"Entity"` will miss several of these.
- **Culture files** (`cultures/en-US.tmdl`) contain `ConceptualEntity` and `ConceptualProperty` references inside `linguisticMetadata` JSON that must also be updated during renames.

## PBIP Project Structure

A PBIP project consists of a `.pbip` entry point file and two main artifact folders:

```
<ProjectName>/
├── <ProjectName>.pbip                      # Entry point - references report folder
├── <ProjectName>.Report/
│   ├── definition/
│   │   ├── pages/                          # Report pages
│   │   │   └── <pageId>/
│   │   │       ├── page.json               # Page metadata
│   │   │       └── visuals/
│   │   │           └── <visualId>/
│   │   │               └── visual.json     # Visual definition with Entity refs
│   │   └── reportExtensions.json           # Report-scoped measures
│   ├── DAXQueries/                         # Report-level DAX queries
│   │   └── *.dax
│   └── semanticModelDiagramLayout.json     # Diagram node positions
├── <ProjectName>.SemanticModel/
│   ├── definition/
│   │   ├── model.tmdl                      # Model config + ref table entries
│   │   ├── database.tmdl                   # Compatibility level
│   │   ├── relationships.tmdl              # All relationships
│   │   ├── expressions.tmdl                # Shared expressions / parameters
│   │   ├── tables/
│   │   │   └── <TableName>.tmdl            # Table + columns + measures + partitions
│   │   └── cultures/
│   │       └── en-US.tmdl                  # Linguistic metadata with Entity refs
│   ├── definition.pbism                    # Semantic model entry point
│   └── DAXQueries/                         # Model-level DAX queries
│       └── *.dax
└── <ProjectName>.Report/
    └── definition.pbir                     # Report entry point - references model
```

### Key File Types

| File | Purpose | When to Update |
|------|---------|----------------|
| `.pbip` | Project entry point, references `.Report` folder path | Forking only |
| `.pbir` | Report definition entry point, `byPath` references model | Forking / changing model reference |
| `.pbism` | Semantic model entry point | Rarely |
| `model.tmdl` | Model config, `ref table` entries, annotations | Table renames, forking |
| `relationships.tmdl` | Column-level foreign key references | Table/column renames |
| `expressions.tmdl` | Shared M expressions and parameters | Rarely |
| `<Table>.tmdl` | Table definition with columns, measures, partitions | Table/column/measure renames, data quality |
| `cultures/*.tmdl` | Linguistic metadata with `ConceptualEntity` refs | Table/column/measure renames |
| `visual.json` | Visual definitions with `Entity`/`Property`/`queryRef` | Table/column/measure renames |
| `reportExtensions.json` | Report-scoped measures with `entity`/`name` refs | Table/measure renames |
| `semanticModelDiagramLayout.json` | Diagram node positions using `nodeIndex` table names | Table renames |

## Table Rename Cascade

When renaming a table, update **all** of the following locations in order:

### 1. TMDL File Name

Rename the file from `tables/OldName.tmdl` to `tables/NewName.tmdl`.

### 2. Table Declaration

```tmdl
// Before
table 'Old Name'

// After
table 'New Name'
```

### 3. Partition Name

```tmdl
// Before
partition 'Old Name' = m

// After
partition 'New Name' = m
```

### 4. Model.tmdl Ref Entries

```tmdl
// Before
ref table 'Old Name'

// After
ref table 'New Name'
```

### 5. Relationships.tmdl

```tmdl
// Before
fromColumn: 'Old Name'.'Column Key'
toColumn: 'Old Name'.'Column Key'

// After
fromColumn: 'New Name'.'Column Key'
toColumn: 'New Name'.'Column Key'
```

### 6. DAX Expressions in All TMDL Files

Update every DAX reference in measures, calculated columns, and calculation items across all `.tmdl` files:

```dax
// Before
COUNTROWS ( VALUES ( 'Old Name'[Column] ) )

// After
COUNTROWS ( VALUES ( 'New Name'[Column] ) )
```

### 7. Visual JSON Entity References

Update `Entity` values in all `visual.json` files:

```json
// Before
{ "SourceRef": { "Entity": "Old Name" } }

// After
{ "SourceRef": { "Entity": "New Name" } }
```

Also update `queryRef` and `nativeQueryRef` strings:

```json
// Before
"queryRef": "Old Name.Column Name"

// After
"queryRef": "New Name.Column Name"
```

### 8. SparklineData Metadata Selectors

```json
// Before
"metadata": "SparklineData(Old Name.Measure Name_[Date.Hierarchy.Level])"

// After
"metadata": "SparklineData(New Name.Measure Name_[Date.Hierarchy.Level])"
```

### 9. SemanticModelDiagramLayout.json

```json
// Before
{ "nodeIndex": "Old Name" }

// After
{ "nodeIndex": "New Name" }
```

### 10. ReportExtensions.json

```json
// Before
{ "entity": "Old Name", "name": "Measure Name" }

// After
{ "entity": "New Name", "name": "Measure Name" }
```

### 11. Culture Files

```json
// Before (inside linguisticMetadata JSON)
"ConceptualEntity": "Old Name"

// After
"ConceptualEntity": "New Name"
```

### 12. DAX Query Files

Check both `<Name>.SemanticModel/DAXQueries/*.dax` and `<Name>.Report/DAXQueries/*.dax`:

```dax
// Before
EVALUATE TOPN(100, 'Old Name')

// After
EVALUATE TOPN(100, 'New Name')
```

## Measure Rename Cascade

Measure renames touch a subset of the table rename locations:

| Location | What to Update |
|----------|----------------|
| **TMDL measure declaration** | `measure 'Old Name' =` → `measure 'New Name' =` |
| **DAX expressions** | All references in other measures across all `.tmdl` files |
| **Visual JSON `Property`** | `"Property": "Old Name"` → `"Property": "New Name"` |
| **Visual JSON `queryRef`** | `"queryRef": "Table.Old Name"` → `"queryRef": "Table.New Name"` |
| **Visual JSON `nativeQueryRef`** | `"nativeQueryRef": "Old Name"` → `"nativeQueryRef": "New Name"` |
| **SparklineData metadata** | Table/measure references in metadata selectors |
| **reportExtensions.json** | `"name": "Old Name"` in measure entries |
| **Culture files** | `ConceptualProperty` references in `linguisticMetadata` |

## Forking a PBIP Project

To create a new project variation from an existing one:

### Step 1: Copy the Project Folder

Copy the entire project folder and rename it:

```
cp -r "My Report" "My Report - Enhanced"
```

### Step 2: Rename Artifact Folders

Rename the inner `.Report` and `.SemanticModel` folders to match the new project name:

```
My Report - Enhanced/
├── My Report - Enhanced.Report/        # was My Report.Report
├── My Report - Enhanced.SemanticModel/  # was My Report.SemanticModel (if present)
```

### Step 3: Rename and Update the .pbip File

Rename `My Report.pbip` → `My Report - Enhanced.pbip` and update the `path` reference:

```json
{
  "artifacts": [
    {
      "report": {
        "path": "My Report - Enhanced.Report"
      }
    }
  ]
}
```

### Step 4: Update the .pbir File

If the report references a local semantic model, update the `byPath` reference in `definition.pbir`:

```json
{
  "datasetReference": {
    "byPath": {
      "path": "../My Report - Enhanced.SemanticModel"
    }
  }
}
```

### Step 5: Update .platform Files

If `.platform` files exist, update the `displayName` field to match the new project name.

## Verification

After any rename operation, run these verification steps to catch missed references:

### Grep for Old Names

```bash
# Search for old table name across all project files
grep -r "Old Name" "Project.Report/" "Project.SemanticModel/" --include="*.json" --include="*.tmdl" --include="*.dax"

# Search with word boundaries to avoid partial matches
grep -rP "\bOld Name\b" "Project.Report/" "Project.SemanticModel/"
```

### Common Missed Locations

If grep finds remaining references, check these commonly missed spots:

1. **SparklineData metadata** - compact string format embeds table names
2. **Conditional formatting expressions** - `Entity` refs nested in `Conditional.Cases`
3. **Filter config** - page and visual-level filters in `filterConfig` sections
4. **Sort definitions** - `sortDefinition` blocks in visual JSON
5. **DAX queries in Report folder** - easy to forget the second DAX query location

### Verify No Broken DAX

After renames, scan for common DAX breakage patterns:

```bash
# Look for the old name in single-quoted DAX references
grep -r "'Old Name'" --include="*.tmdl"
```

## Quick Reference

### File Extension Guide

| Extension | Full Name | Contains |
|-----------|-----------|----------|
| `.pbip` | Power BI Project | Project entry point, artifact paths |
| `.pbir` | Power BI Report | Report entry point, model path reference |
| `.pbism` | Power BI Semantic Model | Semantic model entry point |
| `.tmdl` | Tabular Model Definition Language | Model metadata (tables, columns, measures, relationships) |
| `.dax` | Data Analysis Expressions | DAX query files |
| `.json` | JSON | Visual definitions, report extensions, diagram layout |

### Rename Scope Summary

| Rename Type | Files Touched | Estimated Locations |
|-------------|---------------|---------------------|
| Table rename | TMDL files, visual JSONs, report JSON, culture files, DAX queries, diagram layout | ~10-12 location types |
| Measure rename | TMDL files, visual JSONs, report extensions, culture files | ~7-8 location types |
| Column rename | TMDL files, visual JSONs, relationships, culture files | ~6-7 location types |
| Project fork | `.pbip`, `.pbir`, `.platform`, folder names | ~4-5 location types |

## Additional Resources

### Reference Files

- **`references/rename-cascade.md`** - Detailed before/after examples for each cascade location, including SparklineData deep-dive and edge cases for quoting in DAX
- **`references/report-json-patterns.md`** - Visual JSON structure documentation with Entity/Property/queryRef patterns, page filters, reportExtensions, diagram layout, and SparklineData format

### External References

- [PBIP and Fabric Git integration (Microsoft Learn)](https://learn.microsoft.com/en-us/power-bi/developer/projects/projects-overview)
- [Power BI Desktop projects - semantic model folder (Microsoft Learn)](https://learn.microsoft.com/en-us/power-bi/developer/projects/projects-dataset)
- [Power BI Desktop projects - report folder (Microsoft Learn)](https://learn.microsoft.com/en-us/power-bi/developer/projects/projects-report)
