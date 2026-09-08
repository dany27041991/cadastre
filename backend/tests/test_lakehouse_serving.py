"""Lakehouse-only green serving tests (factories, catalog, dates, ops)."""

from __future__ import annotations

from datetime import date
from unittest.mock import MagicMock, patch

import pytest
from fastapi import HTTPException

from territory.areas.infrastructure.repository import _green_areas_repository
from territory.areas.infrastructure.repository.green_areas_lakehouse_repository import (
    GreenAreasLakehouseRepository,
)
from territory.assets.infrastructure.repository import _green_assets_repository
from territory.assets.infrastructure.repository.green_assets_lakehouse_repository import (
    GreenAssetsLakehouseRepository,
)
from territory.common.infrastructure.lakehouse.catalog import (
    IngestResolution,
    invalidate_catalog_cache,
    resolve_latest_ingests,
)
from territory.common.infrastructure.lakehouse.http_dates import parse_lakehouse_date_range


def test_factory_always_returns_lakehouse_repositories():
    assets = _green_assets_repository()
    areas = _green_areas_repository()
    assert isinstance(assets, GreenAssetsLakehouseRepository)
    assert isinstance(areas, GreenAreasLakehouseRepository)


def test_parse_lakehouse_date_range_requires_both():
    with pytest.raises(HTTPException) as missing_from:
        parse_lakehouse_date_range(None, date(2024, 12, 31))
    assert missing_from.value.status_code == 400

    with pytest.raises(HTTPException) as missing_to:
        parse_lakehouse_date_range(date(2024, 1, 1), None)
    assert missing_to.value.status_code == 400

    with pytest.raises(HTTPException) as inverted:
        parse_lakehouse_date_range(date(2024, 12, 31), date(2024, 1, 1))
    assert inverted.value.status_code == 400

    df, dt = parse_lakehouse_date_range(date(2024, 1, 1), date(2024, 12, 31))
    assert df == date(2024, 1, 1)
    assert dt == date(2024, 12, 31)


def test_lakehouse_raw_reads_fixture_from_minio():
    """Requires MinIO with fixture (run_seed_fixture_lakehouse.sh)."""
    import os

    os.environ.setdefault("LAKEHOUSE_S3_ENDPOINT", "http://localhost:9000")
    os.environ.setdefault("LAKEHOUSE_S3_ACCESS_KEY", "cadastre_lake")
    os.environ.setdefault("LAKEHOUSE_S3_SECRET_KEY", "cadastre_lake_dev_change_me")
    os.environ.setdefault("LAKEHOUSE_S3_BUCKET", "cadastre-lake")

    invalidate_catalog_cache()
    repo = GreenAssetsLakehouseRepository(
        session_factory=MagicMock(),
        date_from=date(2000, 1, 1),
        date_to=date(2099, 12, 31),
    )
    try:
        fc = repo.get_raw_in_bbox(
            (18.0, 40.0, 18.3, 40.5),
            limit=100,
            municipality_id=999001,
        )
    except Exception as exc:
        pytest.skip(f"MinIO fixture not available: {exc}")
    assert fc["type"] == "FeatureCollection"
    assert len(fc["features"]) >= 1
    assert fc["features"][0]["geometry"]["type"] == "Point"


def test_resolve_latest_ingests_max_per_municipality():
    invalidate_catalog_cache()
    rows = [
        {
            "municipality_id": 1,
            "region_id": 10,
            "province_id": 100,
            "dataset": "assets",
            "ingest_at": date(2024, 1, 1),
            "object_prefix": "green_assets/.../ingest_date=2024-01-01",
        },
        {
            "municipality_id": 1,
            "region_id": 10,
            "province_id": 100,
            "dataset": "assets",
            "ingest_at": date(2024, 6, 15),
            "object_prefix": "green_assets/.../ingest_date=2024-06-15",
        },
        {
            "municipality_id": 2,
            "region_id": 10,
            "province_id": 100,
            "dataset": "assets",
            "ingest_at": date(2024, 3, 1),
            "object_prefix": "green_assets/.../ingest_date=2024-03-01",
        },
        {
            "municipality_id": 1,
            "region_id": 10,
            "province_id": 100,
            "dataset": "areas",
            "ingest_at": date(2024, 6, 15),
            "object_prefix": "green_areas/.../ingest_date=2024-06-15",
        },
    ]
    with patch(
        "territory.common.infrastructure.lakehouse.catalog._load_catalog_rows",
        return_value=rows,
    ):
        resolved = resolve_latest_ingests(
            dataset="assets",
            date_from=date(2024, 1, 1),
            date_to=date(2024, 12, 31),
            municipality_ids=[1, 2],
        )
    assert len(resolved) == 2
    by_id = {r.municipality_id: r for r in resolved}
    assert by_id[1].ingest_at == date(2024, 6, 15)
    assert "2024-06-15" in by_id[1].object_prefix
    assert by_id[2].ingest_at == date(2024, 3, 1)
    assert isinstance(by_id[1], IngestResolution)


def test_gold_clusters_build_municipality_and_grid_bands():
    """Pure unit: gold generator produces municipality + grid_13..18."""
    import sys
    from pathlib import Path

    import pyarrow as pa

    scripts = (
        Path(__file__).resolve().parents[2]
        / "infrastructure"
        / "scripts"
        / "database"
        / "lakehouse"
    )
    sys.path.insert(0, str(scripts))
    from gold_clusters import GOLD_GRID_BANDS, build_all_gold_bands

    assets = pa.table(
        {
            "id": pa.array([1, 2, 3], type=pa.int64()),
            "lon": pa.array([18.17, 18.18, 18.19], type=pa.float64()),
            "lat": pa.array([40.35, 40.36, 40.37], type=pa.float64()),
        }
    )
    bands = build_all_gold_bands(
        assets, region_id=16, province_id=75, municipality_id=999001
    )
    assert "municipality" in bands
    assert bands["municipality"].num_rows == 1
    assert int(bands["municipality"].column("count")[0].as_py()) == 3
    for z in GOLD_GRID_BANDS:
        assert f"grid_{z}" in bands
        assert bands[f"grid_{z}"].num_rows >= 1


def test_lakehouse_gold_admin_clusters_from_minio():
    """Requires MinIO fixture with gold (run_seed_fixture_lakehouse.sh)."""
    import os

    os.environ.setdefault("LAKEHOUSE_S3_ENDPOINT", "http://localhost:9000")
    os.environ.setdefault("LAKEHOUSE_S3_ACCESS_KEY", "cadastre_lake")
    os.environ.setdefault("LAKEHOUSE_S3_SECRET_KEY", "cadastre_lake_dev_change_me")
    os.environ.setdefault("LAKEHOUSE_S3_BUCKET", "cadastre-lake")

    invalidate_catalog_cache()
    repo = GreenAssetsLakehouseRepository(
        session_factory=MagicMock(),
        date_from=date(2000, 1, 1),
        date_to=date(2099, 12, 31),
    )
    try:
        admin = repo.get_admin_clusters_in_bbox(
            "municipality",
            (18.0, 40.0, 18.3, 40.5),
            municipality_id=999001,
        )
        grid = repo.get_grid_clusters_from_gold(
            13,
            (18.0, 40.0, 18.3, 40.5),
            municipality_id=999001,
        )
    except Exception as exc:
        pytest.skip(f"MinIO gold fixture not available: {exc}")
    if not admin:
        pytest.skip("Gold not present yet — re-run run_seed_fixture_lakehouse.sh")
    assert admin[0].count >= 1
    assert admin[0].admin_key is not None
    assert admin[0].lon is not None
    assert len(grid) >= 1
    assert grid[0].count >= 1


def test_invalidate_catalog_endpoint_ok():
    from fastapi import FastAPI
    from fastapi.testclient import TestClient

    with patch(
        "territory.common.infrastructure.web.lakehouse_ctrl.invalidate_catalog_cache"
    ) as inv:
        from territory.common.infrastructure.web.lakehouse_ctrl import router

        app = FastAPI()
        app.include_router(router, prefix="/api/territory")
        client = TestClient(app)
        res = client.post("/api/territory/lakehouse/catalog/invalidate")
    assert res.status_code == 200
    assert res.json()["status"] == "ok"
    inv.assert_called_once()
