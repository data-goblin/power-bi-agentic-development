# Storage modes (Import / DirectQuery / Dual / Hybrid)

Companion to the `semantic-model` skill (SKILL.md). Original guidance; each section cites its sources.

**Working with `te`:** read each table mode / source with `te script` over `Partitions[0]`; set the mode via `te script` (TOM `ModeType` = `import|directQuery|dual|directLake`). After any change, re-list relationships with `te query -q "EVALUATE INFO.VIEW.RELATIONSHIPS()"` to catch newly limited ones.

## Storage-mode decision matrix (Import / DirectQuery / Dual / Hybrid / Direct Lake)

Storage mode is a per-table partition property deciding where a DAX subquery is answered: VertiPaq cache (Import, Direct Lake after transcoding) or the source via native query (DirectQuery). Dual is both, decided per query. Hybrid is import partitions plus one DQ partition. Mixed modes = composite model. Direct Lake has two flavors: on OneLake (composites with Import/DQ/Dual) and on SQL (single-source, no mixing, falls back to DQ on views/granular RLS).

The biggest non-obvious lever: a dimension left **Import** on the one-side of a **DirectQuery** fact forces a cross-source-group path ; its groupings ship to the source as materialized subqueries and the relationship goes **limited**. Setting it **Dual** keeps the join intra-source-group and **regular**, so one native query handles slicer+fact, with slicers served from cache. You only get both behaviors from one table if it is Dual, not Import. Hybrid is the move for "latest live, history fast" (import bulk + one DQ tail), but hybrid tables do not support aggregations. Direct Lake on SQL cannot mix with DQ/Dual; on OneLake it can.

Mode-to-when: DirectQuery for large facts / near-real-time / unimportable volume; Import for tables not filtering a DQ/Hybrid fact, unreachable sources, all calculated tables; Dual for dimensions queried with a DQ/Hybrid fact from the same source; Hybrid for one fact needing live latest + fast history; Direct Lake on OneLake for very large Delta facts you do not refresh (composites with Import dims); Direct Lake on SQL for single-source Delta. There is no headless storage-mode dropdown ; mode is `partition.Mode` (`import|directQuery|dual|directLake`), set via `te script` (TOM `ModeType`). After any change, list relationship types (`INFO.VIEW.RELATIONSHIPS()`) to confirm you did not create limited relationships. Calculated tables are always Import regardless of what they reference; "Mixed" in Desktop is a UI label, not a fourth mode.

Sources: learn.microsoft.com service-dataset-modes-understand; learn.microsoft.com composite-model-guidance; learn.microsoft.com direct-lake-overview; learn.microsoft.com directquery-model-guidance
