"""Unit tests for clip exact soft-cap helpers."""

from shapely import wkt as shapely_wkt

from territory.common.infrastructure.lakehouse.clip_exact import (
    approx_clip_km2,
    evaluate_clip_exact_cap,
)


class _FakeResult:
    def __init__(self, ids: list[int]) -> None:
        self._ids = ids

    def fetchall(self):
        return [(i,) for i in self._ids]


class _FakeSession:
    def __init__(self, ids: list[int]) -> None:
        self._ids = ids

    def execute(self, _stmt, _params=None):
        return _FakeResult(self._ids)


def test_approx_clip_km2_positive() -> None:
    g = shapely_wkt.loads(
        "POLYGON((18.16 40.34, 18.19 40.34, 18.19 40.36, 18.16 40.36, 18.16 40.34))"
    )
    assert approx_clip_km2(g) > 1.0


def test_evaluate_clip_exact_cap_ok() -> None:
    g = shapely_wkt.loads(
        "POLYGON((18.16 40.34, 18.19 40.34, 18.19 40.36, 18.16 40.36, 18.16 40.34))"
    )
    decision = evaluate_clip_exact_cap(
        _FakeSession([1, 2, 3]),
        g,
        g.wkt,
        max_municipalities=40,
        max_km2=2000.0,
    )
    assert decision.eligible is True
    assert decision.municipality_ids == (1, 2, 3)


def test_evaluate_clip_exact_cap_municipalities() -> None:
    g = shapely_wkt.loads(
        "POLYGON((18.16 40.34, 18.19 40.34, 18.19 40.36, 18.16 40.36, 18.16 40.34))"
    )
    decision = evaluate_clip_exact_cap(
        _FakeSession(list(range(1, 50))),
        g,
        g.wkt,
        max_municipalities=40,
        max_km2=2000.0,
    )
    assert decision.eligible is False
    assert decision.reason == "municipalities"


def test_evaluate_clip_exact_cap_km2() -> None:
    g = shapely_wkt.loads(
        "POLYGON((11.5 41.0, 14.0 41.0, 14.0 42.5, 11.5 42.5, 11.5 41.0))"
    )
    decision = evaluate_clip_exact_cap(
        _FakeSession([1]),
        g,
        g.wkt,
        max_municipalities=40,
        max_km2=2000.0,
    )
    assert decision.eligible is False
    assert decision.reason == "km2"


def test_evaluate_clip_exact_cap_disabled() -> None:
    g = shapely_wkt.loads(
        "POLYGON((18.16 40.34, 18.19 40.34, 18.19 40.36, 18.16 40.36, 18.16 40.34))"
    )
    decision = evaluate_clip_exact_cap(
        _FakeSession([1]),
        g,
        g.wkt,
        max_municipalities=40,
        max_km2=2000.0,
        enabled=False,
    )
    assert decision.eligible is False
    assert decision.reason == "disabled"
