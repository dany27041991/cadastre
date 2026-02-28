-- =============================================================================
-- Tree Cadastre - Public schema (territorial hierarchy)
-- =============================================================================
-- Aligned with docs/database/design/database-mapping-diagram.md.
-- Populated from infrastructure/data GeoJSON (load_geojson.py).
-- Run first; cadastre schema (02-init-schema-cadastre.sql) depends on this.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS postgis;

-- -----------------------------------------------------------------------------
-- Territorial reference tables (public schema)
-- Hierarchy: Region -> Province -> Municipality -> Sub-municipal area (1/2/3) and Census section
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.regions (
  id SERIAL PRIMARY KEY,
  code VARCHAR(10) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  geometry GEOMETRY(MultiPolygon, 4326)
);

CREATE TABLE IF NOT EXISTS public.provinces (
  id SERIAL PRIMARY KEY,
  code VARCHAR(3) NOT NULL,
  name VARCHAR(100) NOT NULL,
  vehicle_registration_code VARCHAR(2),
  region_id INTEGER NOT NULL REFERENCES public.regions(id),
  geometry GEOMETRY(MultiPolygon, 4326),
  UNIQUE (code, region_id)
);

CREATE TABLE IF NOT EXISTS public.municipalities (
  id SERIAL PRIMARY KEY,
  istat_code VARCHAR(6) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  province_id INTEGER NOT NULL REFERENCES public.provinces(id),
  is_provincial_capital BOOLEAN DEFAULT FALSE,
  geometry GEOMETRY(MultiPolygon, 4326)
);

-- Sub-municipal areas (ISTAT ASC: Circoscrizione, Quartiere, Zona Statistica, Zona Urbanistica)
-- Source: area_submunicipal_lv1/2/3.geojson. parent_id NULL for level 1.
CREATE TABLE IF NOT EXISTS public.sub_municipal_area (
  id SERIAL PRIMARY KEY,
  municipality_id INTEGER NOT NULL REFERENCES public.municipalities(id),
  parent_id INTEGER REFERENCES public.sub_municipal_area(id),
  level SMALLINT NOT NULL,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  area_type VARCHAR(100),
  geometry GEOMETRY(MultiPolygon, 4326),
  UNIQUE (municipality_id, level, code)
);

-- Census sections and localities (sezioni di censimento, località)
-- Source: sections.geojson. layer_type: census_section | locality (source uses 'sezione' | 'località').
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON t.typnamespace = n.oid WHERE n.nspname = 'public' AND t.typname = 'census_layer_type') THEN
    CREATE TYPE public.census_layer_type AS ENUM ('census_section', 'locality');
  END IF;
END
$$;

-- Uniqueness (no duplicates): enforced by unique index idx_census_section_upsert in 03-init-indexes-public.sql.
CREATE TABLE IF NOT EXISTS public.census_section (
  id SERIAL PRIMARY KEY,
  municipality_id INTEGER NOT NULL REFERENCES public.municipalities(id),
  code VARCHAR(50),
  name VARCHAR(255) NOT NULL,
  layer_type public.census_layer_type NOT NULL,
  geometry GEOMETRY(Geometry, 4326)
);

-- -----------------------------------------------------------------------------
-- AREA_LEVEL (diagram 51-65): abstract hierarchical level of the green asset system
-- Localized descriptions: description_code → TRANSLATIONS (entity_name='AREA_LEVEL', key=description_code).
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.area_level (
  level_id BIGINT PRIMARY KEY,
  level_name VARCHAR(100) NOT NULL,
  hierarchy_order INTEGER NOT NULL,
  description_code VARCHAR(100)
);

-- -----------------------------------------------------------------------------
-- DBT OBJECT CATALOG (diagram: primary_types, secondary_types, attribute_types; no object_codes)
-- Full code = geom_type + tp_code + ts_code + attribute_types.ts_code (7 chars).
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON t.typnamespace = n.oid WHERE n.nspname = 'public' AND t.typname = 'geom_type') THEN
    CREATE TYPE public.geom_type AS ENUM ('P', 'L', 'S');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS public.primary_types (
  id BIGINT PRIMARY KEY,
  tp_code CHAR(1) NOT NULL,
  description_code VARCHAR(100)
);

CREATE TABLE IF NOT EXISTS public.secondary_types (
  id BIGINT PRIMARY KEY,
  ts_code CHAR(2) NOT NULL,
  primary_type_id BIGINT NOT NULL REFERENCES public.primary_types(id),
  description_code VARCHAR(100)
);

CREATE TABLE IF NOT EXISTS public.attribute_types (
  id BIGINT PRIMARY KEY,
  ts_code CHAR(3) NOT NULL,
  secondary_type_id BIGINT NOT NULL REFERENCES public.secondary_types(id),
  geom_type public.geom_type NOT NULL,
  description_code VARCHAR(100),
  UNIQUE (secondary_type_id, ts_code, geom_type)
);

-- -----------------------------------------------------------------------------
-- TRANSLATIONS (diagram): localized text for tables and enums
-- column_name: for TABLE, name of the column/slot being translated; NULL for single-slot or ENUM
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.translations (
  id BIGSERIAL PRIMARY KEY,
  entity_type VARCHAR(50) NOT NULL,
  entity_name VARCHAR(100) NOT NULL,
  key VARCHAR(255) NOT NULL,
  column_name VARCHAR(100),
  lang CHAR(2) NOT NULL,
  translation TEXT,
  UNIQUE (entity_type, entity_name, key, lang, column_name)
);
