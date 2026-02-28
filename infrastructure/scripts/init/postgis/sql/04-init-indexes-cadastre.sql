-- =============================================================================
-- Tree Cadastre - Indexes for cadastre schema
-- =============================================================================
-- Run after 02-init-schema-cadastre.sql and 03-init-indexes-public.sql.
-- Partitioned tables: indexes on parent propagate to existing partitions (DEFAULT).
-- Region/province leaf partitions get indexes from 06-create-partitions.sql.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- GREEN_AREAS (partitioned by region_id) – index coverage per column
-- -----------------------------------------------------------------------------
-- id, region_id, province_id: PK + partition key → idx_*_region_id, *_province_id, *_active
CREATE INDEX IF NOT EXISTS idx_green_areas_region_id ON cadastre.green_areas(region_id);
CREATE INDEX IF NOT EXISTS idx_green_areas_province_id ON cadastre.green_areas(province_id);
CREATE INDEX IF NOT EXISTS idx_green_areas_province_level ON cadastre.green_areas(province_id, level);
CREATE INDEX IF NOT EXISTS idx_green_areas_municipality_id ON cadastre.green_areas(municipality_id);
CREATE INDEX IF NOT EXISTS idx_green_areas_municipality_level ON cadastre.green_areas(municipality_id, level);
CREATE INDEX IF NOT EXISTS idx_green_areas_sub_municipal_area_id ON cadastre.green_areas(sub_municipal_area_id);
CREATE INDEX IF NOT EXISTS idx_green_areas_level_id ON cadastre.green_areas(level_id) WHERE level_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_green_areas_parent ON cadastre.green_areas(parent_id);
-- name: no index (display / LIKE)
-- attribute_type_id: FK lookup (DBT catalog)
CREATE INDEX IF NOT EXISTS idx_green_areas_attribute_type_id ON cadastre.green_areas(attribute_type_id) WHERE attribute_type_id IS NOT NULL;
-- zril_identifier, susceptibility_*, intensity_of_fruition, geometry_type, perimeter_type: no index (rare filters)
-- administrative_status: filter active/approved areas
CREATE INDEX IF NOT EXISTS idx_green_areas_administrative_status ON cadastre.green_areas(administrative_status) WHERE administrative_status IS NOT NULL;
-- operational_status, survey_status: no index unless needed
-- valid_from / valid_to: temporal range (optional GIST or B-tree for “valid at date”)
-- geometry: spatial
CREATE INDEX IF NOT EXISTS idx_green_areas_geom ON cadastre.green_areas USING GIST(geometry);
CREATE INDEX IF NOT EXISTS idx_green_areas_level ON cadastre.green_areas(level);
CREATE INDEX IF NOT EXISTS idx_green_areas_region_level ON cadastre.green_areas(region_id, level);
-- deleted_at: partial “active” index
CREATE INDEX IF NOT EXISTS idx_green_areas_active ON cadastre.green_areas(region_id, province_id) WHERE deleted_at IS NULL;
-- attributes, media, note, last_modified_by, created_at, updated_at: no index

-- -----------------------------------------------------------------------------
-- ASSET_AREA_HISTORY (partitioned by region_id) – index coverage per column
-- -----------------------------------------------------------------------------
-- history_id, region_id, province_id: PK + partition key
CREATE INDEX IF NOT EXISTS idx_asset_area_history_asset_area_id ON cadastre.asset_area_history(asset_area_id);
CREATE INDEX IF NOT EXISTS idx_asset_area_history_region_id ON cadastre.asset_area_history(region_id);
CREATE INDEX IF NOT EXISTS idx_asset_area_history_province_id ON cadastre.asset_area_history(province_id);
CREATE INDEX IF NOT EXISTS idx_asset_area_history_municipality_id ON cadastre.asset_area_history(municipality_id);
CREATE INDEX IF NOT EXISTS idx_asset_area_history_sub_municipal_area_id ON cadastre.asset_area_history(sub_municipal_area_id) WHERE sub_municipal_area_id IS NOT NULL;
-- snapshot: JSONB (GIN only if querying inside JSON)

-- -----------------------------------------------------------------------------
-- GREEN_ASSETS (partitioned by region_id) – index coverage per column
-- -----------------------------------------------------------------------------
-- id, region_id, province_id: PK + partition key
CREATE INDEX IF NOT EXISTS idx_green_assets_region_id ON cadastre.green_assets(region_id);
CREATE INDEX IF NOT EXISTS idx_green_assets_province_id ON cadastre.green_assets(province_id);
CREATE INDEX IF NOT EXISTS idx_green_assets_municipality_id ON cadastre.green_assets(municipality_id);
CREATE INDEX IF NOT EXISTS idx_green_assets_sub_municipal_area_id ON cadastre.green_assets(sub_municipal_area_id);
CREATE INDEX IF NOT EXISTS idx_green_assets_green_area_id ON cadastre.green_assets(green_area_id);
CREATE INDEX IF NOT EXISTS idx_green_assets_attribute_type_id ON cadastre.green_assets(attribute_type_id) WHERE attribute_type_id IS NOT NULL;
-- asset_type, geometry_type: filters and composites (P/L/S per OBT; point = P in partial indexes below)
CREATE INDEX IF NOT EXISTS idx_green_assets_asset_type ON cadastre.green_assets(asset_type);
CREATE INDEX IF NOT EXISTS idx_green_assets_geometry_type ON cadastre.green_assets(geometry_type);
CREATE INDEX IF NOT EXISTS idx_green_assets_asset_type_province ON cadastre.green_assets(asset_type, province_id);
-- geometry: spatial
CREATE INDEX IF NOT EXISTS idx_green_assets_geom ON cadastre.green_assets USING GIST(geometry);
-- family, genus, variety: no index (display / search)
-- species: filter by species
CREATE INDEX IF NOT EXISTS idx_green_assets_species ON cadastre.green_assets(species)
  WHERE species IS NOT NULL AND species != '';
-- attributes: JSONB (GIN only if querying inside JSON)
-- start_date_of_management, end_date_of_management, planting_date, last_update_at: no index
-- deleted_at: partial “active” index
CREATE INDEX IF NOT EXISTS idx_green_assets_active ON cadastre.green_assets(region_id, province_id) WHERE deleted_at IS NULL;
-- health_status, stability_status, structural_defect, risk_level: filter by status/risk
CREATE INDEX IF NOT EXISTS idx_green_assets_health_status ON cadastre.green_assets(health_status) WHERE health_status IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_green_assets_risk_level ON cadastre.green_assets(risk_level) WHERE risk_level IS NOT NULL;
-- maintenance_priority, intervention_type, growth_stage, origin, protection_status: no index unless needed
-- asset_status: filter ACTIVE / REMOVED etc.
CREATE INDEX IF NOT EXISTS idx_green_assets_asset_status ON cadastre.green_assets(asset_status) WHERE asset_status IS NOT NULL;
-- monitoring_required, next_inspection_date, managing_entity, last_modified_by, survey_*, priority_level_evaluation: no index
-- media, note: no index
-- created_at: “recent” list
CREATE INDEX IF NOT EXISTS idx_green_assets_created_at ON cadastre.green_assets(created_at)
  WHERE created_at IS NOT NULL;
-- updated_at: no index

-- -----------------------------------------------------------------------------
-- ASSET_GREEN_HISTORY (partitioned by region_id) – index coverage per column
-- -----------------------------------------------------------------------------
-- history_id, region_id, province_id: PK + partition key
CREATE INDEX IF NOT EXISTS idx_asset_green_history_asset_green_id ON cadastre.asset_green_history(asset_green_id);
CREATE INDEX IF NOT EXISTS idx_asset_green_history_region_id ON cadastre.asset_green_history(region_id);
CREATE INDEX IF NOT EXISTS idx_asset_green_history_province_id ON cadastre.asset_green_history(province_id);
CREATE INDEX IF NOT EXISTS idx_asset_green_history_municipality_id ON cadastre.asset_green_history(municipality_id);
CREATE INDEX IF NOT EXISTS idx_asset_green_history_sub_municipal_area_id ON cadastre.asset_green_history(sub_municipal_area_id) WHERE sub_municipal_area_id IS NOT NULL;
-- snapshot: JSONB (GIN only if querying inside JSON)

-- -----------------------------------------------------------------------------
-- DEFAULT partitions - columns used in WHERE (GIST on both tables from parent indexes)
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_green_assets_default_region ON cadastre.green_assets_default(region_id);
CREATE INDEX IF NOT EXISTS idx_green_assets_default_municipality ON cadastre.green_assets_default(municipality_id);
CREATE INDEX IF NOT EXISTS idx_green_assets_default_asset_type ON cadastre.green_assets_default(asset_type);
CREATE INDEX IF NOT EXISTS idx_green_areas_default_region ON cadastre.green_areas_default(region_id);
CREATE INDEX IF NOT EXISTS idx_green_areas_default_municipality ON cadastre.green_areas_default(municipality_id);

-- -----------------------------------------------------------------------------
-- Partial composite indexes for territorial filters (query clustering optimization)
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_av_default_point_municipality_region
ON cadastre.green_assets_default(geometry_type, region_id, municipality_id)
WHERE geometry_type = 'P';

CREATE INDEX IF NOT EXISTS idx_av_default_point_province_region
ON cadastre.green_assets_default(geometry_type, region_id, province_id)
WHERE geometry_type = 'P';

CREATE INDEX IF NOT EXISTS idx_av_default_point_sub_municipal_municipality_region
ON cadastre.green_assets_default(geometry_type, region_id, municipality_id, sub_municipal_area_id)
WHERE geometry_type = 'P' AND sub_municipal_area_id IS NOT NULL;
