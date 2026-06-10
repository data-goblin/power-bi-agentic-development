# Refactoring and renaming objects safely

Companion to the `semantic-model` skill (SKILL.md). Renaming or moving a model object is never a local edit; the name is a contract that downstream consumers depend on. Run the lineage check first, then rename, then propagate.

**Working with `te`:** rename with `te mv <old> <new> --save` or `te set <obj> -q name -i "<new>" --save`, but ONLY after the lineage check below. Never rename a model object in isolation.

## Why renaming is dangerous

A measure, column, or table name is referenced far beyond the model. Renaming breaks, often silently:

- **Report visuals** bound to the old name ; the visual drops the field or errors, and Power BI does not auto-repair code-edited PBIR
- **Other model objects** (measures, calculated columns, calc items) that reference it ; `te validate` catches these, but only these
- **Downstream models** in a composite, and every report in any workspace that binds to this model
- **Bookmarks, report-level filters, conditional formatting, and field parameters** that name the old object

`te`'s save-time validation sees model-internal breaks only. It cannot see reports or downstream models, so a structurally valid rename can still break production dashboards.

## The safe rename workflow

1. **Lineage check FIRST.** Find every consumer before touching the name:
   - the `lineage-analysis` skill, or `fab` (fabric-cli), to list reports and downstream models bound to this model across workspaces
   - `te deps "<obj>"` and `te find "<obj>" --in expressions --paths-only` for model-internal references
2. **Rename in the model:** `te mv` or `te set <obj> -q name`, then `te validate`.
3. **Propagate to reports:** rebind every affected visual, filter, and bookmark with the `pbir-cli` skill (`pbir` locates and updates the references); for service-side items use `fabric-cli` (`fab`).
4. **Re-validate:** `te validate` the model and `pbir validate` each report.

## Coordinated rename (the te + pbir tandem)

The canonical pattern: rename in the model with `te`, capture the old -> new map, then run the matching rename in `pbir-cli` against each downstream report so visual bindings, filters, and bookmarks follow. Treat the model rename and the report rename as one change set so the model and its reports never diverge in source control.

## Pitfalls

- Renaming a measure's **home table** also moves the `'OldTable'[Measure]` form that reports may use; check both the measure name and its table.
- Internal name vs display name can diverge; confirm what actually changed with `te get <obj> --output-format tmdl`.
- A **field parameter** references fields by `NAMEOF`; renaming a referenced field requires rebuilding the parameter, not just renaming.
- Renaming is the one model edit where "it validates" is not "it is safe"; the lineage step is mandatory, not optional.
