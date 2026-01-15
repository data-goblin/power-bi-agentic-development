# Sample Scripts

Reference examples for C# scripting with Tabular Editor. These are **patterns** to learn from - write custom scripts tailored to each specific use case.

## Organization

| Directory | Purpose |
|-----------|---------|
| `measures/` | Measure CRUD, formatting, organization |
| `tables/` | Table operations, calculated tables |
| `columns/` | Column properties, sorting, formatting |
| `calculation-groups/` | Time intelligence, currency conversion |
| `relationships/` | Relationship management |
| `roles/` | Security, RLS, OLS |
| `format-dax/` | DAX code formatting |
| `bulk-operations/` | Multi-object operations |

## Usage

Execute with Tabular Editor CLI:

```bash
te "WorkspaceName/ModelName" samples/measures/add-measure.csx --file
```

Or copy patterns into custom scripts for your specific needs.

## Important Note

These samples demonstrate syntax and patterns. Always:
1. Review and adapt to your model structure
2. Test on non-production models first
3. Add appropriate error handling
4. Include Info() statements for debugging
