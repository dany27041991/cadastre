# Geoinsight — documentazione mappa

Riferimento completo per l’integrazione di **`@mase/commons-geoinsight`** nel microfrontend Catasto arboreo (SIV).

La mappa è la stessa di **cu1.5-fe**: WebGIS **155**, CU **PNRR**, `mapId=1`.

---

## Indice documentazione

| Documento | Quando leggerlo |
|-----------|-----------------|
| **[Riferimento generale](./riferimento.md)** | Panoramica architettura, bootstrap, troubleshooting |
| **[API MapBridge](./api-map-bridge.md)** | Tutti i metodi `loadGeoJson`, `loadGreenLayer`, clear, fit, … |
| **[API navigazione territorio](./api-navigazione-territorio.md)** | `useTerritoryNavigation`, loader, breadcrumb, API `/api/territory` |
| **[API libreria Geoinsight](./api-geoinsight-libreria.md)** | `<Geoinsight>`, ref imperativa, eventi, metodi bundle |
| **[Contratto GeoJSON](./contratto-geojson.md)** | Requisiti id, geometrie, properties per click e navigazione |
| **[Geometry Registry](./geometry-registry.md)** | Mapping `geom_id` ↔ feature, API registry interno |
| **[Cookbook](./cookbook.md)** | Ricette pratiche: regioni, verde, cluster, debug |
| **[Integrazione widget](./integrazione-widget.md)** | `TerritoryMapWidget`, layer asset verdi (`useGreenAssetsLayer`), flusso UI completo |

### Documenti correlati (fuori cartella)

| Documento | Contenuto |
|-----------|-----------|
| [Design parità cu1.5](../../../docs/design/2026-07-06-geoinsight-cu15-parity-design.md) | Decisioni architetturali |
| [Auth standalone](../security/autenticazione-e-utenza-mock-standalone.md) | Cookie + FGP per dev/proxy |

---

## Percorso consigliato

```
Nuovo sviluppatore
  → Riferimento §1-4 (architettura + bootstrap)
  → Cookbook §1-3 (montaggio + navigazione)
  → API MapBridge (metodi disponibili)

Estendere layer custom
  → Contratto GeoJSON
  → Geometry Registry
  → API libreria § addGeometries

Debug produzione
  → Riferimento §12 Troubleshooting
  → Cookbook §14
```

---

## File sorgente principali

| Area | Percorso |
|------|----------|
| Loader Vite / AMD | `src/vendor/mase-commons-geoinsight.ts` |
| Endpoint standalone | `src/vendor/geoinsightStandaloneEndpoints.ts` |
| Config WebGIS | `src/app/config/geoinsight.ts` |
| Container React | `src/features/territory-map-geoinsight/ui/GeoinsightMapContainer.tsx` |
| Adapter MapBridge | `src/features/territory-map-geoinsight/model/adapter/` |
| Hook bridge | `src/features/territory-map-geoinsight/model/hooks/useGeoinsightMapBridge.ts` |
| Navigazione | `src/features/territory/model/hooks/useTerritoryNavigation.ts` |
| API territorio | `src/features/territory/api/territory.api.ts` |
| Widget mappa | `src/widgets/territory-map-widget/TerritoryMapWidget.tsx` |
| Vite proxy + bundle | `vite.config.ts` |

---

## Avvio rapido (standalone)

1. Credenziali mock (`VITE_MOCK_COOKIE`, `VITE_MOCK_FGP`).
2. `npm install` con registry MASE (bundle ~6.5 MB).
3. `main.tsx`: `await initGeoinsightModule()` prima del render.
4. `onReady`: `flushAdapterPending()` + `loadRegions()`.

```tsx
const map = useGeoinsightMapBridge()
const nav = useTerritoryNavigation(mapBridge, { api: territoryApi })

<GeoinsightMapContainer
  onFeatureInfo={map.handleFeatureInfo}
  onReady={() => {
    map.flushAdapterPending()
    void nav.loadRegions()
  }}
/>
```

Dettagli: [Cookbook §1](./cookbook.md).

---

## API in una riga

| Livello | Hook / componente | Scopo |
|---------|-------------------|--------|
| Libreria | `initGeoinsightModule`, `<Geoinsight>`, `GeoinsightRef` | Mappa base + tile TOC |
| Bridge app | `useGeoinsightMapBridge()` → `MapBridge` | GeoJSON, layer, fit, click |
| Navigazione | `useTerritoryNavigation()` | Drill-down amministrativo + breadcrumb |
| UI | `TerritoryMapWidget` | Wiring completo produzione |
