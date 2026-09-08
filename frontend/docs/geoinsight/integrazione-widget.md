# Integrazione widget UI

Come i componenti React collegano mappa, navigazione, breadcrumb e palette verde nel flusso completo SIV.

> **Green viz:** viewport/table/detail → lakehouse (MinIO+DuckDB). I fetcher devono passare **`date_from` / `date_to`**. Cluster = gold Parquet (non PostGIS).

---

## Architettura widget

```
TerritoryMapWidget
├── useGeoinsightMapBridge()       → adapter + click Geoinsight
├── useTerritoryMapBridge(map)     → MapBridge + leaf-area restore
├── useTerritoryMapEffects         → resync, drill sync, feature select
├── useTerritoryNavigation()       → level, breadcrumb, loader
├── GeoinsightFocusContainer       → layout + z-index
│   └── GeoinsightMapContainer     → <Geoinsight />
└── MainContent                    → breadcrumb UI + slot mappa + accordion
```

Percorso: `src/widgets/territory-map-widget/TerritoryMapWidget.tsx`.

---

## TerritoryMapWidget

### Responsabilità

1. Creare `mapBridge` con `useTerritoryMapBridge(map)` (leaf storage incluso).
2. Collegare `useTerritoryNavigation(mapBridge, { api: territoryApi, t })`.
3. Registrare effetti via `useTerritoryMapFeatureSelect`, `useTerritoryMapDrillSync`, `useTerritoryMapLeafCleanup`.
4. Su `ready`: `useTerritoryMapResync` → `flushAdapterPending` + `resyncMapLayers`.
5. Passare `mapOverlay` a `MainContent`.

### Leaf area restore

```ts
// useTerritoryMapBridge.ts → geoinsightLeafStorage.ts
storeLeafAreaForRestore(areaId, feature)
getStoredLeafArea(areaId)
clearStoredLeafArea()
```

Opzionali su `MapBridge`; usati da navigazione e toggle asset verdi.

### handleMapReady

Delegato a `useTerritoryMapResync`: debounce 80 ms, poi `nav.resyncMapLayers()` + secondo `flushAdapterPending`.

---

## MainContent

Slot mappa: prop `mapOverlay` (ReactNode posizionato sopra/sotto layout DXC).

Props territorio rilevanti:

| Prop | Fonte |
|------|-------|
| `level`, `breadcrumb` | `nav` |
| `onLoadRegions` | `nav.loadRegions` |
| `onNavigateTo` | `nav.navigateTo` |
| `mapOverlay` | `GeoinsightFocusContainer` + container |

---

## GeoinsightFocusContainer

| Comportamento | Dettaglio |
|---------------|-----------|
| Layout | `position: absolute; inset: 0` fill parent |
| Z-index normale | `700` |
| Z-index focus | `1035` + overlay `#000000b3` |
| Trigger focus | `useGeoinsightStore.setMapFocus(true)` |

Imposta anche `map-widget.style.zIndex` per allineamento con shell cu1.5.

---

## GeoinsightMapContainer

Wrapper sottile: non contiene logica territorio.

| Prop | Collegamento widget |
|------|---------------------|
| `onFeatureInfo` | `map.handleFeatureInfo` |
| `onReady` | `handleMapReady` |

---

## Layer asset verdi (`useGreenAssetsLayer` + `GreenAssetsLayerToggle`)

Logica: `src/features/territory/model/hooks/useGreenAssetsLayer.ts` (ex GreenPalette).
Toggle UI: `src/widgets/layout/info-panel/GreenAssetsLayerToggle.tsx`.

### Disponibilità

Il toggle è attivo solo quando il breadcrumb fornisce un contesto verde (`getGreenContext`): richiede `provinceId` e `municipalityId` (crumb `green_areas` o `sub_areas`).

### Opzioni ricevute dal widget (hook)

| Opzione | Uso |
|---------|-----|
| `loadGreenLayerViewport` | Attiva modalità viewport server (asset + aree per bbox+zoom) |
| `setGreenLayerVisible` | Toggle visibilità |
| `clearGreenLayer` | Reset layer |
| `restoreGreenAreas` | Torna a poligoni aree verdi |
| `fitToGreenExtent` | Fit dopo cambio contesto |
| `setTerritoryFillVisible` | Nasconde grigio |
| `onBeforeLoadingAssets` | Salva leaf area se singola feature |
| `assetsLayerActive` / `onAssetsLayerActiveChange` | Stato toggle UI |

### Flusso attivazione asset

1. Utente attiva il toggle asset verdi.
2. `onBeforeLoadingAssets()` — se una sola area verde, salva in `storedLeafRef`.
3. `loadGreenLayerViewport(fetcher, areasFetcher)` con scope amministrativo completo (`regionId`, `provinceId`, `municipalityId`, `subMunicipalAreaId`, `greenAreaId`): ogni richiesta resta circoscritta all'area selezionata.
4. L'adapter fetcha per bbox+zoom + range date (`territoryApi.getGreenAssetsViewport` / `getGreenAreasViewport`) a ogni pan/zoom assestato: cluster **gold lakehouse** fino all'ultimo livello di zoom, asset raw all'ultimo.
5. `setTerritoryFillVisible(false)`.

### Disattivazione

- `restoreGreenAreas({ skipFit: true })` — ricarica i poligoni aree verdi mantenendo lo zoom utente.
- Oppure `clearGreenLayer()` + `setGreenLayerVisible(false)`.

Auto-off: se `level` esce da `green_areas` / `sub_areas` o il breadcrumb si accorcia, `turnOffGreenLayer()` via `useEffect`.

---

## restoreGreenAreas (widget)

Logica custom nel widget per breadcrumb back:

```ts
// Se LEVEL_GREEN_AREAS o LEVEL_SUB_AREAS
const geojson = await territoryApi.getGreenAreas({ /* da last crumb */ })
if (no features && leaf stored) map.loadGreenLayerFromFeature(stored)
else map.loadGreenLayer(geojson)
map.setGreenLayerVisible(true)
```

---

## Sidebar

Voce unica **「Mappa」** → route che monta `TerritoryMapWidget`.

---

## Store condivisi

| Store | Uso mappa |
|-------|-----------|
| `useGeoinsightStore` | ref, ready, zoom, crs, focus |
| `GreenTablePanelContext` | Accordion tabelle verde (non mappa pura) |

---

## Sequenza mount completa

```
1. main.tsx: initGeoinsightModule()
2. App render → TerritoryMapWidget mount
3. useGeoinsightMapBridge: crea adapter + registry
4. GeoinsightMapContainer mount → useRefGeoinsight
5. Bundle Geoinsight init → map-widget shadow DOM
6. Event 'ready':
   - store.isMapReady = true
   - dedupe panels, hide labels
   - flushAdapterPending()
   - loadRegions()
7. User click → handleFeatureInfo → handleFeatureSelect → loader
8. (Optional) toggle asset verdi → useGreenAssetsLayer → loadGreenLayerViewport
```

---

## Estendere l’UI

### Nuovo pannello sopra mappa

Wrappare in `GeoinsightFocusContainer` o sibling con z-index < 1035.

### Nuova azione breadcrumb

Usare `nav.navigateTo(index)` — non chiamare MapBridge direttamente salvo loader custom.

### Secondo widget mappa

**Sconsigliato:** un solo `map-widget` / WebGIS per app. Per seconda vista usare pattern cu1.5 multi-map con `mapId` diverso (non implementato in SIV).

Vedi: [Cookbook](./cookbook.md), [Navigazione](./api-navigazione-territorio.md).
