---
type: llm
weight: 1
---

PASS if the reply says DuckDB 2.0 can write Delta (create table, insert/append, and CTAS or COPY ... (FORMAT delta) from 2.0.1) while UPDATE, DELETE and MERGE are not supported, and says OneLake behaviour should be tested or falls back to Spark for those. FAIL if it says DuckDB is read-only for Delta.
