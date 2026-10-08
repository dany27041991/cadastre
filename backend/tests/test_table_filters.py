"""Unit tests for lakehouse table_filters WHERE builders."""

from __future__ import annotations

from unittest.mock import MagicMock

from territory.assets.application.usecases.query.catalog_green_asset import (
    CatalogGreenAsset,
    LAST_ZOOM_RAW_HARD_CAP,
)
from territory.common.infrastructure.lakehouse.table_filters import (
    AREA_FILTER_KEYS,
    ASSET_FILTER_KEYS,
    area_filter_where,
    asset_filter_where,
    collect_filters,
)


def test_area_name_and_area_code_remap():
    clauses = area_filter_where({"name": "Parco", "area_code": "ZRIL-1"})
    assert any("name" in c and "ILIKE" in c and "Parco" in c for c in clauses)
    assert any("zril_identifier" in c and "ZRIL-1" in c for c in clauses)


def test_area_enum_exact_vs_ilike():
    exact = area_filter_where({"area_classification": "URBAN_PARKS"})
    assert exact == ["area_classification = 'URBAN_PARKS'"]
    fuzzy = area_filter_where({"area_classification": "park"})
    assert len(fuzzy) == 1 and "ILIKE" in fuzzy[0]


def test_area_surface_numeric():
    clauses = area_filter_where({"surface_area_m2": "12500"})
    assert len(clauses) == 1
    assert "TRY_CAST(surface_area_m2 AS DOUBLE)" in clauses[0]


def test_area_unknown_key_ignored():
    assert area_filter_where({"not_a_field": "x", "name": ""}) == []


def test_asset_plant_and_area_code_int():
    clauses = asset_filter_where({"plant_code": "42", "area_code": "10"})
    assert "id = 42" in clauses
    assert "green_area_id = 10" in clauses
    assert asset_filter_where({"plant_code": "abc"}) == ["1=0"]


def test_asset_lat_lon_and_species():
    clauses = asset_filter_where(
        {"latitude": "40.35", "longitude": "18.17", "species": "Quercus"}
    )
    assert any("lat" in c for c in clauses)
    assert any("lon" in c for c in clauses)
    assert any("species" in c and "Quercus" in c for c in clauses)


def test_asset_health_exact():
    assert asset_filter_where({"health_status": "HEALTHY"}) == [
        "health_status = 'HEALTHY'"
    ]


def test_asset_measures_and_growth():
    clauses = asset_filter_where(
        {
            "trunk_diameter_cm": "32",
            "growth_stage": "MATURE",
            "protection_status": "NONE",
            "species_code": "QUE",
        }
    )
    assert any("trunk_diameter_cm" in c for c in clauses)
    assert "growth_stage = 'MATURE'" in clauses
    assert "protection_status = 'NONE'" in clauses
    assert any("species_code" in c for c in clauses)


def test_sql_escape_quote():
    clauses = area_filter_where({"name": "O'Brien"})
    assert "O''Brien" in clauses[0]


def test_collect_filters_picks_product_keys_only():
    params = {
        "name": "  Parco  ",
        "bbox": "1,2,3,4",
        "clip_wkt": "POLYGON((0 0,1 0,1 1,0 1,0 0))",
        "species": "Quercus",
        "empty": "",
    }
    areas = collect_filters(params, AREA_FILTER_KEYS)
    assert areas == {"name": "Parco"}
    assets = collect_filters(params, ASSET_FILTER_KEYS)
    assert assets == {"species": "Quercus"}


def test_area_filter_where_appends_for_catalog_parent_path():
    """Catalog drill WHERE must compose with area_filter_where fragments."""
    clauses = area_filter_where({"name": "Garibaldi", "area_classification": "URBAN_PARKS"})
    assert len(clauses) == 2
    where = "parent_id = 1 AND region_id = 16 AND " + " AND ".join(clauses)
    assert "name" in where and "Garibaldi" in where
    assert "area_classification = 'URBAN_PARKS'" in where


def test_viewport_assets_with_filters_skips_gold_uses_raw():
    repo = MagicMock()
    repo.get_raw_in_bbox.return_value = {
        "type": "FeatureCollection",
        "features": [{"type": "Feature", "properties": {"id": 1}, "geometry": None}],
    }
    uc = CatalogGreenAsset(repo)
    bbox = (18.1, 40.3, 18.2, 40.4)
    out = uc.viewport_green_assets(
        bbox, 8.0, municipality_id=5998, filters={"species": "Quercus"}
    )
    repo.get_admin_clusters_in_bbox.assert_not_called()
    repo.get_grid_clusters_from_gold.assert_not_called()
    repo.get_raw_in_bbox.assert_called_once_with(
        bbox,
        LAST_ZOOM_RAW_HARD_CAP,
        filters={"species": "Quercus"},
        region_id=None,
        province_id=None,
        municipality_id=5998,
        sub_municipal_area_id=None,
        green_area_id=None,
        clip_wkt=None,
    )
    assert len(out["features"]) == 1
