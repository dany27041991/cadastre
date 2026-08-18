"""Unit tests for optional viewport/table clip_wkt parsing."""

from territory.common.infrastructure.clip_wkt import ClipWktError, normalize_clip_wkt


def test_normalize_clip_wkt_empty() -> None:
    assert normalize_clip_wkt(None) is None
    assert normalize_clip_wkt("") is None
    assert normalize_clip_wkt("   ") is None


def test_normalize_clip_wkt_polygon() -> None:
    wkt = "POLYGON((12 41,12 42,13 42,13 41,12 41))"
    assert normalize_clip_wkt(f"  {wkt}  ") == wkt


def test_normalize_clip_wkt_rejects_non_polygon() -> None:
    try:
        normalize_clip_wkt("POINT(12 41)")
    except ClipWktError:
        return
    raise AssertionError("expected ClipWktError")


def test_normalize_clip_wkt_rejects_too_long() -> None:
    try:
        normalize_clip_wkt("POLYGON((" + ("1 2," * 9000) + "1 2))")
    except ClipWktError:
        return
    raise AssertionError("expected ClipWktError")
