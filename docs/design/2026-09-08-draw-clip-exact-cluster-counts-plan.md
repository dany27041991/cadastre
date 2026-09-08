# Plan — Draw clip cluster count esatti (soft cap)

**Spec:** [2026-09-08-draw-clip-exact-cluster-counts-design.md](./2026-09-08-draw-clip-exact-cluster-counts-design.md)  
**Parent plan:** [2026-08-18-draw-on-map-spatial-clip-plan.md](./2026-08-18-draw-on-map-spatial-clip-plan.md)  
**Stato:** implemented (P0–P5)

## Spike results (P0)

| Clip | km²~ | Comuni ∩ | Gate |
|------|------|----------|------|
| small Lecce | 5.7 | 1 | OK |
| medium Lecce | 94 | 9 | OK |
| large Lazio | 34670 | 531 | over-cap |

Soglie fissate: `CLIP_EXACT_MAX_MUNICIPALITIES=40`, `CLIP_EXACT_MAX_KM2=2000`.

Smoke viewport zoom 10 + `date=2025-09-01`:

- small → 1 feature, `sum_count=10681`, ~650 ms, no over-cap header  
- large → 0 features, header `X-Cadastre-Cluster-Over-Cap: 1`, ~9 ms  

## Tasklist

### P0 — Spike soglie
- [x] Script/smoke clip piccolo / medio / grande
- [x] Soglie env + doc
- [x] Payload over-cap: header `X-Cadastre-Cluster-Over-Cap: 1` + empty FC

### P1 — Soft-cap gate BE
- [x] `clip_exact.py` + `evaluate_clip_exact_cap`
- [x] Settings `CLIP_EXACT_*`
- [x] Unit tests `test_clip_exact.py` (9 passed con clip_wkt)

### P2 — Aggregazione silver esatta
- [x] `silver_read.aggregate_assets_in_clip` (grid + municipality)
- [x] `timed_op("clip_exact_cluster")`

### P3 — Repository + use case
- [x] `GreenAssetsLakehouseRepository._exact_clusters_for_clip` su admin/grid paths
- [x] Flag contextvar + ctrl header
- [x] CORS `expose_headers`

### P4 — Contratto over-cap + FE UX
- [x] Header + toast i18n (`clusterOverCap`, debounce 8s)
- [x] `fetcher.ts` legge header

### P5 — Docs close-out
- [x] Spec accepted; piano aggiornato
- [x] Addendum draw design (già link 2026-09-08)

## Rollback

`CLIP_EXACT_CLUSTERS=0` → over-cap path (empty clusters + header) quando c’è clip; senza clip gold invariato.
