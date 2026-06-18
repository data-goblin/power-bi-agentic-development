# Common DuckDB Query Patterns

## Data Freshness Check

```sql
SELECT max(date_column) as latest_date, count(*) as total_rows
FROM delta_scan('abfss://.../<lh-id>/Tables/schema/orders');
```

## Data Quality Validation

```sql
SELECT
  count(*) as total,
  count(DISTINCT customer_id) as unique_customers,
  count(*) FILTER (WHERE amount IS NULL) as null_amounts,
  min(order_date) as earliest,
  max(order_date) as latest
FROM delta_scan('abfss://.../<lh-id>/Tables/schema/orders');
```

## Schema Discovery

```sql
DESCRIBE SELECT * FROM delta_scan('abfss://.../<lh-id>/Tables/schema/customers');

SELECT column_name, column_type, count, approx_count_distinct, null_percentage
FROM (SUMMARIZE delta_scan('abfss://.../<lh-id>/Tables/schema/customers'));
```

## Cross-Table Joins

```sql
SELECT o.order_date, c.customer_name, sum(o.amount) as total
FROM delta_scan('.../Tables/schema/orders') o
JOIN delta_scan('.../Tables/schema/customers') c ON o.customer_id = c.customer_id
GROUP BY 1, 2
ORDER BY 3 DESC LIMIT 20;
```

## Row Count Audit

```sql
SELECT 'orders' as tbl, count(*) as rows FROM delta_scan('.../Tables/schema/orders')
UNION ALL
SELECT 'customers', count(*) FROM delta_scan('.../Tables/schema/customers')
ORDER BY tbl;
```
