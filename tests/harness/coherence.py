"""Coherence asserts between table totals and viewport feature counts."""

from __future__ import annotations


def assert_table_viewport_coherent(
    table_total: int,
    viewport_count: int,
    *,
    approx_ok: bool = False,
    label: str = "",
) -> None:
    """Viewport is bbox-limited; only require viewport ≤ table when not approx.

    For national approx totals, allow viewport_count ≤ table_total always;
    when approx_ok, also allow table_total to be a lower bound estimate.
    """
    if table_total < 0 or viewport_count < 0:
        raise AssertionError(f"{label} negative totals t={table_total} v={viewport_count}")
    if approx_ok:
        # National: table may be approximate; viewport is a bbox sample.
        return
    if viewport_count > table_total:
        raise AssertionError(
            f"{label} viewport_count={viewport_count} > table_total={table_total}"
        )
