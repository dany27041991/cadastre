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
    area_filters_are_selective,
    asset_filter_where,
    collect_filters,
)


def test_area_name_and_area_code_remap():
    clauses = area_filter_where({"name": "Parco", "area_code": "ZRIL-1-3"})
    assert any("name" in c and "ILIKE" in c and "Parco" in c for c in clauses)
    assert any(
        "zril_identifier" in c and "ILIKE" in c and "ZRIL-1-3" in c for c in clauses
    )


def test_area_filters_are_selective_from_product_filters():
    assert area_filters_are_selective({"area_code": "zril-1-1"}) is True
    # name-only stays non-selective so widespread ILIKE can probe_wide.
    assert area_filters_are_selective({"name": "Area boost"}) is False
    assert area_filters_are_selective({"area_classification": "URBAN_PARKS"}) is True
    assert area_filters_are_selective({"surface_area_m2_min": "10"}) is False
    assert area_filters_are_selective({}) is False


def test_area_enum_exact_vs_ilike():
    exact = area_filter_where({"area_classification": "URBAN_PARKS"})
    assert exact == ["area_classification = 'URBAN_PARKS'"]
    fuzzy = area_filter_where({"area_classification": "park"})
    assert len(fuzzy) == 1 and "ILIKE" in fuzzy[0]


def test_area_surface_range_min_only():
    clauses = area_filter_where({"surface_area_m2_min": "1000"})
    assert len(clauses) == 1
    assert "TRY_CAST(surface_area_m2 AS DOUBLE) >= 1000" in clauses[0]
    assert "<=" not in clauses[0]


def test_area_surface_range_max_only():
    clauses = area_filter_where({"surface_area_m2_max": "5000"})
    assert len(clauses) == 1
    assert "TRY_CAST(surface_area_m2 AS DOUBLE) <= 5000" in clauses[0]


def test_area_surface_range_both():
    clauses = area_filter_where(
        {"surface_area_m2_min": "1000", "surface_area_m2_max": "5000"}
    )
    assert len(clauses) == 1
    assert ">= 1000" in clauses[0] and "<= 5000" in clauses[0]


def test_area_surface_range_inverted_is_empty():
    assert area_filter_where(
        {"surface_area_m2_min": "9000", "surface_area_m2_max": "100"}
    ) == ["1=0"]


def test_area_legacy_surface_single_ignored():
    assert area_filter_where({"surface_area_m2": "12500"}) == []


def test_area_survey_date_range():
    clauses = area_filter_where(
        {"survey_date_from": "2024-01-01", "survey_date_to": "2024-12-31"}
    )
    assert len(clauses) == 1
    assert "TRY_CAST(survey_date AS DATE)" in clauses[0]
    assert "DATE '2024-01-01'" in clauses[0]
    assert "DATE '2024-12-31'" in clauses[0]


def test_area_survey_date_inverted_is_empty():
    assert area_filter_where(
        {"survey_date_from": "2025-01-01", "survey_date_to": "2024-01-01"}
    ) == ["1=0"]


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


def test_asset_measures_range_and_growth():
    clauses = asset_filter_where(
        {
            "trunk_diameter_cm_min": "20",
            "trunk_diameter_cm_max": "40",
            "plant_height_m_min": "5",
            "crown_diameter_m_max": "12",
            "growth_stage": "MATURE",
            "protection_status": "NONE",
            "species_code": "QUE",
        }
    )
    assert any("trunk_diameter_cm" in c and ">= 20" in c and "<= 40" in c for c in clauses)
    assert any("plant_height_m" in c and ">= 5" in c for c in clauses)
    assert any("crown_diameter_m" in c and "<= 12" in c for c in clauses)
    assert "growth_stage = 'MATURE'" in clauses
    assert "protection_status = 'NONE'" in clauses
    assert any("species_code" in c for c in clauses)


def test_asset_legacy_measure_single_ignored():
    assert asset_filter_where({"trunk_diameter_cm": "32"}) == []


def test_area_full_and_mix():
    clauses = area_filter_where(
        {
            "name": "Villa",
            "area_classification": "URBAN_PARKS",
            "surface_area_m2_min": "100",
            "surface_area_m2_max": "99999",
            "survey_date_from": "2020-01-01",
            "survey_date_to": "2026-12-31",
        }
    )
    assert len(clauses) == 4
    assert any("Villa" in c for c in clauses)
    assert "area_classification = 'URBAN_PARKS'" in clauses


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
