-- =============================================================================
-- Tree Cadastre - Cadastre schema (ASSET_AREA, ASSET_GREEN + history)
-- =============================================================================
-- Aligned with docs/database/design/database-mapping-diagram.md (125-368).
-- Depends on 01-init-schema-public.sql (public.regions, provinces, municipalities,
-- sub_municipal_area, area_level, attribute_types). Indexes: 03-init-indexes-public.sql, 04-init-indexes-cadastre.sql.
-- Table names green_areas / green_assets kept for partition compatibility (06-create-partitions.sql).
-- =============================================================================

CREATE SCHEMA IF NOT EXISTS cadastre;

-- -----------------------------------------------------------------------------
-- ENUMs for ASSET_AREA (diagram 129-243)
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON t.typnamespace = n.oid WHERE n.nspname = 'cadastre' AND t.typname = 'intensity_of_fruition') THEN
    CREATE TYPE cadastre.intensity_of_fruition AS ENUM ('NONE', 'LOW', 'MEDIUM', 'HIGH');
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON t.typnamespace = n.oid WHERE n.nspname = 'cadastre' AND t.typname = 'perimeter_type') THEN
    CREATE TYPE cadastre.perimeter_type AS ENUM ('REAL', 'FICTITIOUS');
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON t.typnamespace = n.oid WHERE n.nspname = 'cadastre' AND t.typname = 'administrative_status') THEN
    CREATE TYPE cadastre.administrative_status AS ENUM (
      'IN_DESIGN', 'PLANNED', 'APPROVED', 'ACTIVE', 'DISMISSED', 'MERGED', 'RECLASSIFIED'
    );
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON t.typnamespace = n.oid WHERE n.nspname = 'cadastre' AND t.typname = 'operational_status') THEN
    CREATE TYPE cadastre.operational_status AS ENUM (
      'IN_MANAGEMENT', 'UNDER_MAINTENANCE', 'TEMPORARILY_CLOSED', 'EMERGENCY', 'NOT_ACCESSIBLE'
    );
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON t.typnamespace = n.oid WHERE n.nspname = 'cadastre' AND t.typname = 'survey_status') THEN
    CREATE TYPE cadastre.survey_status AS ENUM (
      'NOT_SURVEYED', 'SURVEY_PENDING', 'PARTIALLY_SURVEYED', 'SURVEYED', 'IMPORTED_DBT', 'TO_BE_VERIFIED'
    );
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- ENUMs for ASSET_GREEN (diagram 272-345) + legacy asset_type, geometry_type
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON t.typnamespace = n.oid WHERE n.nspname = 'cadastre' AND t.typname = 'asset_type') THEN
    CREATE TYPE cadastre.asset_type AS ENUM (
      'tree', 'row', 'lawn', 'park', 'urban_forest',
      'hedge', 'flower_bed', 'street_greenery', 'other'
    );
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON t.typnamespace = n.oid WHERE n.nspname = 'cadastre' AND t.typname = 'geometry_type') THEN
    CREATE TYPE cadastre.geometry_type AS ENUM ('P', 'L', 'S');  -- OBT: point, line, surface (attribute_types)
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON t.typnamespace = n.oid WHERE n.nspname = 'cadastre' AND t.typname = 'health_status') THEN
    CREATE TYPE cadastre.health_status AS ENUM ('UNKNOWN', 'HEALTHY', 'DEGRADED', 'DECLINING', 'SICK', 'DECEASED');
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON t.typnamespace = n.oid WHERE n.nspname = 'cadastre' AND t.typname = 'stability_status') THEN
    CREATE TYPE cadastre.stability_status AS ENUM ('STABLE', 'PARTIALLY_UNSTABLE', 'UNSTABLE', 'FALLEN');
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON t.typnamespace = n.oid WHERE n.nspname = 'cadastre' AND t.typname = 'structural_defect') THEN
    CREATE TYPE cadastre.structural_defect AS ENUM ('NONE', 'ROOT', 'TRUNK', 'BRANCH', 'MULTIPLE');
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON t.typnamespace = n.oid WHERE n.nspname = 'cadastre' AND t.typname = 'risk_level') THEN
    CREATE TYPE cadastre.risk_level AS ENUM ('NONE', 'LOW', 'MEDIUM', 'HIGH', 'EXTREME');
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON t.typnamespace = n.oid WHERE n.nspname = 'cadastre' AND t.typname = 'maintenance_priority') THEN
    CREATE TYPE cadastre.maintenance_priority AS ENUM ('NONE', 'LOW', 'MEDIUM', 'HIGH', 'URGENT');
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON t.typnamespace = n.oid WHERE n.nspname = 'cadastre' AND t.typname = 'intervention_type') THEN
    CREATE TYPE cadastre.intervention_type AS ENUM ('NONE', 'PRUNING', 'CONSOLIDATION', 'TREATMENT', 'REMOVAL', 'REPLACEMENT');
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON t.typnamespace = n.oid WHERE n.nspname = 'cadastre' AND t.typname = 'growth_stage') THEN
    CREATE TYPE cadastre.growth_stage AS ENUM ('YOUNG', 'SEMI_MATURE', 'MATURE', 'OVERMATURE', 'DEAD');
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON t.typnamespace = n.oid WHERE n.nspname = 'cadastre' AND t.typname = 'origin') THEN
    CREATE TYPE cadastre.origin AS ENUM ('NATIVE', 'EXOTIC', 'INVASIVE', 'CULTIVAR');
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON t.typnamespace = n.oid WHERE n.nspname = 'cadastre' AND t.typname = 'protection_status') THEN
    CREATE TYPE cadastre.protection_status AS ENUM ('NONE', 'PROTECTED', 'MONUMENTAL', 'HISTORICAL');
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON t.typnamespace = n.oid WHERE n.nspname = 'cadastre' AND t.typname = 'asset_status') THEN
    CREATE TYPE cadastre.asset_status AS ENUM ('PLANNED', 'INSTALLED', 'ACTIVE', 'TEMPORARILY_OUT_OF_SERVICE', 'REMOVED');
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON t.typnamespace = n.oid WHERE n.nspname = 'cadastre' AND t.typname = 'monitoring_required') THEN
    CREATE TYPE cadastre.monitoring_required AS ENUM ('NONE', 'PERIODIC', 'URGENT');
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON t.typnamespace = n.oid WHERE n.nspname = 'cadastre' AND t.typname = 'priority_level_evaluation') THEN
    CREATE TYPE cadastre.priority_level_evaluation AS ENUM ('NONE', 'LOW', 'MEDIUM', 'HIGH');
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- ASSET_AREA (diagram 129-243) – implemented as green_areas for partition compatibility
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cadastre.green_areas (
  id BIGSERIAL,
  region_id INTEGER NOT NULL,
  province_id INTEGER NOT NULL,
  municipality_id INTEGER NOT NULL,
  sub_municipal_area_id INTEGER REFERENCES public.sub_municipal_area(id),
  level_id BIGINT REFERENCES public.area_level(level_id),
  parent_id BIGINT,
  name VARCHAR(255) NOT NULL,
  attribute_type_id BIGINT REFERENCES public.attribute_types(id),
  zril_identifier VARCHAR(80),
  susceptibility_classification_area_id BIGINT,
  intensity_of_fruition cadastre.intensity_of_fruition,
  geometry_type cadastre.geometry_type,
  geometry GEOMETRY(Geometry, 4326),
  perimeter_type cadastre.perimeter_type,
  administrative_status cadastre.administrative_status,
  operational_status cadastre.operational_status,
  survey_status cadastre.survey_status,
  valid_from TIMESTAMPTZ,
  valid_to TIMESTAMPTZ,
  start_date_of_management TIMESTAMPTZ,
  end_date_of_management TIMESTAMPTZ,
  last_update_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  last_modified_by VARCHAR(80),
  attributes JSONB DEFAULT '{}',
  media JSONB DEFAULT '[]',
  note TEXT,
  level INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (id, region_id, province_id)
) PARTITION BY LIST (region_id);

CREATE TABLE IF NOT EXISTS cadastre.green_areas_default
  PARTITION OF cadastre.green_areas DEFAULT;

-- -----------------------------------------------------------------------------
-- ASSET_AREA_HISTORY (diagram 246-266) – partitioned like green_areas (region_id → province_id)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cadastre.asset_area_history (
  history_id BIGSERIAL,
  asset_area_id BIGINT NOT NULL,
  region_id INTEGER NOT NULL,
  province_id INTEGER NOT NULL,
  municipality_id INTEGER NOT NULL,
  sub_municipal_area_id INTEGER,
  snapshot JSONB NOT NULL,
  PRIMARY KEY (history_id, region_id, province_id)
) PARTITION BY LIST (region_id);

CREATE TABLE IF NOT EXISTS cadastre.asset_area_history_default
  PARTITION OF cadastre.asset_area_history DEFAULT;

-- -----------------------------------------------------------------------------
-- ASSET_GREEN (diagram 272-345) – implemented as green_assets for partition compatibility
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cadastre.green_assets (
  id BIGSERIAL,
  green_area_id BIGINT,
  region_id INTEGER NOT NULL,
  province_id INTEGER NOT NULL,
  municipality_id INTEGER NOT NULL,
  sub_municipal_area_id INTEGER REFERENCES public.sub_municipal_area(id),
  attribute_type_id BIGINT REFERENCES public.attribute_types(id),
  asset_type cadastre.asset_type NOT NULL DEFAULT 'other',
  geometry_type cadastre.geometry_type NOT NULL,
  geometry GEOMETRY(Geometry, 4326) NOT NULL,
  family VARCHAR(80),
  genus VARCHAR(50),
  species VARCHAR(50),
  variety VARCHAR(50),
  attributes JSONB DEFAULT '{}',
  start_date_of_management TIMESTAMPTZ,
  end_date_of_management TIMESTAMPTZ,
  planting_date TIMESTAMPTZ,
  last_update_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  health_status cadastre.health_status,
  stability_status cadastre.stability_status,
  structural_defect cadastre.structural_defect,
  risk_level cadastre.risk_level,
  maintenance_priority cadastre.maintenance_priority,
  intervention_type cadastre.intervention_type,
  growth_stage cadastre.growth_stage,
  origin cadastre.origin,
  protection_status cadastre.protection_status,
  asset_status cadastre.asset_status,
  monitoring_required cadastre.monitoring_required,
  next_inspection_date TIMESTAMPTZ,
  managing_entity VARCHAR(120),
  last_modified_by VARCHAR(80),
  survey_date TIMESTAMPTZ,
  survey_method VARCHAR(120),
  priority_level_evaluation cadastre.priority_level_evaluation,
  media JSONB DEFAULT '[]',
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (id, region_id, province_id)
) PARTITION BY LIST (region_id);

CREATE TABLE IF NOT EXISTS cadastre.green_assets_default
  PARTITION OF cadastre.green_assets DEFAULT;

-- -----------------------------------------------------------------------------
-- ASSET_GREEN_HISTORY (diagram 348-368) – partitioned like green_assets (region_id → province_id)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cadastre.asset_green_history (
  history_id BIGSERIAL,
  asset_green_id BIGINT NOT NULL,
  region_id INTEGER NOT NULL,
  province_id INTEGER NOT NULL,
  municipality_id INTEGER NOT NULL,
  sub_municipal_area_id INTEGER,
  snapshot JSONB NOT NULL,
  PRIMARY KEY (history_id, region_id, province_id)
) PARTITION BY LIST (region_id);

CREATE TABLE IF NOT EXISTS cadastre.asset_green_history_default
  PARTITION OF cadastre.asset_green_history DEFAULT;

-- -----------------------------------------------------------------------------
-- Grants and comments
-- -----------------------------------------------------------------------------
GRANT ALL ON ALL TABLES IN SCHEMA public TO cadastre;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO cadastre;
GRANT USAGE ON SCHEMA cadastre TO cadastre;
GRANT ALL ON ALL TABLES IN SCHEMA cadastre TO cadastre;
GRANT ALL ON ALL SEQUENCES IN SCHEMA cadastre TO cadastre;
ALTER DEFAULT PRIVILEGES IN SCHEMA cadastre GRANT ALL ON TABLES TO cadastre;

COMMENT ON TABLE cadastre.green_areas IS 'ASSET_AREA: green areas / hierarchical areas. Partitioned by region_id.';
COMMENT ON COLUMN cadastre.green_areas.name IS 'area_name: human-readable name (e.g. Parco Sempione)';
COMMENT ON COLUMN cadastre.green_areas.parent_id IS 'parent_area_id: self-reference for containment hierarchy';
COMMENT ON COLUMN cadastre.green_areas.level_id IS 'Reference to AREA_LEVEL.level_id (semantic hierarchy)';
COMMENT ON COLUMN cadastre.green_areas.attribute_type_id IS 'Reference to ATTRIBUTE_TYPES.id (DBT classification: geom_type + primary + secondary + attribute).';
COMMENT ON TABLE cadastre.asset_area_history IS 'Temporal snapshots of ASSET_AREA (diagram 246-266).';
COMMENT ON TABLE cadastre.green_assets IS 'ASSET_GREEN: green assets (trees, etc.). Partitioned by region_id.';
COMMENT ON COLUMN cadastre.green_assets.green_area_id IS 'area_id in diagram: reference to ASSET_AREA.id (green_areas.id).';
COMMENT ON COLUMN cadastre.green_assets.attribute_type_id IS 'Reference to ATTRIBUTE_TYPES.id (DBT classification).';
COMMENT ON TABLE cadastre.asset_green_history IS 'Temporal snapshots of ASSET_GREEN (diagram 348-368).';
