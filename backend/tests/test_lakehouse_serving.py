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


def test_areas_stats_build_municipality_band_counts_roots_only():
    """Pure unit: areas stats count = parent_id IS NULL rows only."""
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
    from areas_stats import build_areas_municipality_band

    areas = pa.table(
        {
            "id": pa.array([10, 11, 12], type=pa.int64()),
            "parent_id": pa.array([None, 10, None], type=pa.int64()),
            "lon": pa.array([18.17, 18.18, 18.19], type=pa.float64()),
            "lat": pa.array([40.35, 40.36, 40.37], type=pa.float64()),
        }
    )
    band = build_areas_municipality_band(
        areas, region_id=16, province_id=75, municipality_id=999001
    )
    assert band.num_rows == 1
    assert int(band.column("count")[0].as_py()) == 2

    empty = build_areas_municipality_band(
        pa.table(
            {
                "id": pa.array([], type=pa.int64()),
                "parent_id": pa.array([], type=pa.int64()),
                "lon": pa.array([], type=pa.float64()),
                "lat": pa.array([], type=pa.float64()),
            }
        ),
        region_id=1,
        province_id=1,
        municipality_id=1,
    )
    assert int(empty.column("count")[0].as_py()) == 0


def test_resolve_wide_total_areas_roots_uses_gold(monkeypatch):
    """Wide areas roots-only where prefers areas_stats gold over approx."""
    from datetime import date

    from territory.common.infrastructure.lakehouse.catalog import IngestResolution
    from territory.common.infrastructure.lakehouse import silver_read

    resolutions = [
        IngestResolution(
            municipality_id=i,
            region_id=1,
            province_id=1,
            dataset="areas",
            ingest_at=date(2024, 6, 1),
            object_prefix=f"green_areas/municipality_id={i}",
        )
        for i in range(1, 45)
    ]

    silver_read._table_count_cache.clear()
    monkeypatch.setattr(silver_read, "_area_total_from_gold", lambda _r: 1234)
    monkeypatch.setattr(silver_read, "_asset_total_from_gold", lambda _r: 9999)
    scheduled: list[bool] = []
    monkeypatch.setattr(
        silver_read,
        "_schedule_wide_count",
        lambda *_a, **_k: scheduled.append(True),
    )

    total, source = silver_read._resolve_wide_total(
        resolutions,
        where_sql="1=1 AND parent_id IS NULL",
        offset=0,
        row_count=5,
        page_size=5,
        prefer_gold=True,
    )
    assert source == "gold"
    assert total == 1234
    assert scheduled == []

    total_q, source_q = silver_read._resolve_wide_total(
        resolutions,
        where_sql="1=1 AND parent_id IS NULL AND name ILIKE '%x%'",
        offset=0,
        row_count=5,
        page_size=5,
        prefer_gold=True,
    )
    assert source_q == "approx"
    assert total_q == 6
    assert scheduled == [True]


def test_wide_select_rows_skips_via_gold_counts(monkeypatch):
    """Deep offset must not LIMIT offset+page on every chunk — gold skip then local OFFSET."""
    from datetime import date

    from territory.common.infrastructure.lakehouse.catalog import IngestResolution
    from territory.common.infrastructure.lakehouse import silver_read

    resolutions = [
        IngestResolution(
            municipality_id=i,
            region_id=1,
            province_id=1,
            dataset="areas",
            ingest_at=date(2024, 6, 1),
            object_prefix=f"green_areas/municipality_id={i}",
        )
        for i in range(1, 6)
    ]
    # 10 roots each → offset 42 lands in muni 5 with local offset 2
    monkeypatch.setattr(
        silver_read,
        "_muni_counts_from_gold",
        lambda _r, _w: {i: 10 for i in range(1, 6)},
    )

    executed: list[str] = []

    class _FakeCon:
        def execute(self, sql: str):
            executed.append(" ".join(sql.split()))
            class _R:
                def fetchall(self_inner):
                    return [(99,)]
            return _R()

        def close(self):
            pass

    monkeypatch.setattr(silver_read, "connect_lakehouse", lambda: _FakeCon())

    rows = silver_read._wide_select_rows(
        resolutions,
        where_sql="1=1 AND parent_id IS NULL",
        select_cols="id",
        order_col="id",
        order_dir="ASC",
        offset=42,
        page_size=5,
    )
    assert rows == [(99,)]
    assert len(executed) == 1
    assert "OFFSET 2" in executed[0]
    assert "LIMIT 5" in executed[0]
    assert "municipality_id=5" in executed[0] or "green_areas/municipality_id=5" in executed[0]


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
