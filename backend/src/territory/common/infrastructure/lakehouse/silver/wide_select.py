"""Wide SELECT row fetching with gold skip and allowlist optimizations."""

from __future__ import annotations

import time
from typing import TYPE_CHECKING, Literal

if TYPE_CHECKING:
    from territory.common.infrastructure.lakehouse.catalog import IngestResolution

def _wide_select_rows(
    resolutions: list[IngestResolution],
    *,
    where_sql: str,
    select_cols: str,
    order_col: str,
    order_dir: str,
    offset: int,
    page_size: int,
    stub: Literal["assets", "areas"] | None = None,
) -> list[tuple]:
    """Fetch one page by walking municipalities (no global OFFSET over all files).

    Deep pages (e.g. last of ~64k rows) used to ``LIMIT offset+page_size`` on every
    chunk — tens of seconds. Skip whole municipalities via gold counts when the
    filter matches gold. When attribute filters block exact gold skip: build a
    non-stub allowlist from gold presence and run **one** SELECT with the caller's
    ``ORDER BY`` (path B — no municipal density priority). Unfiltered wide order
    stays ``municipality_id ASC, {order_col}`` so muni-level gold skip preserves order.

    Scan scope is driven only by ``where_sql`` product filters — never by
    municipality ids parsed from ZRIL codes.
    """
    # Late import to avoid circular dependency, enables test monkeypatching through silver_read
    from territory.common.infrastructure.lakehouse import silver_read
    from territory.common.infrastructure.lakehouse.metrics import timed_op

    from .allowlist import _gold_presence_where, _is_areas_roots_only_where, _non_stub_allowlist
    from .constants import _FILTER_DENSE_FLOOR, _TABLE_SINGLE_SHOT_MAX, _TABLE_WIDE_CHUNK
    from .sql import _files_sql_for

    ordered = sorted(
        resolutions,
        key=lambda r: (int(r.municipality_id), int(r.region_id), int(r.province_id)),
    )
    remaining_skip = max(0, offset)
    collected: list[tuple] = []
    count_scope = ordered
    gold_counts = silver_read._muni_counts_from_gold(count_scope, where_sql)
    presence_counts: dict[int, int] | None = None
    attribute_filtered = not (
        where_sql == "1=1" or _is_areas_roots_only_where(where_sql)
    )
    if gold_counts is not None:
        skip_mode = "gold"
    else:
        presence_counts = silver_read._muni_counts_from_gold(
            count_scope,
            _gold_presence_where(where_sql),
            require_complete=False,
        )
        skip_mode = (
            "allowlist_select"
            if attribute_filtered and presence_counts
            else ("presence_select" if presence_counts is not None else "select")
        )

    # Attribute filters: larger chunks (fewer MinIO round-trips). Unfiltered gold
    # skip keeps per-muni walks for exact offset math.
    filter_chunk = max(_TABLE_WIDE_CHUNK, 200) if attribute_filtered else _TABLE_WIDE_CHUNK

    # Chunked walks release the pool between chunks so a 2nd Cerca / viewport
    # is not blocked for 60–125s (debug 4fe799: oldest_hold_ms≈62k, pool=8/8).
    def _with_con(run):
        con = silver_read.connect_lakehouse()
        try:
            return run(con)
        finally:
            con.close()

    with timed_op(
        "silver_wide_select",
        municipalities=len(ordered),
        offset=offset,
        page_size=page_size,
        skip_mode=skip_mode,
    ):
            if gold_counts is not None:
                i = 0
                while i < len(ordered) and len(collected) < page_size:
                    mid = int(ordered[i].municipality_id)
                    muni_count = gold_counts.get(mid, 0)
                    if remaining_skip >= muni_count:
                        remaining_skip -= muni_count
                        i += 1
                        continue
                    need = page_size - len(collected)
                    files_sql = _files_sql_for([ordered[i]], stub=stub)
                    rem = remaining_skip

                    def _gold_q(con, _files=files_sql, _need=need, _rem=rem):
                        return con.execute(
                            f"""
                            SELECT {select_cols}
                            FROM read_parquet([{_files}], union_by_name=true)
                            WHERE {where_sql}
                            ORDER BY municipality_id ASC, {order_col} {order_dir}
                            LIMIT {int(_need)} OFFSET {int(_rem)}
                            """
                        ).fetchall()

                    rows = _with_con(_gold_q)
                    remaining_skip = 0
                    collected.extend(rows)
                    i += 1
            else:
                # Filtered / presence path: never COUNT(*) every muni.
                # Attribute filters (path B): allowlist munis with presence > floor
                # → one SELECT + caller ORDER BY (no density priority).
                candidates = list(ordered)
                if presence_counts is not None:
                    candidates = [
                        r
                        for r in ordered
                        if presence_counts.get(int(r.municipality_id), 0) > 0
                    ]

                if attribute_filtered and presence_counts is not None:
                    _t_allow = time.monotonic()
                    allowlist = _non_stub_allowlist(candidates, presence_counts)
                    ms_resolve = int((time.monotonic() - _t_allow) * 1000)
                    oneshot = len(allowlist) <= _TABLE_SINGLE_SHOT_MAX
                    if not allowlist:
                        collected = []
                    elif oneshot:
                        # Small allowlist: one SELECT + caller ORDER BY (path B).
                        files_sql = _files_sql_for(allowlist, stub=stub)
                        _t_q = time.monotonic()
                        _rem = remaining_skip

                        def _oneshot_q(con, _files=files_sql, _off=_rem):
                            return con.execute(
                                f"""
                                SELECT {select_cols}
                                FROM read_parquet([{_files}], union_by_name=true)
                                WHERE {where_sql}
                                ORDER BY {order_col} {order_dir}
                                LIMIT {int(page_size)} OFFSET {int(_off)}
                                """
                            ).fetchall()

                        rows = _with_con(_oneshot_q)
                        ms_select = int((time.monotonic() - _t_q) * 1000)
                        collected = list(rows)
                        remaining_skip = 0
                    else:
                        # National / wide allowlist: chunked walk + early exit.
                        # One-shot over ~7.9k parquet measured ~83s (debug H-slow).
                        # First page (offset=0): scan denser munis first so rare
                        # hits in boosted communes (e.g. Area boost) exit early;
                        # deep pages keep stable municipality_id order.
                        scan_list = list(allowlist)
                        scan_mode = "muni_asc"
                        if remaining_skip == 0 and presence_counts is not None:
                            scan_list = sorted(
                                allowlist,
                                key=lambda r: (
                                    -int(
                                        presence_counts.get(
                                            int(r.municipality_id), 0
                                        )
                                    ),
                                    int(r.municipality_id),
                                ),
                            )
                            scan_mode = "presence_desc"
                        _t_q = time.monotonic()
                        chunks_scanned = 0
                        for i in range(0, len(scan_list), filter_chunk):
                            if len(collected) >= page_size:
                                break
                            chunk = scan_list[i : i + filter_chunk]
                            if not chunk:
                                continue
                            chunks_scanned += 1
                            need = page_size - len(collected)
                            take = remaining_skip + need
                            files_sql = _files_sql_for(chunk, stub=stub)
                            _take = take

                            def _chunk_q(con, _files=files_sql, _lim=_take):
                                return con.execute(
                                    f"""
                                    SELECT {select_cols}
                                    FROM read_parquet([{_files}], union_by_name=true)
                                    WHERE {where_sql}
                                    ORDER BY municipality_id ASC, {order_col} {order_dir}
                                    LIMIT {int(_lim)}
                                    """
                                ).fetchall()

                            rows = _with_con(_chunk_q)
                            if remaining_skip >= len(rows):
                                remaining_skip -= len(rows)
                                continue
                            collected.extend(rows[remaining_skip:])
                            remaining_skip = 0
                            if len(collected) > page_size:
                                collected = collected[:page_size]
                        ms_select = int((time.monotonic() - _t_q) * 1000)
                else:
                    # Unfiltered presence/select: chunk walk, stable muni order.
                    _t_loop = time.monotonic()

                    def _run_chunks(chunks: list[list[IngestResolution]]) -> None:
                        nonlocal remaining_skip, collected
                        for i, chunk in enumerate(chunks):
                            if len(collected) >= page_size:
                                return
                            if not chunk:
                                continue
                            need = page_size - len(collected)
                            take = remaining_skip + need
                            files_sql = _files_sql_for(chunk, stub=stub)
                            _take = take

                            def _pres_q(con, _files=files_sql, _lim=_take):
                                return con.execute(
                                    f"""
                                    SELECT {select_cols}
                                    FROM read_parquet([{_files}], union_by_name=true)
                                    WHERE {where_sql}
                                    ORDER BY municipality_id ASC, {order_col} {order_dir}
                                    LIMIT {int(_lim)}
                                    """
                                ).fetchall()

                            rows = _with_con(_pres_q)
                            if remaining_skip >= len(rows):
                                remaining_skip -= len(rows)
                                continue
                            collected.extend(rows[remaining_skip:])
                            remaining_skip = 0
                            if len(collected) > page_size:
                                collected = collected[:page_size]

                    _run_chunks(
                        [
                            candidates[i : i + filter_chunk]
                            for i in range(0, len(candidates), filter_chunk)
                        ]
                    )

    return collected
