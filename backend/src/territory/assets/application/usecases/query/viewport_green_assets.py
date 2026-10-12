"""Viewport-sized green assets response for national-scale map rendering."""

from __future__ import annotations

from typing import Any

from territory.geo.domain.entities import GeoJSONFeatureCollection
from territory.assets.infrastructure.repository.green_assets_lakehouse_repository import (
    GreenAssetsLakehouseRepository,
)
from territory.assets.application.usecases.query.viewport_grid import (
    ADMIN_MUNICIPALITY_HARD_CAP,
    CLUSTER_GRID_MAX_REFINE_ZOOM,
    CLUSTER_MAX_ZOOM_THRESHOLD,
    CLUSTER_ZOOM_DETAIL,
    GRID_ADMIN_HANDOFF_MAX_MUNICIPALITIES,
    GRID_CLUSTER_HARD_CAP,
    LAST_ZOOM_RAW_HARD_CAP,
    RAW_MAX_MUNICIPALITIES,
    RAW_MIN_ZOOM,
    grid_cell_size_m,
    grid_gold_zoom_level,
)
from territory.assets.application.usecases.query.viewport_admin_policy import (
    admin_clusters_response,
)
from territory.assets.application.usecases.query.viewport_cluster_geojson import (
    admin_features_collection,
    grid_clusters_features_collection,
)
from core.logger import log_invocation


@log_invocation(log_args=True, log_result=False)
def viewport_green_assets(
    repository: GreenAssetsLakehouseRepository,
    bbox: tuple[float, float, float, float],
    zoom: float,
    *,
    region_id: int | None = None,
    province_id: int | None = None,
    municipality_id: int | None = None,
    sub_municipal_area_id: int | None = None,
    green_area_id: int | None = None,
    clip_wkt: str | None = None,
    filters: dict[str, Any] | None = None,
    area_filters: dict[str, Any] | None = None,
) -> GeoJSONFeatureCollection:
    """Viewport-sized green assets response (national-scale map rendering).

    Returns raw assets at the vendor's last zoom level (>= RAW_MIN_ZOOM),
    otherwise grid-cell cluster points from gold Parquet (or live gold-band
    fallback). Cluster features carry cluster_count, cluster_key (stable
    grid cell) and cluster_bbox so the frontend can drill without a second
    request.

    The raw/clusters decision is zoom-only: count-based hysteresis kept
    clusters on screen at the last level right after a drill, hiding the
    assets the user drilled for.

    At low zooms clusters come from pre-aggregated admin gold instead of a
    live grid scan: a nationwide grid aggregation measured 12s on 5.5M rows
    and grows with the dataset, while admin aggregates are O(#admin units).

    Attribute filters: gold/admin cannot apply silver predicates. Area
    filters (``area__*``) resolve matching munis/area ids, then reuse the
    same admin → grid → raw zoom ladder scoped to those munis (raw applies
    ``green_area_ids`` + asset filters). Asset-only filters stay on
    filtered silver raw (no gold join).
    """
    from territory.common.infrastructure.lakehouse import silver_read

    scope = {
        "region_id": region_id,
        "province_id": province_id,
        "municipality_id": municipality_id,
        "sub_municipal_area_id": sub_municipal_area_id,
        "green_area_id": green_area_id,
        "clip_wkt": clip_wkt,
    }
    has_asset_filters = bool(filters)
    has_area_filters = bool(area_filters)
    green_area_ids: list[int] | None = None
    match_munis: list[int] | None = None
    area_clip_geom = None
    match_pairs_sample: list[tuple[int, int]] = []
    n_clip_res = 0
    if has_area_filters:
        import time as _time_match

        _t_match = _time_match.monotonic()
        area_res = silver_read.resolve_prefixes(
            dataset="areas",
            date_from=getattr(repository, "_date_from", None),
            date_to=getattr(repository, "_date_to", None),
            region_id=region_id,
            province_id=province_id,
            municipality_id=municipality_id,
        )
        _ms_prefixes = int((_time_match.monotonic() - _t_match) * 1000)
        # Admin/grid gold ignores green_area_id — only municipality scope is
        # needed. Full area-id resolve hit 50k rows / 6250 munis ≈ 57s (debug).
        # Selective Cerca (few munis) must resolve area ids at EVERY zoom:
        # otherwise filtered_ladder serves muni-wide gold/raw and assets appear
        # outside the matched polygon (debug 4fe799: z12–15 n_area_ids=0).
        # Widespread short-circuits to unscoped gold (probe_wide) at cluster zooms.
        _t_munis = _time_match.monotonic()
        match_munis, muni_resolve_mode = (
            silver_read.resolve_matching_municipality_ids(
                area_res,
                area_filters,
                allow_widespread_shortcircuit=True,
                date_from=getattr(repository, "_date_from", None),
                date_to=getattr(repository, "_date_to", None),
            )
        )
        _ms_munis = int((_time_match.monotonic() - _t_munis) * 1000)
        if muni_resolve_mode == "empty" or match_munis == []:
            return {"type": "FeatureCollection", "features": []}
        selective = match_munis is not None
        need_area_ids = zoom >= RAW_MIN_ZOOM or (
            selective and len(match_munis) <= RAW_MAX_MUNICIPALITIES
        )
        # probe_wide × asset filters: match_munis is None and used to fall into
        # filtered_raw_asset_only (national silver ~110s, ignores area scope —
        # debug 4fe799 name=area + plant_code). Force bounded match_areas pin.
        probe_wide_asset_pin = (
            has_asset_filters and match_munis is None and not need_area_ids
        )
        if probe_wide_asset_pin:
            need_area_ids = True
        match_mode = "areas" if need_area_ids else f"munis:{muni_resolve_mode}"
        n_matches = 0
        _ms_areas = 0
        _ms_clip = 0
        # perf-opt P0: after match_munis, NEVER re-scan all ~7.9k munis for
        # area ids — scope resolve_matching_areas to the matched set.
        # Baseline cold villa: ms_munis~7s + ms_areas~6.5s = ~14s wall;
        # scoped areas on 1 muni drops ms_areas to tens of ms (debug 4fe799).
        opt_path = "munis_only"
        n_areas_res_in = len(area_res)
        n_areas_res_scoped = 0
        if need_area_ids:
            muni_set = {int(m) for m in (match_munis or [])}
            areas_res_scoped = (
                [r for r in area_res if int(r.municipality_id) in muni_set]
                if muni_set
                else list(area_res)
            )
            n_areas_res_scoped = len(areas_res_scoped)
            opt_path = (
                f"munis_then_scoped_areas:n={n_areas_res_scoped}"
                if muni_set
                else (
                    "probe_wide_pin_for_asset_filters"
                    if probe_wide_asset_pin
                    else "munis_then_areas_unscoped"
                )
            )
            _t_areas = _time_match.monotonic()
            # Bound probe_wide pin — full 50k area-id resolve was ~57s.
            _areas_limit = 2_000 if probe_wide_asset_pin or not muni_set else 50_000
            matches = silver_read.resolve_matching_areas(
                areas_res_scoped,
                area_filters,
                limit=_areas_limit,
                date_from=getattr(repository, "_date_from", None),
                date_to=getattr(repository, "_date_to", None),
            )
            _ms_areas = int((_time_match.monotonic() - _t_areas) * 1000)
            if not matches:
                return {"type": "FeatureCollection", "features": []}
            green_area_ids = [m[0] for m in matches]
            match_munis = sorted({m[1] for m in matches})
            n_matches = len(matches)
            match_mode = "areas"
            match_pairs_sample = matches[:5]
            # Spatial clip only on matched munis — full area_res (~7.9k prefixes)
            # hung DuckDB/MinIO (debug 4fe799: union_geom IOException / FE spinner).
            muni_set = set(match_munis)
            clip_res = [r for r in area_res if int(r.municipality_id) in muni_set]
            n_clip_res = len(clip_res)
            if clip_res and n_clip_res <= RAW_MAX_MUNICIPALITIES:
                _t_clip = _time_match.monotonic()
                area_clip_geom = silver_read.union_geom_for_area_ids(
                    clip_res, green_area_ids
                )
                _ms_clip = int((_time_match.monotonic() - _t_clip) * 1000)
        # #region agent log
        try:
            import json as _json
            import urllib.request as _urlreq

            _ms_match_total = int((_time_match.monotonic() - _t_match) * 1000)
            _payload = _json.dumps(
                {
                    "sessionId": "4fe799",
                    "runId": "perf-opt",
                    "hypothesisId": "H-opt-scoped-areas",
                    "location": "viewport_green_assets:area_match",
                    "message": "area_cross_filter",
                    "data": {
                        "match_mode": match_mode,
                        "muni_resolve_mode": muni_resolve_mode,
                        "opt_path": opt_path,
                        "need_area_ids": need_area_ids,
                        "n_matches": n_matches,
                        "n_munis": (
                            None
                            if match_munis is None
                            else len(match_munis)
                        ),
                        "sample_munis": (
                            None
                            if match_munis is None
                            else match_munis[:5]
                        ),
                        "sample_pairs": match_pairs_sample,
                        "n_area_ids": len(green_area_ids or []),
                        "has_area_clip": area_clip_geom is not None,
                        "zoom": zoom,
                        "ms_match": _ms_match_total,
                        "ms_prefixes": _ms_prefixes,
                        "ms_munis": _ms_munis,
                        "ms_areas": _ms_areas,
                        "ms_clip": _ms_clip,
                        "n_areas_res_in": n_areas_res_in,
                        "n_areas_res_scoped": n_areas_res_scoped,
                        "baseline_cold_ms_match_approx": 13500,
                        "code_ver": "match-v7-probe-wide-asset-pin",
                        "probe_wide_asset_pin": probe_wide_asset_pin,
                        "n_clip_res": n_clip_res,
                    },
                    "timestamp": int(_time_match.time() * 1000),
                }
            ).encode("utf-8")
            _urlreq.urlopen(
                _urlreq.Request(
                    "http://host.docker.internal:7455/ingest/ee4d7135-3aef-4e11-b07a-3de89c3bf62c",
                    data=_payload,
                    headers={
                        "Content-Type": "application/json",
                        "X-Debug-Session-Id": "4fe799",
                    },
                    method="POST",
                ),
                timeout=1.5,
            )
        except Exception:
            pass
        # #endregion

    # Asset-only filters (no area cross-filter): national silver raw.
    # Do NOT enter when area filters are probe_wide (match_munis is also None) —
    # that ignored area scope and thrashed MinIO ~110s (debug 4fe799).
    if has_asset_filters and not has_area_filters and match_munis is None:
        path_name = "filtered_raw_asset_only"
        fc = repository.get_raw_in_bbox(
            bbox,
            LAST_ZOOM_RAW_HARD_CAP,
            filters=filters,
            **scope,
        )
        # #region agent log
        try:
            import json as _json
            import time as _time
            import urllib.request as _urlreq

            _n = len(fc.get("features") or [])
            _payload = _json.dumps(
                {
                    "sessionId": "4fe799",
                    "runId": "asset-area-cerca",
                    "hypothesisId": "H-asset-area-path",
                    "location": "catalog_green_asset.viewport_green_assets",
                    "message": "viewport_assets_path",
                    "data": {
                        "has_filters": has_asset_filters,
                        "has_area_filters": has_area_filters,
                        "filter_keys": sorted((filters or {}).keys()),
                        "filters": {
                            k: str(v)[:80] for k, v in (filters or {}).items()
                        },
                        "area_filter_keys": sorted((area_filters or {}).keys()),
                        "zoom": zoom,
                        "path": path_name,
                        "municipality_id": municipality_id,
                        "region_id": region_id,
                        "n_features": _n,
                        "raw_hard_cap": LAST_ZOOM_RAW_HARD_CAP,
                        "capped": _n >= LAST_ZOOM_RAW_HARD_CAP,
                        "kind": "raw",
                        "asset_filters_applied_to_counts": True,
                    },
                    "timestamp": int(_time.time() * 1000),
                }
            ).encode("utf-8")
            _urlreq.urlopen(
                _urlreq.Request(
                    "http://host.docker.internal:7455/ingest/ee4d7135-3aef-4e11-b07a-3de89c3bf62c",
                    data=_payload,
                    headers={
                        "Content-Type": "application/json",
                        "X-Debug-Session-Id": "4fe799",
                    },
                    method="POST",
                ),
                timeout=1.5,
            )
        except Exception:
            pass
        # #endregion
        return fc

    filter_scope_munis = match_munis
    raw_kwargs: dict[str, Any] = {**scope}
    if green_area_ids is not None:
        raw_kwargs["green_area_ids"] = green_area_ids
    if filter_scope_munis is not None:
        raw_kwargs["municipality_ids"] = filter_scope_munis
    if filters:
        raw_kwargs["filters"] = filters
    if area_clip_geom is not None:
        raw_kwargs["clip_geom"] = area_clip_geom

    # #region agent log
    try:
        import json as _json
        import time as _time
        import urllib.request as _urlreq

        if green_area_ids is not None:
            _path = "live_ga_or_raw"
        elif filter_scope_munis is not None:
            _path = "filtered_ladder"
        else:
            _path = "gold_or_grid"
        _payload = _json.dumps(
            {
                "sessionId": "4fe799",
                "runId": "asset-area-cerca",
                "hypothesisId": "H-asset-area-path",
                "location": "catalog_green_asset.viewport_green_assets",
                "message": "viewport_assets_path",
                "data": {
                    "has_filters": has_asset_filters,
                    "has_area_filters": has_area_filters,
                    "filter_keys": sorted((filters or {}).keys()),
                    "area_filter_keys": sorted((area_filters or {}).keys()),
                    "zoom": zoom,
                    "path": _path,
                    "municipality_id": municipality_id,
                    "region_id": region_id,
                    "n_match_munis": (
                        len(filter_scope_munis) if filter_scope_munis else 0
                    ),
                    "n_area_ids": len(green_area_ids or []),
                    "skip_admin_for_asset_filters": bool(has_asset_filters),
                },
                "timestamp": int(_time.time() * 1000),
            }
        ).encode("utf-8")
        _urlreq.urlopen(
            _urlreq.Request(
                "http://host.docker.internal:7455/ingest/ee4d7135-3aef-4e11-b07a-3de89c3bf62c",
                data=_payload,
                headers={
                    "Content-Type": "application/json",
                    "X-Debug-Session-Id": "4fe799",
                },
                method="POST",
            ),
            timeout=1.5,
        )
    except Exception:
        pass
    # #endregion

    # Admin gold (with optional clip on unit extent) for low zooms.
    # A green-area scope has no pre-aggregated admin rows; grid/raw only.
    # Cerca area filters with resolved ids must NOT use muni admin gold —
    # that shows every asset cluster in the municipality (outside the GA_).
    # Asset attribute filters: gold has no silver predicates — skip admin.
    if (
        green_area_id is None
        and green_area_ids is None
        and not has_asset_filters
    ):
        admin = admin_clusters_response(
            repository,
            bbox, zoom, region_id=region_id, province_id=province_id,
            municipality_id=municipality_id,
            sub_municipal_area_id=sub_municipal_area_id,
            clip_wkt=clip_wkt,
            municipality_ids=filter_scope_munis,
        )
        if admin is not None:
            # #region agent log
            try:
                import json as _json
                import time as _time
                import urllib.request as _urlreq

                _feats = admin.get("features") or []
                _sum = 0
                for _f in _feats:
                    _p = (_f or {}).get("properties") or {}
                    _sum += int(_p.get("cluster_count") or 0)
                _payload = _json.dumps(
                    {
                        "sessionId": "4fe799",
                        "runId": "asset-cluster-count",
                        "hypothesisId": "H-B-gold-ignores-asset-filters",
                        "location": "viewport_green_assets:admin_return",
                        "message": "assets_cluster_path",
                        "data": {
                            "path": "admin_gold",
                            "zoom": zoom,
                            "has_asset_filters": has_asset_filters,
                            "has_area_filters": has_area_filters,
                            "filter_keys": sorted((filters or {}).keys()),
                            "area_filter_keys": sorted(
                                (area_filters or {}).keys()
                            ),
                            "n_features": len(_feats),
                            "sum_cluster_count": _sum,
                            "n_match_munis": (
                                len(filter_scope_munis)
                                if filter_scope_munis is not None
                                else None
                            ),
                            "asset_filters_applied_to_counts": False,
                        },
                        "timestamp": int(_time.time() * 1000),
                    }
                ).encode("utf-8")
                _urlreq.urlopen(
                    _urlreq.Request(
                        "http://host.docker.internal:7455/ingest/ee4d7135-3aef-4e11-b07a-3de89c3bf62c",
                        data=_payload,
                        headers={
                            "Content-Type": "application/json",
                            "X-Debug-Session-Id": "4fe799",
                        },
                        method="POST",
                    ),
                    timeout=1.5,
                )
            except Exception:
                pass
            # #endregion
            return admin

    # Raw only when the silver scan stays cheap (few municipality files).
    # Wide/national raw measured 4–56s opening hundreds–thousands of Parquet.
    # Cerca with resolved green_area_ids: live-cluster until RAW_MIN_ZOOM —
    # raw at z16 returned 0 while live clusters had sum=808 (debug 4fe799 villa).
    force_grid_level: int | None = None
    filtered_raw_ready = (
        green_area_ids is not None
        or (
            filter_scope_munis is not None
            and len(filter_scope_munis) <= RAW_MAX_MUNICIPALITIES
        )
    )
    raw_zoom_ok = zoom >= RAW_MIN_ZOOM or (
        filtered_raw_ready
        and green_area_ids is None
        and zoom >= CLUSTER_ZOOM_DETAIL
    )
    if raw_zoom_ok:
        if (
            sub_municipal_area_id is None
            and green_area_id is None
            and clip_wkt is None
            and filter_scope_munis is None
            and green_area_ids is None
        ):
            muni_probe = repository.get_admin_clusters_in_bbox(
                "municipality",
                bbox,
                region_id=region_id,
                province_id=province_id,
                municipality_id=municipality_id,
            )
            if len(muni_probe) > RAW_MAX_MUNICIPALITIES:
                force_grid_level = CLUSTER_GRID_MAX_REFINE_ZOOM
            else:
                fc_raw = repository.get_raw_in_bbox(
                    bbox, LAST_ZOOM_RAW_HARD_CAP, **raw_kwargs
                )
                # #region agent log
                try:
                    import json as _json
                    import time as _time
                    import urllib.request as _urlreq

                    _payload = _json.dumps(
                        {
                            "sessionId": "4fe799",
                            "runId": "areas-map",
                            "hypothesisId": "H-raw",
                            "location": "viewport_green_assets:raw",
                            "message": "assets_raw_done",
                            "data": {
                                "n_features": len(fc_raw.get("features") or []),
                                "zoom": zoom,
                                "n_area_ids": len(green_area_ids or []),
                                "n_match_munis": (
                                    len(filter_scope_munis)
                                    if filter_scope_munis
                                    else 0
                                ),
                                "raw_zoom_ok": raw_zoom_ok,
                                "filtered_raw_ready": filtered_raw_ready,
                            },
                            "timestamp": int(_time.time() * 1000),
                        }
                    ).encode("utf-8")
                    _urlreq.urlopen(
                        _urlreq.Request(
                            "http://host.docker.internal:7455/ingest/ee4d7135-3aef-4e11-b07a-3de89c3bf62c",
                            data=_payload,
                            headers={
                                "Content-Type": "application/json",
                                "X-Debug-Session-Id": "4fe799",
                            },
                            method="POST",
                        ),
                        timeout=1.5,
                    )
                except Exception:
                    pass
                # #endregion
                return fc_raw
        else:
            fc_raw = repository.get_raw_in_bbox(
                bbox, LAST_ZOOM_RAW_HARD_CAP, **raw_kwargs
            )
            n_raw = len(fc_raw.get("features") or [])
            # #region agent log
            try:
                import json as _json
                import time as _time
                import urllib.request as _urlreq

                _payload = _json.dumps(
                    {
                        "sessionId": "4fe799",
                        "runId": "areas-map",
                        "hypothesisId": "H-raw",
                        "location": "viewport_green_assets:raw",
                        "message": "assets_raw_done",
                        "data": {
                            "n_features": n_raw,
                            "zoom": zoom,
                            "n_area_ids": len(green_area_ids or []),
                            "n_match_munis": (
                                len(filter_scope_munis) if filter_scope_munis else 0
                            ),
                            "raw_zoom_ok": raw_zoom_ok,
                            "filtered_raw_ready": filtered_raw_ready,
                            "fallback_live": bool(
                                n_raw == 0 and green_area_ids is not None
                            ),
                        },
                        "timestamp": int(_time.time() * 1000),
                    }
                ).encode("utf-8")
                _urlreq.urlopen(
                    _urlreq.Request(
                        "http://host.docker.internal:7455/ingest/ee4d7135-3aef-4e11-b07a-3de89c3bf62c",
                        data=_payload,
                        headers={
                            "Content-Type": "application/json",
                            "X-Debug-Session-Id": "4fe799",
                        },
                        method="POST",
                    ),
                    timeout=1.5,
                )
            except Exception:
                pass
            # #endregion
            # Cerca: empty raw must not hide live FK clusters (debug 4fe799).
            if n_raw > 0 or green_area_ids is None:
                return fc_raw

    # Cerca area ids: live-cluster by FK (gold has no green_area_ids).
    if green_area_ids is not None:
        import time as _time_live

        _t_live = _time_live.monotonic()
        clusters = repository.get_clusters_for_green_area_ids(
            bbox,
            grid_cell_size_m(zoom),
            green_area_ids,
            region_id=region_id,
            province_id=province_id,
            municipality_id=municipality_id,
            municipality_ids=filter_scope_munis,
            clip_wkt=clip_wkt,
            clip_geom=area_clip_geom,
            filters=filters,
        )
        _ms_live = int((_time_live.monotonic() - _t_live) * 1000)
        # #region agent log
        try:
            import json as _json
            import time as _time
            import urllib.request as _urlreq

            _payload = _json.dumps(
                {
                    "sessionId": "4fe799",
                    "runId": "perf-opt",
                    "hypothesisId": "H-opt-live-clusters",
                    "location": "viewport_green_assets:live_ga_clusters",
                    "message": "ga_ids_live_clusters",
                    "data": {
                        "n_clusters": len(clusters),
                        "n_area_ids": len(green_area_ids),
                        "zoom": zoom,
                        "ms_live_clusters": _ms_live,
                        "baseline_cold_ms": 786,
                        "has_draw_clip": bool(clip_wkt),
                        "has_area_clip": area_clip_geom is not None,
                        "sum_count": sum(int(c.count) for c in clusters),
                        "filter_keys": sorted((filters or {}).keys()),
                        "filters": {
                            k: str(v)[:80] for k, v in (filters or {}).items()
                        },
                        "asset_filters_applied_to_counts": bool(filters),
                    },
                    "timestamp": int(_time.time() * 1000),
                }
            ).encode("utf-8")
            _urlreq.urlopen(
                _urlreq.Request(
                    "http://host.docker.internal:7455/ingest/ee4d7135-3aef-4e11-b07a-3de89c3bf62c",
                    data=_payload,
                    headers={
                        "Content-Type": "application/json",
                        "X-Debug-Session-Id": "4fe799",
                    },
                    method="POST",
                ),
                timeout=1.5,
            )
        except Exception:
            pass
        # #endregion
        return grid_clusters_features_collection(clusters)

    # Pre-aggregated gold covers the grid zoom band. Clip filters cells via
    # extent ∩ polygon. Live grid is reserved for sub-area / green-area
    # scopes that need per-asset intersects.
    gold_level = force_grid_level or grid_gold_zoom_level(zoom)
    # Gold grid has no green_area_ids predicate — skip when Cerca scoped areas.
    use_gold = (
        gold_level is not None
        and sub_municipal_area_id is None
        and green_area_id is None
        and green_area_ids is None
    )
    if use_gold:
        assert gold_level is not None
        # Wide-viewport guard: municipality admin is O(#munis) and cheap;
        # fine grid_{z} over hundreds of munis hangs the map.
        # Single-municipality scope (e.g. Lecce breadcrumb) never needs the
        # handoff scan — skip the extra admin gold round-trip.
        if municipality_id is not None or (
            filter_scope_munis is not None
            and len(filter_scope_munis) <= GRID_ADMIN_HANDOFF_MAX_MUNICIPALITIES
        ):
            muni_admin: list = []
        else:
            muni_admin = repository.get_admin_clusters_in_bbox(
                "municipality",
                bbox,
                region_id=region_id,
                province_id=province_id,
                municipality_id=municipality_id,
                clip_wkt=clip_wkt,
                municipality_ids=filter_scope_munis,
            )
        if len(muni_admin) > GRID_ADMIN_HANDOFF_MAX_MUNICIPALITIES:
            if (
                len(muni_admin) > ADMIN_MUNICIPALITY_HARD_CAP
                and municipality_id is None
                and province_id is None
                and not clip_wkt
            ):
                prov_admin = repository.get_admin_clusters_in_bbox(
                    "province",
                    bbox,
                    region_id=region_id,
                    municipality_ids=filter_scope_munis,
                )
                return admin_features_collection(prov_admin)
            return admin_features_collection(muni_admin)

        clusters = repository.get_grid_clusters_from_gold(
            gold_level,
            bbox,
            region_id=region_id,
            province_id=province_id,
            municipality_id=municipality_id,
            clip_wkt=clip_wkt,
            municipality_ids=filter_scope_munis,
        )
        served_level = gold_level
        # One jump to the coarsest grid band when over cap. Binary search
        # did up to 5 gold reads and exhausted the DuckDB pool (debug:
        # coarsenReads=5 + concurrent zoom → 30s "pool exhausted" 500s).
        if (
            len(clusters) > GRID_CLUSTER_HARD_CAP
            and served_level > CLUSTER_MAX_ZOOM_THRESHOLD
        ):
            served_level = CLUSTER_MAX_ZOOM_THRESHOLD
            clusters = repository.get_grid_clusters_from_gold(
                served_level,
                bbox,
                region_id=region_id,
                province_id=province_id,
                municipality_id=municipality_id,
                clip_wkt=clip_wkt,
                municipality_ids=filter_scope_munis,
            )
        if (
            len(clusters) > GRID_CLUSTER_HARD_CAP
            and muni_admin
            and len(muni_admin) < len(clusters)
        ):
            return admin_features_collection(muni_admin)
    else:
        clusters = repository.get_clusters_in_bbox(
            bbox, grid_cell_size_m(zoom), **scope
        )

    # #region agent log
    try:
        import json as _json
        import time as _time
        import urllib.request as _urlreq

        _sum = sum(int(c.count) for c in clusters)
        _payload = _json.dumps(
            {
                "sessionId": "4fe799",
                "runId": "asset-cluster-count",
                "hypothesisId": "H-B-gold-ignores-asset-filters",
                "location": "viewport_green_assets:grid_return",
                "message": "assets_cluster_path",
                "data": {
                    "path": "grid_gold" if use_gold else "live_grid",
                    "zoom": zoom,
                    "has_asset_filters": has_asset_filters,
                    "has_area_filters": has_area_filters,
                    "filter_keys": sorted((filters or {}).keys()),
                    "area_filter_keys": sorted((area_filters or {}).keys()),
                    "n_clusters": len(clusters),
                    "sum_cluster_count": _sum,
                    "gold_level": gold_level if use_gold else None,
                    "n_match_munis": (
                        len(filter_scope_munis)
                        if filter_scope_munis is not None
                        else None
                    ),
                    "asset_filters_applied_to_counts": False,
                },
                "timestamp": int(_time.time() * 1000),
            }
        ).encode("utf-8")
        _urlreq.urlopen(
            _urlreq.Request(
                "http://host.docker.internal:7455/ingest/ee4d7135-3aef-4e11-b07a-3de89c3bf62c",
                data=_payload,
                headers={
                    "Content-Type": "application/json",
                    "X-Debug-Session-Id": "4fe799",
                },
                method="POST",
            ),
            timeout=1.5,
        )
    except Exception:
        pass
    # #endregion
    return grid_clusters_features_collection(clusters)
