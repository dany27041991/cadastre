-- =============================================================================
-- Tree Cadastre - Hierarchical partitions: region → province (after GeoJSON load)
-- =============================================================================
-- Runs after public.regions and public.provinces are populated (load_geojson.py).
-- Creates for each table: <table>_<region> (PARTITION BY province_id) → <table>_<region>_<province>.
-- Tables: green_assets, green_areas, asset_area_history, asset_green_history. Idempotent.
-- =============================================================================

DO $$
DECLARE
  rec_region RECORD;
  rec_province RECORD;
  p_av_region TEXT;
  p_ar_region TEXT;
  p_ah_region TEXT;
  p_gh_region TEXT;
  p_av_leaf TEXT;
  p_ar_leaf TEXT;
  p_ah_leaf TEXT;
  p_gh_leaf TEXT;
  n_av INT := 0;
  n_ar INT := 0;
  n_ah INT := 0;
  n_gh INT := 0;
BEGIN
  FOR rec_region IN SELECT id FROM public.regions ORDER BY id
  LOOP
    p_av_region := 'cadastre.green_assets_' || rec_region.id;
    p_ar_region := 'cadastre.green_areas_' || rec_region.id;
    p_ah_region := 'cadastre.asset_area_history_' || rec_region.id;
    p_gh_region := 'cadastre.asset_green_history_' || rec_region.id;

    -- Level 1: region partition (partitioned by province_id)
    EXECUTE format(
      'CREATE TABLE IF NOT EXISTS %s PARTITION OF cadastre.green_assets FOR VALUES IN (%s) PARTITION BY LIST (province_id)',
      p_av_region, rec_region.id
    );
    EXECUTE format(
      'CREATE TABLE IF NOT EXISTS %s PARTITION OF cadastre.green_areas FOR VALUES IN (%s) PARTITION BY LIST (province_id)',
      p_ar_region, rec_region.id
    );
    EXECUTE format(
      'CREATE TABLE IF NOT EXISTS %s PARTITION OF cadastre.asset_area_history FOR VALUES IN (%s) PARTITION BY LIST (province_id)',
      p_ah_region, rec_region.id
    );
    EXECUTE format(
      'CREATE TABLE IF NOT EXISTS %s PARTITION OF cadastre.asset_green_history FOR VALUES IN (%s) PARTITION BY LIST (province_id)',
      p_gh_region, rec_region.id
    );

    -- Level 2: province partitions (leaf) + indexes
    FOR rec_province IN SELECT id FROM public.provinces WHERE region_id = rec_region.id ORDER BY id
    LOOP
      p_av_leaf := p_av_region || '_' || rec_province.id;
      p_ar_leaf := p_ar_region || '_' || rec_province.id;
      p_ah_leaf := p_ah_region || '_' || rec_province.id;
      p_gh_leaf := p_gh_region || '_' || rec_province.id;

      -- green_assets leaves
      EXECUTE format(
        'CREATE TABLE IF NOT EXISTS %s PARTITION OF %s FOR VALUES IN (%s)',
        p_av_leaf, p_av_region, rec_province.id
      );
      EXECUTE format('CREATE INDEX IF NOT EXISTS idx_ga_%s_%s_geom ON %s USING GIST(geometry)', rec_region.id, rec_province.id, p_av_leaf);
      EXECUTE format('CREATE INDEX IF NOT EXISTS idx_ga_%s_%s_asset_type ON %s(asset_type)', rec_region.id, rec_province.id, p_av_leaf);
      EXECUTE format('CREATE INDEX IF NOT EXISTS idx_ga_%s_%s_point_munic ON %s(geometry_type, region_id, municipality_id) WHERE geometry_type = ''point''', rec_region.id, rec_province.id, p_av_leaf);
      EXECUTE format('CREATE INDEX IF NOT EXISTS idx_ga_%s_%s_point_prov ON %s(geometry_type, region_id, province_id) WHERE geometry_type = ''point''', rec_region.id, rec_province.id, p_av_leaf);
      EXECUTE format('CREATE INDEX IF NOT EXISTS idx_ga_%s_%s_point_sub ON %s(geometry_type, region_id, municipality_id, sub_municipal_area_id) WHERE geometry_type = ''point'' AND sub_municipal_area_id IS NOT NULL', rec_region.id, rec_province.id, p_av_leaf);
      n_av := n_av + 1;

      -- green_areas leaves
      EXECUTE format(
        'CREATE TABLE IF NOT EXISTS %s PARTITION OF %s FOR VALUES IN (%s)',
        p_ar_leaf, p_ar_region, rec_province.id
      );
      EXECUTE format('CREATE INDEX IF NOT EXISTS idx_ar_%s_%s_geom ON %s USING GIST(geometry)', rec_region.id, rec_province.id, p_ar_leaf);
      n_ar := n_ar + 1;

      -- asset_area_history leaves
      EXECUTE format(
        'CREATE TABLE IF NOT EXISTS %s PARTITION OF %s FOR VALUES IN (%s)',
        p_ah_leaf, p_ah_region, rec_province.id
      );
      EXECUTE format('CREATE INDEX IF NOT EXISTS idx_ah_%s_%s_asset_area_id ON %s(asset_area_id)', rec_region.id, rec_province.id, p_ah_leaf);
      n_ah := n_ah + 1;

      -- asset_green_history leaves
      EXECUTE format(
        'CREATE TABLE IF NOT EXISTS %s PARTITION OF %s FOR VALUES IN (%s)',
        p_gh_leaf, p_gh_region, rec_province.id
      );
      EXECUTE format('CREATE INDEX IF NOT EXISTS idx_gh_%s_%s_asset_green_id ON %s(asset_green_id)', rec_region.id, rec_province.id, p_gh_leaf);
      n_gh := n_gh + 1;
    END LOOP;
  END LOOP;

  RAISE NOTICE 'Hierarchical partitions created: green_assets % leaves, green_areas % leaves, asset_area_history % leaves, asset_green_history % leaves', n_av, n_ar, n_ah, n_gh;
END
$$;
