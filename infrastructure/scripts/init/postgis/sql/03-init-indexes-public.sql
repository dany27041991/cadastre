-- =============================================================================
-- Tree Cadastre - Indexes for public schema
-- =============================================================================
-- Run after 01-init-schema-public.sql.
-- Aligned with docs/database/design/database-mapping-diagram.md.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- REGIONS
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_regions_geom ON public.regions USING GIST(geometry);

-- -----------------------------------------------------------------------------
-- PROVINCES
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_provinces_region ON public.provinces(region_id);
CREATE INDEX IF NOT EXISTS idx_provinces_geom ON public.provinces USING GIST(geometry);

-- -----------------------------------------------------------------------------
-- MUNICIPALITIES
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_municipalities_istat ON public.municipalities(istat_code);
CREATE INDEX IF NOT EXISTS idx_municipalities_province ON public.municipalities(province_id);
CREATE INDEX IF NOT EXISTS idx_municipalities_geom ON public.municipalities USING GIST(geometry);

-- -----------------------------------------------------------------------------
-- SUB_MUNICIPAL_AREA
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_sub_municipal_area_municipality ON public.sub_municipal_area(municipality_id);
CREATE INDEX IF NOT EXISTS idx_sub_municipal_area_parent ON public.sub_municipal_area(parent_id);
CREATE INDEX IF NOT EXISTS idx_sub_municipal_area_level ON public.sub_municipal_area(level);
CREATE INDEX IF NOT EXISTS idx_sub_municipal_area_geom ON public.sub_municipal_area USING GIST(geometry);
CREATE INDEX IF NOT EXISTS idx_sub_municipal_area_municipality_level ON public.sub_municipal_area(municipality_id, level);

-- -----------------------------------------------------------------------------
-- CENSUS_SECTION
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_census_section_municipality ON public.census_section(municipality_id);
CREATE INDEX IF NOT EXISTS idx_census_section_municipality_code ON public.census_section(municipality_id, code);
CREATE INDEX IF NOT EXISTS idx_census_section_layer_type ON public.census_section(layer_type);
CREATE INDEX IF NOT EXISTS idx_census_section_geom ON public.census_section USING GIST(geometry);

-- -----------------------------------------------------------------------------
-- AREA_LEVEL, DBT CATALOG, TRANSLATIONS
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_area_level_hierarchy_order ON public.area_level(hierarchy_order);
CREATE INDEX IF NOT EXISTS idx_area_level_description_code ON public.area_level(description_code);
CREATE INDEX IF NOT EXISTS idx_primary_types_description_code ON public.primary_types(description_code);
CREATE INDEX IF NOT EXISTS idx_secondary_types_primary_type ON public.secondary_types(primary_type_id);
CREATE INDEX IF NOT EXISTS idx_secondary_types_description_code ON public.secondary_types(description_code);
CREATE INDEX IF NOT EXISTS idx_attribute_types_secondary_type ON public.attribute_types(secondary_type_id);
CREATE INDEX IF NOT EXISTS idx_attribute_types_geom_type ON public.attribute_types(geom_type);
CREATE INDEX IF NOT EXISTS idx_attribute_types_description_code ON public.attribute_types(description_code);
CREATE INDEX IF NOT EXISTS idx_translations_entity ON public.translations(entity_type, entity_name, key);
CREATE INDEX IF NOT EXISTS idx_translations_entity_lang ON public.translations(entity_type, entity_name, lang);
CREATE INDEX IF NOT EXISTS idx_translations_lang ON public.translations(lang);
