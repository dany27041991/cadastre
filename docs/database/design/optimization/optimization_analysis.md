# Clustering Query Optimization Analysis

## Current State

Queries are already well optimized with:
- ✅ Partition pruning (region_id)
- ✅ GIST indexes on geometry
- ✅ Btree indexes on geometry_type, municipality_id, region_id
- ✅ Use of ST_Intersects before ST_Within
- ✅ CTEs to avoid repeated subqueries

**Current timings:**
- High zoom: 75-176 ms
- Medium zoom: 84-320 ms
- Low zoom: 2.3-2.7 seconds
- Worst case (entire region): 24-28 seconds

## Execution Plan Analysis

From the plan for the slowest query (VERSION 6C - Lazio region):

```
Rows Removed by Filter: 3,026,660
Execution Time: 15,057 ms
```

**Identified issue:**
- The `geometry_type = 'point'` filter is applied **AFTER** using the GIST index
- This causes 3M+ rows to be scanned and then filtered
- Indexes on geometry_type, municipality_id, region_id are separate and not combined effectively

## Recommended Optimizations

### 🎯 HIGH PRIORITY (Implement immediately)

#### 1. Partial Composite Indexes for Territorial Filters
**Impact:** 30-50% time reduction for municipality/province/sub-municipal area queries  
**Cost:** Medium (extra disk space ~50-150MB per partition)

**Real query patterns:**
- Always: `region_id`, `province_id`, `municipality_id`
- Sometimes: `sub_municipal_area_id` (only for municipalities with sub-municipal areas, ~40% of points)

**Recommended indexes:**

```sql
-- For MUNICIPALITY queries (most common)
CREATE INDEX idx_ga_12_point_municipality_region
ON cadastre.green_assets_12(geometry_type, region_id, municipality_id)
WHERE geometry_type = 'point';

-- For PROVINCE queries
CREATE INDEX idx_ga_12_point_province_region
ON cadastre.green_assets_12(geometry_type, region_id, province_id)
WHERE geometry_type = 'point';

-- For sub-municipal area queries (only for municipalities with sub-municipal areas)
CREATE INDEX idx_ga_12_point_sub_municipal_municipality_region
ON cadastre.green_assets_12(geometry_type, region_id, municipality_id, sub_municipal_area_id)
WHERE geometry_type = 'point' AND sub_municipal_area_id IS NOT NULL;
```

**Benefit:** PostgreSQL can filter geometry_type + territorial filters BEFORE applying the GIST index, greatly reducing rows to process.

**Column order:** `region_id` (already partitioned) → `province_id` → `municipality_id` → `sub_municipal_area_id` (by selectivity)

**When to use:**
- Municipality query: use index `*_point_municipality_region` (most cases)
- Province query: use index `*_point_province_region`
- Sub-municipal area query: use index `*_point_sub_municipal_municipality_region` (only for municipalities with sub-municipal areas)

#### 2. Update Database Statistics
**Impact:** 10-20% time reduction  
**Cost:** Low (execution time)

```sql
ANALYZE cadastre.green_assets;
ANALYZE cadastre.green_assets_12;
ANALYZE public.municipalities;
ANALYZE public.regions;
```

**Benefit:** Allows the planner to choose the best execution plan.

**When to run:** After bulk inserts/updates, weekly or monthly.

### 🎯 MEDIUM PRIORITY (Evaluate based on workload)

#### 3. Limit Points for Entire-Region Queries
**Impact:** 50%+ reduction for extreme cases  
**Cost:** Low (acceptable precision loss for low zoom)

```sql
-- Limit to 1M points for entire-region queries
LIMIT 1000000
```

**Benefit:** For very low zoom, showing all points is not needed. Clustering on a representative sample is sufficient.

**When to use:** Batch queries over entire regions (VERSION 6B/6C)

#### 4. Parallel Query Execution
**Impact:** 20-40% reduction on long queries  
**Cost:** Low (configuration)

```sql
SET max_parallel_workers_per_gather = 4;
```

**Benefit:** Uses multiple CPUs for large-dataset queries.

**When to use:** Server with 4+ CPU cores, queries processing >100K points.

### 🎯 LOW PRIORITY (Only for specific cases)

#### 5. Partial GIST Indexes
**Impact:** 20-30% reduction  
**Cost:** High (large disk space, ~500MB+ per partition)

```sql
CREATE INDEX idx_ga_12_geom_point
ON cadastre.green_assets_12 USING GIST(geometry)
WHERE geometry_type = 'point';
```

**Benefit:** Dedicated GIST index for points only, more efficient.

**When to use:** Only if most queries are on points and disk space is available.

#### 6. Materialized Views for Frequent Queries
**Impact:** 90%+ reduction for frequent queries  
**Cost:** Medium (disk space + periodic refresh)

```sql
CREATE MATERIALIZED VIEW cadastre.green_assets_clusters_lazio AS
-- Pre-clustered query
```

**Benefit:** Instant queries for very frequent specific boxes.

**When to use:** Only for boxes queried hundreds of times per day.

## Expected Improvement Estimates

| Optimization       | High Zoom | Medium Zoom | Low Zoom | Worst Case |
|--------------------|-----------|-------------|----------|------------|
| **None**           | 75-176 ms | 84-320 ms   | 2.3-2.7s | 24-28s     |
| **+ Composite indexes** | 50-120 ms | 60-220 ms | 1.6-1.9s | 17-20s     |
| **+ Limit points** | -         | -           | -        | 12-15s     |
| **+ Parallel query** | -        | -           | 1.2-1.5s | 10-12s     |
| **All**            | **50-120 ms** | **60-220 ms** | **1.2-1.5s** | **10-12s** |

**Estimated overall reduction:** 30-50% for normal queries, 50-60% for extreme cases.

## Final Recommendations

### For Immediate Production:
1. ✅ **Implement partial composite indexes for municipality** (OPTIMIZATION 1)
   - Priority: Index `*_point_municipality_region` (most common query)
   - Optional: Indexes for province and sub_municipal_area if used frequently
2. ✅ **Run ANALYZE periodically** (OPTIMIZATION 2)
3. ✅ **Limit points for entire-region queries** (OPTIMIZATION 3)

### For Advanced Optimization:
4. ⚠️ **Evaluate parallel query** if server has multiple CPUs
5. ⚠️ **Consider materialized views** only for very frequent boxes

### Not Recommended (for now):
- ❌ Partial GIST indexes (cost too high vs benefit)
- ❌ Overly complex queries that could hurt readability

## Conclusions

**Queries are already well optimized**, but there is still room for improvement:

1. **Partial composite indexes** can reduce times by 30-50% for municipality queries
2. **Limiting points** for entire-region queries can halve times
3. **Parallel query** can help on multi-core servers

**Expected times after optimizations:**
- High zoom: **50-120 ms** (already good)
- Medium zoom: **60-220 ms** (already good)
- Low zoom: **1.2-1.5s** (40-50% improvement)
- Worst case: **10-12s** (50-60% improvement)

**Recommendation:** Implement at least the HIGH PRIORITY optimizations for significant gains at contained cost.
