# Model and Direct Lake Optimization

Tier 3 model patterns (MDL001-MDL010) and Tier 4 Direct Lake patterns (DL001-DL002).

> **Related references:** [Engine Internals](./engine-internals.md) · [DAX and Query Structure Patterns](./dax-patterns.md)

---

## Section 5: Tier 3 Model Optimization Patterns

> **STOP — Requires user approval before applying any change. Warn that model changes can break downstream reports. Suggest working on a model copy. Implement via `powerbi-semantic-model` skill; upstream source changes (Lakehouse, Warehouse, Power Query) require `fabric-cli` or pipeline coordination.**

### General Data Layout Best Practices

Data layout decisions affect performance at the source level — before DAX, before the SE. Apply after exhausting DAX and query structure optimizations; changes here require ETL or pipeline modifications. Apply to both Import and Direct Lake.

1. **Remove unused columns and filter rows at the source.**
2. **Drop all-null/all-zero fact rows** that never contribute to results.
3. **Move low-cardinality string attributes off the fact table** into dimensions with integer keys.
4. **Partition on high-filter columns** (DateKey, TenantKey) so the engine skips entire files. Use **Z-order clustering** when partitioning creates too many small files.
5. **Presort on the most filtered/grouped column first** (e.g., DateKey, then ProductKey). RLE compression improves dramatically when values cluster into longer runs per segment.
6. **Use optimal data types.** See MDL003.

---

### MDL001: Many-to-Many Relationship Optimization

Bridge tables create expanded tables the engine materializes every query. The right layout depends on filter paths, bridge cardinality, and RLS. Test each option. Scenario: `User` (security), `Customer` (dimension), `UserCustomer` (bridge), `Fact`.

**A — Canonical (bidir bridge):** `User 1──* UserCustomer *──bidir──1 Customer 1──* Fact`
Customer filters Fact directly; bridge only traversed for User. Best when User is rarely a slicer alongside Customer. Bidir causes high FE cost when both filter together.

**B — M2M bridge to fact (no bidir):**
```
User 1──* UserCustomer *──1 Customer
                │
                *──M2M──* Fact
```
Both dims always filter through bridge M2M. Best when consistent query times matter more than peak Customer-only performance.

**C — Optimized hybrid:** `User 1──* UserCustomer *──M2M──* Fact *──1 Customer`
Customer filters Fact directly; User filters through bridge M2M. No bidir. Best general-purpose layout. Use inactive relationship + `USERELATIONSHIP` if you need Customer↔UserCustomer cross-queries.

**D — Pre-computed combination key:** `User 1──* UserCombinations *──M2M──* Fact *──1 Customer`
ETL assigns a surrogate key per unique set of customers a user can access — users with identical access share one key. Best when bridge is very large or many users share the same access patterns.

---

### MDL002: Star Schema Conformance

Snowflake schemas force multiple SE joins per query. Flatten dimension chains into a single wide dimension to reduce join depth and enable better fusion.

`Sales ──* Product ──* Subcategory ──* Category` → `Sales ──* Product [ProductKey, ProductName, Subcategory, Category]`

---

### MDL003: Column Cardinality and Data Type Optimization

High-cardinality columns inflate dictionary size and segment memory.

- **Integer keys over string keys:** Replace `"PROD-001234"` with integer surrogates.
- **Reduce timestamp precision:** `DateTime` → `Date` when queries only group by date.
- **Bin continuous values:** 50K distinct decimals → binned ranges if measure logic allows.
- **Split high-cardinality columns:** `FullAddress` (100K distinct) → `City`, `State`, `Zip`.

---

### MDL004: Aggregation Table Strategies

Pre-summarized Import tables intercept SE queries before they hit large DQ facts. Aggregate Awareness redirects automatically — no DAX changes.

**Setup:** `GROUP BY [FKs], SUM([Metrics])` → load as Import → connect to same dimensions → map in Manage Aggregations as `SUM OF [FactTable[Column]]`. Fact tables must be DQ.

**Filtered Aggs (hot/cold split):** Import only recent data (e.g., last 3 months). 95%+ queries served from Import.

---

### MDL005: Pre-Compute Period Comparison Columns

Period-over-period calcs (YoY, MoM) require two SE scans. Pre-computing prior-period values as physical columns on the fact row reduces it to one scan.

**Before (two scans):**
```dax
YoY = SUM ( 'Fact'[Sales] ) - CALCULATE ( SUM ( 'Fact'[Sales] ), SAMEPERIODLASTYEAR ( 'Date'[Date] ) )
```
**After (one scan):**
```dax
YoY = SUM ( 'Fact'[Sales] ) - SUM ( 'Fact'[SalesLY] )
```

Wider fact table, but eliminates the TI scan entirely. Best for fixed period comparisons on large DQ tables.

---

### MDL006: Row-Based Time Intelligence Table

DAX TI functions break vertical fusion — each period measure gets its own SE query. A row-based TI table pre-materializes all periods as data rows so all period measures fuse into a single SE scan.

**Table:** `Period` (slicer label), `Date` (actual dates → relationship to fact), `AxisDate` (x-axis anchor). Relate via M2M to Fact or BiDir through Calendar.

---

### MDL007: Eliminate Referential Integrity Violations

Fact FKs with no matching dimension row prevent inner-join rewriting for SWITCH/multi-measure patterns.

**Detection:**
```dax
SELECT [Dimension_Name], [RIVIOLATION_COUNT]
FROM $SYSTEM.DISCOVER_STORAGE_TABLES
WHERE [RIVIOLATION_COUNT] > 0
```

**Fix:** Add an "Unknown" catch-all row to the dimension and map missing foreign keys in fact to "Unknown" record.

---

### MDL008: Replace SEARCH/FIND Filters with Pre-Computed Boolean Columns

`SEARCH()`/`FIND()` in filters forces row-by-row string scanning. Pre-compute the result as a boolean column (cardinality 2, ~1 bit/row) for pure columnar access. Generalizes to any fixed-value logical test — date flags, category indicators, prefix checks.

---

### MDL009: Cardinality Reduction via Historical Value Substitution

Replace old key values beyond a retention window with a single placeholder to collapse cardinality and shrink dictionaries. This can be done in both facts and dimensions.

```sql
CASE WHEN SaleDate >= DATEADD(year, -1, GETDATE()) THEN SalesKey ELSE 'Historical Key' END
```

---

### MDL010: Set IsAvailableInMDX on Disconnected Slicer Tables

Disconnected slicer tables (e.g., a `'Reporting Scenario'[Scenario]` parameter table with no model relationship) are commonly used with `SELECTEDVALUE` inside `IF`/`SWITCH`. When the slicer has no active selection, `SELECTEDVALUE` returns BLANK. With `IsAvailableInMDX = false`, the engine cannot determine this statically — it queries the table and generates two evaluation branches even though only one will execute. With `IsAvailableInMDX = true`, the engine statically resolves the unfiltered state and eliminates the dead branch without an extra SE scan.

> **Scope:** This optimization only applies when the slicer column is **unfiltered**. When a selection is active, the branch is always evaluated regardless of this property — the static resolution path is not available.

---

## Section 6: Tier 4 Direct Lake Optimization Patterns

> **STOP — Requires user approval before applying any change. Changes here require Spark/ETL jobs or Fabric resource profile configuration outside the semantic model. Coordinate with the user's data engineering workflow.**

Direct Lake reads from OneLake Delta Parquet files instead of importing. Import-like speed when data is memory-resident, but unique characteristics around cold cache and segment loading.

### DL001: V-Ordering for Optimal VertiPaq Compression

Import models are always V-ordered. Direct Lake models are **not** — enable it explicitly. V-ordering reorders rows within each rowgroup to maximize RLE compression (2–5× improvement).

Two approaches:
- **Spark:** `spark.conf.set("spark.microsoft.delta.vorder.enabled", "true")` then run `OPTIMIZE`.
- **Fabric resource profile:** Use the [`readHeavyForPBI` resource profile](https://learn.microsoft.com/en-us/fabric/data-engineering/configure-resource-profile-configurations) which enables V-ordering and optimized write settings automatically.

---

### DL002: Segment Size and Parallelism

Delta rowgroups map directly to VertiPaq segments — one segment per CPU core. More segments = better CPU saturation (see SE Parallelism Factor in [Section 1](./engine-internals.md#section-1-how-the-engine-works)).

**Target: 1–16M rows per rowgroup.** Too few rowgroups → single-threaded scans; too many tiny rowgroups → merge overhead. For small tables (< 1M rows) this rarely matters. Run `OPTIMIZE` regularly to consolidate small files into properly sized rowgroups.

Maximize available cores by choosing a capacity SKU that matches table size — a table with 2 segments on an F64 wastes most of its parallelism budget.