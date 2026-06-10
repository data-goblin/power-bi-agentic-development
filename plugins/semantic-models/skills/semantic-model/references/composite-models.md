# Composite models

Companion to the `semantic-model` skill (SKILL.md). Original guidance; each section cites its sources.

**Working with `te`:** inspect each table mode and source group with `te script` (TOM `Partitions[0].Mode`); promote shared dimensions to Dual to keep cross-table joins regular. Confirm no path went limited with `te query -q "EVALUATE INFO.VIEW.RELATIONSHIPS()"` after edits.

## Composite-model tuning: source groups, regular vs limited, Direct-Lake-plus-Import

A composite partitions tables into source groups (the Import/Direct-Lake cache is one; each DQ source is its own). Performance and even correctness depend on whether a query stays inside one group. The runtime branches four ways, only the first three fast: (1) Import/Dual only -> cache; (2) Dual + DQ from the same source -> few native queries, regular relationships; (3) Dual/Hybrid + DQ same source -> cache for import partitions, native for the rest; (4) **anything cross-source-group** -> limited relationships everywhere in that path, groupings shipped as materialized subqueries, and **rows dropped when keys don't match across groups** (an RI gap becomes a silent wrong total).

The single-source regular-relationship rule: many-side Dual needs one-side Dual; many-side Import needs Import or Dual; many-side DirectQuery needs DirectQuery or Dual. Cross-source regular only when both tables are Import; m2m is always limited. The exception worth knowing: a true composite of Direct Lake **on OneLake** + Import supports **regular** relationships across the two, unlike classic DQ+Import (limited only) ; so a billion-row Delta fact in Direct Lake plus small Import dimensions avoids the cross-group penalty. Direct Lake on SQL does not support this; convert to OneLake first.

Tuning workflow: enumerate each table's mode + bound source (`te script` over `Partitions[0]`), promote dimensions shared with a DQ fact to Dual, re-check relationship types and flag any non-`Regular`. For DQ source tuning the source side matters more ; ensure warehouse indexes support the emitted joins/filters/groupings (a source-DBA task, not te-cli). Keep caches in sync (the engine will not mask a Dual/import-vs-DQ gap; fix data integrity at the source). Direct Lake on SQL silently falls back to DQ for view-based tables and granular RLS, quietly turning a "Direct Lake" model into a slow DQ one ; OneLake web-modeling composites avoid this.

Sources: learn.microsoft.com composite-model-guidance; learn.microsoft.com aggregations-advanced (regular vs limited); learn.microsoft.com direct-lake-web-modeling; learn.microsoft.com direct-lake-develop; local forums DB (composite-sluggish, Direct-Lake-edit threads)
