# Cookbook — scenari d’uso mappa

Ricette pratiche copy-paste per i casi più comuni. Presuppongono setup standard (`initGeoinsightModule`, `GeoinsightMapContainer`, `useGeoinsightMapBridge`).

---

## 1. Montare la mappa da zero

```tsx
// main.tsx
import { initGeoinsightModule } from '@/vendor/mase-commons-geoinsight'

initMockAuth()
await initGeoinsightModule()
// poi render React

// MyMapView.tsx
function MyMapView() {
  const map = useGeoinsightMapBridge()

  return (
    <GeoinsightFocusContainer>
      <GeoinsightMapContainer
        onFeatureInfo={map.handleFeatureInfo}
        onReady={() => {
          map.flushAdapterPending()
          void nav.loadRegions() // o map.loadGeoJson(custom)
        }}
      />
    </GeoinsightFocusContainer>
  )
}
```

---

## 2. Mostrare tutte le regioni (vista iniziale)

```ts
const geojson = await territoryApi.getRegions()

map.loadGeoJson(geojson)
map.fitToCurrentExtent()
```

---

## 3. Drill-down su click (navigazione completa)

```tsx
const map = useGeoinsightMapBridge()
const mapBridge = useTerritoryMapBridge(map)
const nav = useTerritoryNavigation(mapBridge, { api: territoryApi, t })

useTerritoryMapFeatureSelect({ map, handleFeatureSelect: nav.handleFeatureSelect })

// Avvio
onReady={useTerritoryMapResync({ map, resyncMapLayers: nav.resyncMapLayers })}
```

Click automatico: regione → provincia → comune → sub-area → aree verdi → sub-aree.

---

## 4. Tornare indietro col breadcrumb

```tsx
<Breadcrumb
  crumbs={nav.breadcrumb}
  onClick={(index) => nav.navigateTo(index)}
/>
<button onClick={() => nav.goBack()}>Indietro</button>
<button onClick={() => nav.loadRegions()}>Italia</button>
```

`navigateTo(-1)` equivale a `loadRegions()`.

---

## 5. Evidenziare una sola provincia/comune

```ts
// Da collection già caricata
map.loadGeoJsonAndShowOnlyFeatureById(provincesGeoJson, provinceId)

// Da feature già nota (es. click intermedio)
map.showOnlyFeature({
  id: municipalityId,
  label: 'Roma',
  properties: { id: municipalityId, name: 'Roma', region_id: 12 },
  geometry: { /* ... */ },
})
```

---

## 6. Caricare aree verdi poligonali

```ts
const areas = await territoryApi.getGreenAreas({
  regionId: 12,
  provinceId: 58,
  municipalityId: 58091,
})

map.clearGreenLayer()
map.loadGreenLayer(areas)
map.setTerritoryFillVisible(false)
map.fitToGreenExtent()
```

`loadGreenLayer` monta solo poligoni `GA_*`, senza clustering.

---

## 7. Caricare asset verdi (modalità viewport server)

Gli asset verdi non vengono più scaricati per intero: il layer è alimentato per bbox+zoom dal backend, che restituisce cluster PostGIS (griglia / amministrativi pre-aggregati) ai livelli bassi e asset raw all'ultimo livello di zoom.

```ts
const scope = { regionId: 12, provinceId: 58, municipalityId: 58091 }

map.loadGreenLayerViewport(
  (bbox, zoom) =>
    territoryApi.getGreenAssetsViewport({ bbox, zoom, greenAreaId: 1001, ...scope }),
  (bbox, zoom) => territoryApi.getGreenAreasViewport({ bbox, zoom, ...scope })
)
map.setGreenLayerVisible(true)
map.setTerritoryFillVisible(false)
```

L'adapter rifetcha automaticamente a ogni pan/zoom assestato (debounce interno); lo scope amministrativo passato al fetcher circoscrive sempre i dati all'area selezionata.

Soglie lato client (in `greenAssetClusterCore.ts`):

| Costante | Valore | Effetto |
|----------|--------|---------|
| `GREEN_CLUSTER_ZOOM_OVERVIEW` | 10 | Zoom default overview |
| `GREEN_CLUSTER_ZOOM_DETAIL` | 16 | Cap del livello cluster richiesto al server |

La scelta cluster/raw è decisa dal backend in base allo zoom richiesto.

---

## 8. Area foglia senza sub-aree (leaf)

Quando `getGreenAreas` con `contained_in_area_id` restituisce collection vuota:

```ts
// Durante navigazione (automatico in loadSubAreas)
map.storeLeafAreaForRestore?.(areaId, clickedFeature)
map.loadGreenLayerFromFeature(clickedFeature)

// Ripristino breadcrumb (TerritoryMapWidget.restoreGreenAreas)
const stored = map.getStoredLeafArea?.(areaId)
if (stored) map.loadGreenLayerFromFeature(stored)
```

---

## 9. Toggle layer asset verdi (icona albero)

Pattern `useGreenAssetsLayer` (hook in `features/territory`, toggle UI `GreenAssetsLayerToggle`):

```ts
// ON
const scope = { regionId, provinceId, municipalityId, subMunicipalAreaId }
map.loadGreenLayerViewport(
  (bbox, zoom) => territoryApi.getGreenAssetsViewport({ bbox, zoom, greenAreaId, ...scope }),
  (bbox, zoom) => territoryApi.getGreenAreasViewport({ bbox, zoom, ...scope })
)
map.setGreenLayerVisible(true)
map.setTerritoryFillVisible(false)

// OFF (mantiene lo zoom utente)
await restoreGreenAreas({ skipFit: true }) // ricarica poligoni aree verdi
```

---

## 10. Caricare GeoJSON custom (non territorio API)

```ts
const custom: GeoJSONFeatureCollection = {
  type: 'FeatureCollection',
  features: [{
    type: 'Feature',
    id: 1,
    properties: { id: 1, name: 'Zona custom' },
    geometry: { type: 'Polygon', coordinates: [/* ... */] },
  }],
}

map.loadGeoJson(custom)
map.fitToCurrentExtent()
```

Assicurarsi id numerici — vedi [Contratto GeoJSON](./contratto-geojson.md).

---

## 11. Pulizia layer

| Obiettivo | Chiamata |
|-----------|----------|
| Solo territorio | `map.clearTerritoryLayer()` |
| Solo verde | `map.clearGreenLayer()` |
| Tutti i vettori | `map.clearMapVectorLayers()` |
| Reset completo + navigazione | `nav.loadRegions()` |

Ordine consigliato prima di nuovo layer: clear del layer target, poi load.

---

## 12. Accedere al ref Geoinsight direttamente

Solo se MapBridge non basta:

```ts
import { useGeoinsightStore } from '@/app/store/useGeoinsightStore'
import { geoinsightConfig } from '@/app/config/geoinsight'

const ref = useGeoinsightStore.getState().geoinsightRef?.current
const mapId = geoinsightConfig.mapId

if (useGeoinsightStore.getState().isMapReady && ref) {
  const view = ref.getCenterAndScale?.(mapId)
  console.log('CRS:', view?.epsg, 'zoom:', view?.zoom)
}
```

---

## 13. Modalità focus mappa (z-index)

```ts
useGeoinsightStore.getState().setMapFocus(true)  // overlay scuro + z-index 1035
useGeoinsightStore.getState().setMapFocus(false) // normale z-index 700
```

Usato per pattern cu1.5 `FocusContainerMap`.

---

## 14. Debug problemi comuni

### Mappa non risponde ai click

```ts
// 1. Handler collegato?
map.setOnFeatureSelect(nav.handleFeatureSelect)

// 2. onFeatureInfo collegato al container?
<GeoinsightMapContainer onFeatureInfo={map.handleFeatureInfo} />

// 3. GeoJSON ha id numerico?
feature.id ?? feature.properties.id
```

### Operazioni non visibili al load

```ts
onReady={() => {
  map.flushAdapterPending() // PRIMA di loadGeoJson
  map.loadGeoJson(geojson)
}}
```

### Due mappe affiancate

Verificare una sola `.mw-maps-item` in shadow DOM; dedupe automatico su `ready`.

---

## 15. Test manuale rapido (5 min)

1. Apri app standalone con credenziali valide.
2. Network: `toc_layers` 200, tile visibili.
3. Click regione → province appaiono, breadcrumb aggiornato.
4. Arriva a aree verdi → poligoni verdi, grigio nascosto.
5. Attiva icona albero → cluster asset, zoom in → dettaglio singoli asset.
6. Breadcrumb indietro → stato coerente.

Checklist completa in [Riferimento §13](./riferimento.md).

---

## Matrice scenario → API

| Voglio… | API principale |
|---------|----------------|
| Vista Italia regioni | `nav.loadRegions()` |
| Caricare dati custom | `map.loadGeoJson` |
| Una feature isolata | `loadGeoJsonAndShowOnlyFeatureById` |
| Aree verdi | `loadGreenLayer(...)` |
| Alberi/asset | `loadGreenLayer(assets)` |
| Navigare col click | `setOnFeatureSelect` + `useTerritoryNavigation` |
| Tornare indietro | `nav.navigateTo(i)` / `nav.goBack()` |
| Reset totale | `nav.loadRegions()` |

Vedi anche: [MapBridge](./api-map-bridge.md), [Navigazione](./api-navigazione-territorio.md), [Integrazione widget](./integrazione-widget.md).
