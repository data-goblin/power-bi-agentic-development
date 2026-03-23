# Schema Patterns Index

Patterns extracted from official JSON schemas.

## Files

| File | Purpose | Source Schema |
|------|---------|---------------|
| conditional-formatting.md | Conditional formatting patterns (measures, gradients, rules) | formattingObjectDefinitions |
| expressions.md | All expression types (Literal, Measure, etc.) | semanticQuery |
| selectors.md | Selector patterns (data, metadata, etc.) | formattingObjectDefinitions |
| visual-calculations.md | NativeVisualCalculation patterns | semanticQuery |

## Quick Lookup

### Expression Types

| Need | Type | File | Line/Section |
|------|------|------|--------------|
| Static string | Literal | expressions.md | String Literals |
| Static number | Literal | expressions.md | Numeric Literals |
| Static boolean | Literal | expressions.md | Boolean Literals |
| DAX measure | Measure | expressions.md | Measure Expressions |
| Extension measure | Measure | expressions.md | Extension Measure |
| Theme color | ThemeDataColor | expressions.md | ThemeDataColor Expressions |
| Table column | Column | expressions.md | Column Expressions |

### Selector Types

| Need | Type | File | Section |
|------|------|------|---------|
| Apply to all | (no selector) | selectors.md | - |
| Apply to series | metadata | selectors.md | Series-level |
| Apply per point | data + dataViewWildcard | selectors.md | Per-point |
| Apply to category | data + scopeId | selectors.md | Specific category |

## Common Mistakes

| Error | Cause | Fix | File |
|-------|-------|-----|------|
| `"Value": "smooth"` | Missing quotes | `"Value": "'smooth'"` | expressions.md |
| `"Value": 50` | Missing suffix | `"Value": "50D"` | expressions.md |
| `"Value": "True"` | Wrong case | `"Value": "true"` | expressions.md |
| Colors on whole series | matchingOption: 0 | matchingOption: 1 | selectors.md |
| Measure not found | Missing Schema | Add `"Schema": "extension"` | expressions.md |
| Page deploys but doesn't show | Spaces in folder name | Rename folder: `Test Page/` → `test_page/` | ../page.md |

## Schema Files

See `schemas.md` for current schema versions and URLs. Schemas update monthly.
