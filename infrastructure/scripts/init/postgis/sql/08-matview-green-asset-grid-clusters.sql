-- Materialized view: pre-aggregated green asset grid clusters per zoom level.
-- Covers the grid-cluster zoom band (13..18): below 13 the admin matview
-- (07-matview-green-asset-admin-clusters.sql) serves the response, above the
-- raw threshold individual assets are returned.
--
-- Grid math mirrors backend viewport_grid.py (grid_cell_size_m):
--   cell_m(z) = CLUSTER_DISTANCE_AT_16 (80px) * base_res * cos(lat_ref) / 2^z
-- with base_res = 156543.03392804097 (Web Mercator z0) and lat_ref = 41.9.
-- Keep in sync with viewport_grid.py constants.
--
-- Rows carry region/province/municipality so scoped requests filter directly;
-- cells crossing admin borders split into one row per admin unit and are
-- re-aggregated (SUM/weighted avg) at query time.
--
-- A live grid aggregation measured 200-414ms per request on dense bboxes at
-- zoom 17-18; this view makes it an index lookup.
--
-- Refresh after bulk asset loads:
--   REFRESH MATERIALIZED VIEW CONCURRENTLY cadastre.green_asset_grid_clusters;

CREATE MATERIALIZED VIEW IF NOT EXISTS cadastre.green_asset_grid_clusters AS
WITH params AS (
    SELECT z AS zoom_level,
           (80.0 * 156543.03392804097 * cos(radians(41.9)) / 2 ^ z) AS cell_m
    FROM generate_series(13, 18) AS z
),
centroids AS (
    SELECT region_id,
           province_id,
           municipality_id,
           id,
           ST_Transform(ST_Centroid(geometry), 3857) AS c3857,
           geometry
    FROM cadastre.green_assets
    WHERE geometry IS NOT NULL
)
SELECT p.zoom_level,
       floor(ST_X(c.c3857) / p.cell_m)::bigint AS cell_x,
       floor(ST_Y(c.c3857) / p.cell_m)::bigint AS cell_y,
       c.region_id,
       c.province_id,
       c.municipality_id,
       count(*) AS asset_count,
       min(c.id) AS sample_id,
       avg(ST_X(c.c3857)) AS merc_x,
       avg(ST_Y(c.c3857)) AS merc_y,
       ST_Extent(c.geometry)::geometry AS extent
FROM centroids c
CROSS JOIN params p
GROUP BY p.zoom_level, cell_x, cell_y, c.region_id, c.province_id, c.municipality_id;

-- Unique index required for REFRESH CONCURRENTLY.
CREATE UNIQUE INDEX IF NOT EXISTS idx_gagc_unique
    ON cadastre.green_asset_grid_clusters
       (zoom_level, cell_x, cell_y, region_id,
        COALESCE(province_id, -1), COALESCE(municipality_id, -1));
CREATE INDEX IF NOT EXISTS idx_gagc_extent
    ON cadastre.green_asset_grid_clusters USING GIST (extent);
CREATE INDEX IF NOT EXISTS idx_gagc_zoom_scope
    ON cadastre.green_asset_grid_clusters (zoom_level, region_id, province_id, municipality_id);
