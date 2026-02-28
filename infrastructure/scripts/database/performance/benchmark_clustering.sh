#!/bin/bash
# Benchmark script for green assets clustering queries

set -e

DB_USER="${DB_USER:-cadastre}"
DB_NAME="${DB_NAME:-arboreal_green_cadastre}"
CONTAINER="${CONTAINER:-postgis}"

echo "=============================================================================="
echo "BENCHMARK GREEN ASSETS CLUSTERING QUERIES"
echo "=============================================================================="
echo "Date: $(date)"
echo ""

# Run query and measure time
run_query() {
    local version=$1
    local description=$2
    local query=$3
    
    echo "---"
    echo "VERSION $version: $description"
    echo "---"
    
    # Execute query with timing
    docker compose exec -T $CONTAINER psql -U $DB_USER -d $DB_NAME \
        -c "\timing on" \
        -c "$query" \
        2>&1 | grep -E "(Time:|rows?\)|ERROR|NOTICE)" | head -20
    
    echo ""
}

# VERSION 1: Base query with parameters
run_query "1" "Base query with parameters (medium zoom - box 0.02 degrees)" \
"WITH municipality_info AS (
    SELECT c.id as municipality_id, p.region_id, p.id as province_id, c.geometry as municipality_geom
    FROM public.municipalities c
    INNER JOIN public.provinces p ON c.province_id = p.id
    WHERE c.name = 'Roma'
    LIMIT 1
),
box_envelope AS (
    SELECT ST_MakeEnvelope(12.48, 41.88, 12.50, 41.90, 4326) as box_geom
),
points AS (
    SELECT av.id, av.geometry, av.asset_type, av.species
    FROM cadastre.green_assets av
    CROSS JOIN municipality_info c
    CROSS JOIN box_envelope b
    WHERE av.geometry_type = 'P'
      AND av.region_id = c.region_id
      AND av.province_id = c.province_id
      AND av.municipality_id = c.municipality_id
      AND ST_Intersects(av.geometry, b.box_geom)
      AND ST_Within(av.geometry, c.municipality_geom)
),
box_width AS (
    SELECT 12.50 - 12.48 as width
)
SELECT 
    cluster_id,
    COUNT(*) as num_points,
    ST_AsGeoJSON(ST_Centroid(ST_Collect(geometry)))::jsonb as geometry
FROM (
    SELECT 
        id,
        geometry,
        asset_type,
        species,
        ST_ClusterKMeans(geometry, 50) OVER() as cluster_id
    FROM points, box_width
    WHERE box_width.width >= 0.01
) clustered
GROUP BY cluster_id
ORDER BY cluster_id
LIMIT 10;"

# VERSION 2: Maximum zoom
run_query "2" "Maximum zoom - Small box (0.005 degrees) - Individual points" \
"WITH municipality_info AS (
    SELECT c.id as municipality_id, p.region_id, p.id as province_id, c.geometry as municipality_geom
    FROM public.municipalities c
    INNER JOIN public.provinces p ON c.province_id = p.id
    WHERE c.name = 'Roma'
    LIMIT 1
),
points AS (
    SELECT av.id, av.geometry, av.asset_type, av.species
    FROM cadastre.green_assets av
    CROSS JOIN municipality_info c
    WHERE av.geometry_type = 'P'
      AND av.region_id = c.region_id
      AND av.province_id = c.province_id
      AND av.municipality_id = c.municipality_id
      AND ST_Intersects(av.geometry, ST_MakeEnvelope(12.48, 41.88, 12.485, 41.885, 4326))
      AND ST_Within(av.geometry, c.municipality_geom)
)
SELECT COUNT(*) as total_points FROM points;"

# VERSION 3: High zoom
run_query "3" "High zoom - Small-medium box (0.01 degrees) - Individual points" \
"WITH points AS (
    SELECT id, geometry, asset_type, species
    FROM cadastre.green_assets
    WHERE geometry_type = 'P'
      AND ST_Within(geometry, ST_MakeEnvelope(12.48, 41.88, 12.49, 41.89, 4326))
      AND ST_Within(geometry, (SELECT geometry FROM public.municipalities WHERE name = 'Roma' LIMIT 1))
)
SELECT COUNT(*) as total_points FROM points;"

# VERSION 4: Medium zoom
run_query "4" "Medium zoom - Medium box (0.02 degrees) - 50 clusters" \
"WITH points AS (
    SELECT id, geometry, asset_type, species
    FROM cadastre.green_assets
    WHERE geometry_type = 'P'
      AND ST_Within(geometry, ST_MakeEnvelope(12.48, 41.88, 12.50, 41.90, 4326))
      AND ST_Within(geometry, (SELECT geometry FROM public.municipalities WHERE name = 'Roma' LIMIT 1))
),
clustered AS (
    SELECT 
        id,
        geometry,
        asset_type,
        species,
        ST_ClusterKMeans(geometry, 50) OVER() as cluster_id
    FROM points
)
SELECT COUNT(DISTINCT cluster_id) as num_clusters, COUNT(*) as total_points FROM clustered;"

# VERSION 5: Low zoom
run_query "5" "Low zoom - Large box (0.2 degrees) - 50 clusters" \
"WITH points AS (
    SELECT id, geometry, asset_type, species
    FROM cadastre.green_assets
    WHERE geometry_type = 'P'
      AND ST_Within(geometry, ST_MakeEnvelope(12.4, 41.8, 12.6, 42.0, 4326))
      AND ST_Within(geometry, (SELECT geometry FROM public.municipalities WHERE name = 'Roma' LIMIT 1))
),
clustered AS (
    SELECT 
        id,
        geometry,
        asset_type,
        species,
        ST_ClusterKMeans(geometry, 50) OVER() as cluster_id
    FROM points
)
SELECT COUNT(DISTINCT cluster_id) as num_clusters, COUNT(*) as total_points FROM clustered;"

# VERSION 6: Minimum zoom
run_query "6" "Minimum zoom - Very large box (0.7 degrees) - 20 clusters" \
"WITH points AS (
    SELECT id, geometry, asset_type, species
    FROM cadastre.green_assets
    WHERE geometry_type = 'P'
      AND ST_Within(geometry, ST_MakeEnvelope(12.2, 41.6, 12.9, 42.2, 4326))
      AND ST_Within(geometry, (SELECT geometry FROM public.municipalities WHERE name = 'Roma' LIMIT 1))
),
clustered AS (
    SELECT 
        id,
        geometry,
        asset_type,
        species,
        ST_ClusterKMeans(geometry, 20) OVER() as cluster_id
    FROM points
)
SELECT COUNT(DISTINCT cluster_id) as num_clusters, COUNT(*) as total_points FROM clustered;"

# VERSION 6B: Worst case - Lazio bounding box
run_query "6B" "WORST CASE - Full Lazio region bounding box (2.6 degrees) - 20 clusters" \
"WITH lazio_region AS (
    SELECT id as region_id, geometry as region_geom
    FROM public.regions
    WHERE name = 'Lazio'
    LIMIT 1
),
points AS (
    SELECT av.id, av.geometry, av.asset_type, av.species
    FROM cadastre.green_assets av
    CROSS JOIN lazio_region r
    WHERE av.geometry_type = 'P'
      AND av.region_id = r.region_id
      AND ST_Intersects(av.geometry, ST_MakeEnvelope(11.449370420563334, 40.78473374858241, 14.02764450725866, 42.83868318987591, 4326))
      AND ST_Within(av.geometry, r.region_geom)
),
clustered AS (
    SELECT 
        id,
        geometry,
        asset_type,
        species,
        ST_ClusterKMeans(geometry, 20) OVER() as cluster_id
    FROM points
)
SELECT COUNT(DISTINCT cluster_id) as num_clusters, COUNT(*) as total_points FROM clustered;"

# VERSION 6C: Worst case - Lazio polygon
run_query "6C" "WORST CASE - Direct Lazio region polygon - 20 clusters" \
"WITH lazio_region AS (
    SELECT id as region_id, geometry as region_geom
    FROM public.regions
    WHERE name = 'Lazio'
    LIMIT 1
),
points AS (
    SELECT av.id, av.geometry, av.asset_type, av.species
    FROM cadastre.green_assets av
    CROSS JOIN lazio_region r
    WHERE av.geometry_type = 'P'
      AND av.region_id = r.region_id
      AND ST_Intersects(av.geometry, r.region_geom)
      AND ST_Within(av.geometry, r.region_geom)
),
clustered AS (
    SELECT 
        id,
        geometry,
        asset_type,
        species,
        ST_ClusterKMeans(geometry, 20) OVER() as cluster_id
    FROM points
)
SELECT COUNT(DISTINCT cluster_id) as num_clusters, COUNT(*) as total_points FROM clustered;"

# VERSION 7: Full query with conditional logic (high zoom)
run_query "7a" "Full query - High zoom (box 0.005 degrees) - Individual points" \
"WITH municipality_info AS (
    SELECT c.id as municipality_id, p.region_id, p.id as province_id, c.geometry as municipality_geom
    FROM public.municipalities c
    INNER JOIN public.provinces p ON c.province_id = p.id
    WHERE c.name = 'Roma'
    LIMIT 1
),
box_envelope AS (
    SELECT ST_MakeEnvelope(12.48, 41.88, 12.485, 41.885, 4326) as box_geom
),
points AS (
    SELECT av.id, av.geometry, av.asset_type, av.species
    FROM cadastre.green_assets av
    CROSS JOIN municipality_info c
    CROSS JOIN box_envelope b
    WHERE av.geometry_type = 'P'
      AND av.region_id = c.region_id
      AND av.province_id = c.province_id
      AND av.municipality_id = c.municipality_id
      AND ST_Intersects(av.geometry, b.box_geom)
      AND ST_Within(av.geometry, c.municipality_geom)
),
box_width AS (
    SELECT 12.485 - 12.48 as width
)
SELECT COUNT(*) as total_points FROM points, box_width WHERE box_width.width < 0.01;"

# VERSION 7: Full query with conditional logic (medium zoom)
run_query "7b" "Full query - Medium zoom (box 0.02 degrees) - 50 clusters" \
"WITH municipality_info AS (
    SELECT c.id as municipality_id, p.region_id, p.id as province_id, c.geometry as municipality_geom
    FROM public.municipalities c
    INNER JOIN public.provinces p ON c.province_id = p.id
    WHERE c.name = 'Roma'
    LIMIT 1
),
box_envelope AS (
    SELECT ST_MakeEnvelope(12.48, 41.88, 12.50, 41.90, 4326) as box_geom
),
points AS (
    SELECT av.id, av.geometry, av.asset_type, av.species
    FROM cadastre.green_assets av
    CROSS JOIN municipality_info c
    CROSS JOIN box_envelope b
    WHERE av.geometry_type = 'P'
      AND av.region_id = c.region_id
      AND av.province_id = c.province_id
      AND av.municipality_id = c.municipality_id
      AND ST_Intersects(av.geometry, b.box_geom)
      AND ST_Within(av.geometry, c.municipality_geom)
),
box_width AS (
    SELECT 12.50 - 12.48 as width
)
SELECT 
    COUNT(DISTINCT cluster_id) as num_clusters,
    SUM(num_points) as total_points
FROM (
    SELECT 
        ST_ClusterKMeans(geometry, 50) OVER() as cluster_id,
        COUNT(*) OVER() as num_points
    FROM points, box_width
    WHERE box_width.width >= 0.01
    LIMIT 1
) clustered;"

# VERSION 7: Full query with conditional logic (low zoom)
run_query "7c" "Full query - Low zoom (box 0.2 degrees) - 20 clusters" \
"WITH municipality_info AS (
    SELECT c.id as municipality_id, p.region_id, p.id as province_id, c.geometry as municipality_geom
    FROM public.municipalities c
    INNER JOIN public.provinces p ON c.province_id = p.id
    WHERE c.name = 'Roma'
    LIMIT 1
),
box_envelope AS (
    SELECT ST_MakeEnvelope(12.4, 41.8, 12.6, 42.0, 4326) as box_geom
),
points AS (
    SELECT av.id, av.geometry, av.asset_type, av.species
    FROM cadastre.green_assets av
    CROSS JOIN municipality_info c
    CROSS JOIN box_envelope b
    WHERE av.geometry_type = 'P'
      AND av.region_id = c.region_id
      AND av.province_id = c.province_id
      AND av.municipality_id = c.municipality_id
      AND ST_Intersects(av.geometry, b.box_geom)
      AND ST_Within(av.geometry, c.municipality_geom)
),
box_width AS (
    SELECT 12.6 - 12.4 as width
)
SELECT 
    COUNT(DISTINCT cluster_id) as num_clusters,
    COUNT(*) as total_points
FROM (
    SELECT 
        ST_ClusterKMeans(geometry, 20) OVER() as cluster_id
    FROM points, box_width
    WHERE box_width.width > 0.1
) clustered;"

echo "=============================================================================="
echo "BENCHMARK COMPLETED"
echo "=============================================================================="
