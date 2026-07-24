# Piano implementazione — parità Geoinsight cu1.5

**Riferimento design:** [2026-07-06-geoinsight-cu15-parity-design.md](./2026-07-06-geoinsight-cu15-parity-design.md)

## Fase 1 — Parità contratto mappa (completata)

- [x] Costanti `155` / `PNRR` / `mapId=1`
- [x] `GeoinsightMapContainer` lifecycle ref + `ready` + `injectMapDrawHandleStyles`
- [x] `GeoinsightFocusContainer` z-index 700/1035
- [x] `geoinsightMapStyle` dual-runtime (shell vs standalone)
- [x] Loader Vite: unwrap `response.data`, proxy `Cookie` + `fgp`
- [x] Script rinnovo credenziali: `fetch-mock-credentials.py` + `renew-mock-credentials.mjs`

## Fase 2 — Verifica standalone (in corso)

1. Rinnovare credenziali mock (`fetch-mock-credentials.py`)
2. Riavviare Vite (`npm run dev`)
3. Verificare:
   - `GET /core/api/geoinsight/.../toc_layers` → 200
   - `<map-widget>` canvas presente
   - Tile visibili

## Fase 3 — Verifica shell MASE

1. Build webpack: `npm run build:webpack`
2. Shell import map: `@mase/commons-geoinsight@1.5.0`, `map-widget@1.6.0`
3. Mount `@mase/siv` con fgp/cookie portal
4. Stesso webgis 155 / PNRR

## Fase 4 — Backlog (post-spike)

- [ ] Draw events (`geometryDrawn`, …) se catasto richiede disegno
- [ ] WebGIS SIV dedicato (sostituire placeholder 155)
- [ ] E2E Playwright mappa in CI
- [ ] Loader Vite: valutare `@mase/commons-client` reale vs stub fetch

## Comandi rapidi

```bash
# Rinnovo credenziali
python3 infrastructure/scripts/fetch-mock-credentials.py
node infrastructure/scripts/renew-mock-credentials.mjs --file /tmp/mase-creds.json

# Dev standalone
cd frontend && npm run dev

# Build shell
cd frontend && npm run build:webpack
```
