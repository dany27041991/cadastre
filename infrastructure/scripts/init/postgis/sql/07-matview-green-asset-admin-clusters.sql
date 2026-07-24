-- Materialized view: pre-aggregated green asset clusters per administrative level.
-- Levels: region > province > municipality > sub_municipal (circoscrizione/quartiere).
-- Serves national/regional/provincial/municipal map views in O(#admin units)
-- instead of scanning asset rows: with billions of assets a live grid aggregation
-- on a nationwide bbox is unbounded, while this view has at most a few thousand
-- rows (20 regions + 107 provinces + ~7900 municipalities + sub-areas).
--
-- Refresh after bulk asset loads:
--   REFRESH MATERIALIZED VIEW CONCURRENTLY cadastre.green_asset_admin_clusters;

CREATE MATERIALIZED VIEW IF NOT EXISTS cadastre.green_asset_admin_clusters AS
WITH centroids AS (
    SELECT
        region_id,
        province_id,
        municipality_id,
        id,
        ST_Centroid(geometry) AS c,
        geometry
    FROM cadastre.green_assets
    WHERE geometry IS NOT NULL
)
SELECT 'region'::text AS level,
       region_id,
       NULL::integer AS province_id,
       NULL::integer AS municipality_id,
       NULL::integer AS sub_municipal_area_id,
       count(*) AS asset_count,
       min(id) AS sample_id,
       ST_SetSRID(ST_MakePoint(avg(ST_X(c)), avg(ST_Y(c))), 4326) AS centroid,
       ST_Extent(geometry)::geometry AS extent
FROM centroids
GROUP BY region_id
UNION ALL
SELECT 'province', region_id, province_id, NULL, NULL,
       count(*), min(id),
       ST_SetSRID(ST_MakePoint(avg(ST_X(c)), avg(ST_Y(c))), 4326),
       ST_Extent(geometry)::geometry
FROM centroids
GROUP BY region_id, province_id
UNION ALL
SELECT 'municipality', region_id, province_id, municipality_id, NULL,
       count(*), min(id),
       ST_SetSRID(ST_MakePoint(avg(ST_X(c)), avg(ST_Y(c))), 4326),
       ST_Extent(geometry)::geometry
FROM centroids
GROUP BY region_id, province_id, municipality_id
UNION ALL
-- Sub-municipal level: spatial join on centroid containment. Assets outside any
-- sub-area are not represented here; the API falls back to grid clustering when
-- a municipality has no sub-area rows.
SELECT 'sub_municipal', ce.region_id, ce.province_id, ce.municipality_id, sma.id,
       count(*), min(ce.id),
       ST_SetSRID(ST_MakePoint(avg(ST_X(ce.c)), avg(ST_Y(ce.c))), 4326),
       ST_Extent(ce.geometry)::geometry
FROM centroids ce
JOIN public.sub_municipal_area sma
  ON sma.municipality_id = ce.municipality_id
 AND sma.geometry IS NOT NULL
 AND ST_Contains(sma.geometry, ce.c)
GROUP BY ce.region_id, ce.province_id, ce.municipality_id, sma.id;

-- Unique index required for REFRESH CONCURRENTLY.
CREATE UNIQUE INDEX IF NOT EXISTS idx_gaac_unique
    ON cadastre.green_asset_admin_clusters
       (level, region_id, COALESCE(province_id, -1), COALESCE(municipality_id, -1), COALESCE(sub_municipal_area_id, -1));
CREATE INDEX IF NOT EXISTS idx_gaac_level_centroid
    ON cadastre.green_asset_admin_clusters USING GIST (centroid);
