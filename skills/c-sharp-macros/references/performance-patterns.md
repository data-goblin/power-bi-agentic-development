# Performance Patterns for Macros

Query optimization and performance strategies for Tabular Editor macros.

**Source**: Extracted from production macro development at https://github.com/vdvoorder/tabular-editor-macros

## Counter-Intuitive Finding

**Multiple separate `EvaluateDax()` calls outperform batched queries.**

```csharp
// ❌ Slower: Batched with UNION
string dax = "UNION(\n" +
    String.Join(",\n", allQueries) +
    ")";
var result = EvaluateDax(dax);

// ✅ Faster: Separate calls
foreach (var query in allQueries)
{
    var result = EvaluateDax(query);
    ProcessResult(result);
}
```

**Why**: The DAX engine parallelizes separate `EvaluateDax()` calls more effectively than it can parallelize subqueries within a single UNION.

**Tested**: 2x slower with batching on 15M row table, 5 columns.

**When to batch anyway**: When queries share expensive VAR calculations (rare).

## Pattern 1: TopN Sampling

For large tables, sample first N rows:

```csharp
const int SampleSize = 10000;

string dax = $@"
VAR _sample = TOPN({SampleSize}, {tableName})
RETURN
COUNTROWS(_sample)
";
```

**Trade-offs**:
- **Pros**: 10-100x faster on large tables, still representative
- **Cons**: Approximate statistics, may miss rare values
- **When**: Tables > 1M rows, interactive scenarios

**Performance example**:
- 10M rows, full scan: 28s
- 10M rows, TopN(10000): 0.6s
- **47x speedup**

## Pattern 2: Stopwatch Timing

Instrument your macros for performance feedback:

```csharp
var stopwatch = System.Diagnostics.Stopwatch.StartNew();

// Your expensive operation
var result = EvaluateDax(dax);

stopwatch.Stop();
Output($"Query completed in {stopwatch.ElapsedMilliseconds}ms");

// Or: Display in column header
string header = $"Results ({stopwatch.ElapsedMilliseconds / 1000.0:F2}s)";
```

**Benefits**:
- User feedback
- Identify slow queries during development
- Compare optimization approaches

## Pattern 3: Pre-Scanning for Conditional Logic

Scan once to determine if expensive operations are needed:

```csharp
// Quick scan: Check if any rows meet criteria
bool needsExpensiveCalc = false;
foreach (var row in quickResult.Rows)
{
    if (MeetsCriteria(row))
    {
        needsExpensiveCalc = true;
        break;  // Stop as soon as we find one
    }
}

// Only run expensive calculation if needed
if (needsExpensiveCalc)
{
    string expensiveDax = /* ... */;
    var expensiveResult = EvaluateDax(expensiveDax);
}
```

**Why**: Avoid unnecessary calculations when result would be empty/zero.

## Pattern 4: Phased Execution

Separate cheap and expensive operations:

```csharp
// Phase 1: Quick metadata (always fast)
string metadataDax = /* column counts, table sizes */;
var metadata = EvaluateDax(metadataDax);

// Phase 2: Medium cost (only for relevant objects)
var relevantObjects = FilterBasedOnMetadata(metadata);
foreach (var obj in relevantObjects)
{
    var result = EvaluateDax(BuildQuery(obj));
}

// Phase 3: Expensive operations (only if user requests)
if (includeDeepAnalysis)
{
    var deepResult = EvaluateDax(expensiveQuery);
}
```

**Pattern**: Progressive disclosure - do cheap work first, expensive work only if needed.

## Pattern 5: Query Result Caching

For repeated queries on same data:

```csharp
var cache = new Dictionary<string, System.Data.DataTable>();

System.Data.DataTable GetOrExecute(string dax)
{
    if (cache.ContainsKey(dax))
        return cache[dax];

    var result = EvaluateDax(dax) as System.Data.DataTable;
    cache[dax] = result;
    return result;
}
```

**When useful**: Macros that iterate, user might run multiple times on same selection.

**Caveat**: Cache invalidation is hard. Consider macro runtime - if short, caching may not be worth complexity.

## Pattern 6: Avoiding Redundant Calculations

Don't calculate what you already know:

```csharp
// ❌ Recalculates table row count for every column
foreach (var col in columns)
{
    string dax = $"ROW(\"Column\", \"{col.Name}\", \"TableSize\", COUNTROWS({table}))";
    // TableSize is same for every column!
}

// ✅ Calculate once, reuse
string tableSizeDax = $"ROW(\"Size\", COUNTROWS({table}))";
var sizeResult = EvaluateDax(tableSizeDax);
long tableSize = Convert.ToInt64(sizeResult.Rows[0]["[Size]"]);

foreach (var col in columns)
{
    // Use tableSize variable instead of querying again
}
```

## Pattern 7: Limiting Results

When you only need a few examples:

```csharp
// Instead of full distinct values:
string dax = $"EVALUATE DISTINCT({column})";  // Could be millions

// Limit to first N:
string dax = $"EVALUATE TOPN(100, DISTINCT({column}))";  // Max 100 rows
```

**Use case**: Showing sample values, not complete list.

## Optimization Anti-Patterns

### ❌ Don't: Batch queries that could fail independently
```csharp
// One problematic column fails entire batch
string dax = "UNION(" + allColumnQueries + ")";
```

### ❌ Don't: Calculate expensive statistics you won't use
```csharp
// Always calculating median/stdev even if user only wants count
```

### ❌ Don't: Use UNION when simple iteration is fine
```csharp
// For 3-5 objects, separate queries may be simpler and faster
```

### ❌ Don't: Forget InvariantCulture for number formatting
```csharp
// Slow query on large tables made slower by culture-dependent formatting
var display = value.ToString();  // Uses current culture

// Fast and correct
var display = value.ToString(CultureInfo.InvariantCulture);
```

## General Principles

1. **Separate queries often beat batched queries** (DAX engine parallelization)
2. **Sample before analyzing** (TopN for large tables)
3. **Calculate once, reuse** (don't recalculate same values)
4. **Scan before expensive ops** (skip unnecessary work)
5. **Progressive disclosure** (cheap operations first)
6. **Instrument with timing** (measure, don't guess)

## Performance by Table Size

**General guidance** (varies by query complexity):

| Table Size | Strategy | Expected Time |
|------------|----------|---------------|
| < 100K rows | Full scans fine | < 1s |
| 100K - 1M | Consider TopN for histograms | 1-5s full, < 1s sampled |
| 1M - 10M | Use TopN, separate queries | 5-30s full, 1-2s sampled |
| > 10M rows | TopN essential, phase execution | 30s+ full, 2-3s sampled |

**Note**: These are for typical column profiling operations. Simple counts are much faster.

## Benchmarking Pattern

Test optimization approaches:

```csharp
var sw = System.Diagnostics.Stopwatch.StartNew();

// Approach 1
var result1 = ApproachOne();
var time1 = sw.ElapsedMilliseconds;
Output($"Approach 1: {time1}ms");

sw.Restart();

// Approach 2
var result2 = ApproachTwo();
var time2 = sw.ElapsedMilliseconds;
Output($"Approach 2: {time2}ms, difference: {time2 - time1}ms");
```

**Important**: Test on representative data size. Optimizations that help with 100K rows may hurt with 10M rows.

## Cold vs Warm Cache

First query execution is slower (storage engine cache):

```csharp
// Warm up
EvaluateDax("EVALUATE {1}");

// Now benchmark
var sw = Stopwatch.StartNew();
var result = EvaluateDax(actualQuery);
// Timing is now more consistent
```

**For user-facing macros**: Don't worry about this. Users care about actual runtime, not cache-warmed benchmarks.

## Reference

For real-world performance data and testing methodology, see: https://github.com/vdvoorder/tabular-editor-macros/blob/main/DEVELOPMENT_NOTES.md
