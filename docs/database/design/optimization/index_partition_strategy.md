# Strategy: Index and Partition Creation - Before vs After Population

## 📊 Current Situation
- **Existing records**: ~8.7 million in `green_assets`
- **Partitions**: DEFAULT + Lazio (12) + Lombardia (3)
- **Indexes**: Base on DEFAULT + partial composite indexes on specific partitions

---

## 🔍 ANALYSIS: Indexes

### ✅ **CREATE INDEXES BEFORE** (Empty Table)

**Advantages:**
- ⚡ **Very fast creation**: on empty table, GIST indexes are created in seconds
- 📦 **Minimal initial size**: empty indexes take little space
- 🔄 **Automatic maintenance**: PostgreSQL updates indexes during INSERT/UPDATE

**Disadvantages:**
- 🐌 **Slower INSERT/UPDATE**: each insert must update all indexes
- 💾 **Overhead during bulk load**: with millions of records, slows significantly
- ⏱️ **Total population time**: can increase by 30-50%

**Practical example:**
```sql
-- With indexes: 1000 insert/sec
-- Without indexes: 5000 insert/sec (5x faster)
-- But creating indexes after on 8.7M records: 10-30 minutes
```

---

### ✅ **CREATE INDEXES AFTER** (Populated Table)

**Advantages:**
- 🚀 **Very fast bulk load**: INSERT without index update overhead
- 📈 **Parallel population**: you can insert data in parallel without lock
- 🎯 **Optimized indexes**: PostgreSQL can use real statistics to optimize

**Disadvantages:**
- ⏳ **Slow creation**: on 8.7M records, GIST indexes take 10-30 minutes
- 🔒 **Lock during creation**: some indexes require exclusive locks
- 💾 **Temporary space**: index creation needs extra space (2-3x table size)

**Practical example:**
```sql
-- Populate 8.7M records: 30 minutes (without indexes)
-- Create indexes after: 15 minutes
-- TOTAL: 45 minutes

-- Populate 8.7M records: 60 minutes (with indexes)
-- TOTAL: 60 minutes
```

---

## 🔍 ANALYSIS: Partitions

### ✅ **CREATE PARTITIONS BEFORE** (Initial Schema)

**Advantages:**
- 🎯 **Immediate partition pruning**: queries optimized from the start
- 📋 **Clear schema**: database structure defined upfront
- ⚡ **No data movement**: data goes directly into the correct partition

**Disadvantages:**
- 🔮 **You must know the regions**: you need to anticipate which regions you will populate
- 📝 **Maintenance**: if you add new regions, you must create partitions manually
- 🗂️ **Empty partitions**: you create partitions that may never be used

**Example:**
```sql
-- Create 20 partitions for all Italian regions
-- But populate only Lazio and Lombardia
-- Result: 18 empty partitions
```

---

### ✅ **CREATE PARTITIONS AFTER** (On-Demand)

**Advantages:**
- 🎯 **Flexibility**: create partitions only when needed
- 📊 **Real data**: create partitions based on actual data
- 🔄 **Incremental approach**: add partitions as data grows

**Disadvantages:**
- 🔄 **Data movement**: you must move data from DEFAULT to the specific partition
- ⏱️ **Temporary overhead**: DETACH + INSERT + DELETE takes time
- 🔒 **Lock during move**: can block queries during migration

**Example:**
```sql
-- Data in DEFAULT: 8.7M records
-- Create Lazio partition: 1 second
-- Move data: 5-10 minutes (INSERT + DELETE)
-- TOTAL: 5-10 minutes per partition
```

---

## 🎯 RECOMMENDATION: Hybrid Approach

### **PHASE 1: Initial Schema** (Before Population)

```sql
-- ✅ CREATE:
-- 1. Partitioned tables with DEFAULT
-- 2. BASE indexes on reference tables (regions, provinces, municipalities, districts)
-- 3. BASE indexes on DEFAULT partition (only essential ones)
-- 4. GIST indexes on geometry (essential for spatial queries)

-- ❌ DO NOT CREATE:
-- 1. Partial composite indexes (too specific, better after)
-- 2. Region-specific partitions (better on-demand)
-- 3. Non-essential indexes (can wait)
```

**Rationale:**
- Base indexes on reference tables are small and fast
- GIST indexes on DEFAULT are needed for basic spatial queries
- Avoid overhead during massive bulk load

---

### **PHASE 2: During Population** (On-Demand)

```sql
-- ✅ CREATE PARTITIONS ON-DEMAND:
-- When inserting data for a region, create the specific partition
-- (already implemented in municipality_populate.sql STEP 2)

-- ✅ CREATE BASE INDEXES ON THE PARTITION:
-- GIST on geometry and base indexes on filter columns
-- (already implemented in municipality_populate.sql STEP 2)
```

**Rationale:**
- Partitions created only when needed
- Base indexes on partition for immediate queries
- Data goes directly into the correct partition (no movement)

---

### **PHASE 3: After Population** (Optimization)

```sql
-- ✅ CREATE PARTIAL COMPOSITE INDEXES:
-- After populating data, create indexes optimized for specific queries
-- (already implemented in 02-init-indexes.sql and repartition_and_reindex.sql)

-- ✅ REINDEX AND ANALYZE:
-- After creating indexes, run REINDEX and ANALYZE to optimize
-- (already implemented in repartition_and_reindex.sql)
```

**Rationale:**
- Partial composite indexes are optimized for specific query patterns
- They need real statistics to be effective
- Better to create them after understanding query patterns

---

## 📋 CHECKLIST: Optimal Strategy

### ✅ **Before Population** (`01-init-schema.sql` + `02-init-indexes.sql`)

- [x] Partitioned tables with DEFAULT
- [x] Indexes on reference tables (regions, provinces, municipalities, districts)
- [x] GIST indexes on geometry for DEFAULT
- [x] Base indexes on filter columns for DEFAULT
- [ ] ~~Partial composite indexes~~ (after)
- [ ] ~~Region-specific partitions~~ (on-demand)

### ✅ **During Population** (`municipality_populate.sql` STEP 2)

- [x] Create region-specific partition (on-demand)
- [x] Create base indexes on partition (GIST + filter columns)
- [ ] ~~Partial composite indexes~~ (after)

### ✅ **After Population** (`repartition_and_reindex.sql`)

- [x] Create partial composite indexes on all partitions
- [x] REINDEX all partitions
- [x] ANALYZE to update statistics
- [x] Move data from DEFAULT to specific partitions (if needed)

---

## 🚀 PERFORMANCE: Comparison

### Scenario A: Indexes Before (❌ Not Recommended)
```
Population: 60 minutes (with index overhead)
Composite index creation: 5 minutes
TOTAL: 65 minutes
```

### Scenario B: Indexes After (✅ Recommended)
```
Population: 30 minutes (no overhead)
Base index creation: 10 minutes
Composite index creation: 5 minutes
TOTAL: 45 minutes (30% faster)
```

### Scenario C: Partitions Before (⚠️ Partially Recommended)
```
Create 20 partitions: 1 minute
Population: 30 minutes (data goes directly into partition)
TOTAL: 31 minutes
PROBLEM: 18 unused empty partitions
```

### Scenario D: Partitions On-Demand (✅ Recommended)
```
Population in DEFAULT: 30 minutes
Create Lazio partition: 1 second
Data movement: 5 minutes (only if needed)
TOTAL: 35 minutes
ADVANTAGE: Flexibility, only needed partitions
```

---

## 💡 CONCLUSION

**The current strategy is OPTIMAL:**

1. ✅ **Initial schema**: Tables + DEFAULT + essential base indexes
2. ✅ **During population**: On-demand partitions + base indexes on partition
3. ✅ **After population**: Partial composite indexes + REINDEX + ANALYZE

**Do not change it!** The hybrid approach you implemented is best practice for geospatial databases with millions of records.

---

## 📚 References

- `infrastructure/scripts/init/postgis/sql/01-init-schema.sql`: Initial schema with DEFAULT
- `infrastructure/scripts/init/postgis/sql/02-init-indexes.sql`: Base + partial composite indexes
- `infrastructure/scripts/database/seed/boost_municipality/municipality_populate.sql`: On-demand partitions during population
- `infrastructure/scripts/database/optimize/repartition_and_reindex.sql`: Post-population optimization
