# API MapBridge e useGeoinsightMapBridge

Reference completa dell’interfaccia **`MapBridge`** — il contratto con cui il codice applicativo pilota la mappa senza accedere direttamente al ref Geoinsight.

Implementazione: `GeoinsightMapAdapter` (moduli in `model/adapter/`) → esposta via hook `useGeoinsightMapBridge()`.

Per la navigazione territorio, il widget usa `useTerritoryMapBridge(map)` che aggiunge leaf-area restore su `MapBridge`.

---

## Hook `useGeoinsightMapBridge`

```ts
import { useGeoinsightMapBridge } from '@/features/territory-map-geoinsight'

const map = useGeoinsightMapBridge()
```

### Valore restituito

| Campo | Tipo | Descrizione |
|-------|------|-------------|
| Tutti i metodi `MapBridge` | vedi sotto | Delegati all’adapter |
| `handleFeatureInfo` | `(event: unknown) => void` | Passare a `GeoinsightMapContainer.onFeatureInfo` |
| `handleDrawnGeometryInfo` | callback Geoinsight | Passare a `GeoinsightMapContainer.onDrawnGeometryInfo` |
| `flushAdapterPending` | `() => void` | Esegue operazioni accodate prima di `ready` |
| `setOnFeatureSelect` | `(handler: FeatureSelectHandler) => void` | Registra callback click navigazione |
| `syncDrillContext` | `(excludeAreaIds: number[]) => void` | Esclude aree già espanse dal hit-test drill |
| `getGreenLayerFeatures` | `() => TerritoryMapFeature[]` | Feature verdi correnti in registry |

### Effetti automatici

- Quando `useGeoinsightStore.isMapReady` diventa `true` → `flushPending()`.
- Quando `useGeoinsightStore.mapZoom` cambia → ricalcolo cluster asset verdi.

### Pattern di wiring

```tsx
const map = useGeoinsightMapBridge()
const mapBridge = useTerritoryMapBridge(map)
const nav = useTerritoryNavigation(mapBridge, { api: territoryApi, t })

useTerritoryMapFeatureSelect({ map, handleFeatureSelect: nav.handleFeatureSelect })

<GeoinsightMapContainer
  onFeatureInfo={map.handleFeatureInfo}
  onDrawnGeometryInfo={map.handleDrawnGeometryInfo}
  onReady={useTerritoryMapResync({ map, resyncMapLayers: nav.resyncMapLayers })}
/>
```

---

## MapBridge — territorio (`MapBridgeGeo`)

### `loadGeoJson(geojson)`

Carica o sostituisce il layer territorio (`T_*`).

| Parametro | Tipo | Descrizione |
|-----------|------|-------------|
| `geojson` | `GeoJSONFeatureCollection` | Feature da visualizzare |

**Effetti:** rimuove geometrie `T_*` precedenti, registra ogni feature in `GeometryRegistry`, chiama `addGeometries`, nasconde label.

```ts
map.loadGeoJson(regionsGeoJson)
map.fitToCurrentExtent()
map.loadGeoJson(provincesGeoJson)
```

---

### `loadGeoJsonAndShowOnlyFeatureById(geojson, featureId)`

Isola una singola feature dal collection e fa zoom sul suo bbox.

| Parametro | Tipo | Descrizione |
|-----------|------|-------------|
| `geojson` | `GeoJSONFeatureCollection` | Collection contenente la feature |
| `featureId` | `number` | `feature.id` o `properties.id` |

Se la feature non esiste: fallback a `loadGeoJson(geojson)` + `fitToCurrentExtent()`.

```ts
map.loadGeoJsonAndShowOnlyFeatureById(municipalitiesGeoJson, municipalityId)
```

---

### `fitToCurrentExtent()`

Zoom sull’unione dei bbox di tutte le geometrie `T_*` registrate. EPSG: `EPSG:4326`. Usato anche per la vista iniziale Italia (regioni).

---

## MapBridge — feature singola (`MapBridgeFeature`)

### `showOnlyFeature(feature)`

Rimuove tutte le `T_*`, carica solo la feature passata e fa zoom sul bbox.

| Parametro | Tipo | Descrizione |
|-----------|------|-------------|
| `feature` | `TerritoryMapFeature` | `{ id, label, properties, geometry }` |

Usato durante drill-down (es. evidenziare comune cliccato prima del fetch sub-aree).

---

## MapBridge — layer verde (`MapBridgeGreen`)

### `loadGreenLayer(geojson, options?)`

Carica poligoni di aree verdi (`GA_*`), senza clustering. Per gli asset verdi usare `loadGreenLayerViewport`.

| Parametro | Tipo | Default | Descrizione |
|-----------|------|---------|-------------|
| `geojson` | `GeoJSONFeatureCollection` | — | Poligoni aree verdi |
| `options.skipFit` | `boolean` | `false` | `true` → nessun fit-to-extent dopo il mount |

```ts
// Aree verdi poligonali (navigazione)
map.loadGreenLayer(areasGeoJson)
```

---

### `loadGreenLayerViewport(fetcher, areasFetcher?)`

Modalità viewport server-side (default per gli asset verdi): il layer è alimentato per bbox+zoom dal backend (`GET /green-assets/viewport`), che restituisce asset raw all'ultimo livello di zoom e cluster PostGIS (griglia o amministrativi pre-aggregati) agli altri livelli. Ogni pan/zoom assestato rifetcha tramite la pipeline di debounce standard; il client non detiene mai l'intero dataset (scala al territorio nazionale).

| Parametro | Tipo | Descrizione |
|-----------|------|-------------|
| `fetcher` | `(bbox, zoom) => Promise<GeoJSONFeatureCollection>` | Asset raw o cluster server per il viewport |
| `areasFetcher?` | `(bbox, zoom) => Promise<GeoJSONFeatureCollection>` | Poligoni aree verdi radice per il viewport (da zoom ≥ 12) |

---

### `loadGreenLayerFromFeature(feature)`

Shortcut per singola area verde (leaf senza figli). Equivalente a `loadGreenLayer` con una sola feature.

---

### `setGreenLayerVisible(visible)`

| `visible` | Comportamento |
|-----------|---------------|
| `true` | No-op (geometrie già aggiunte) |
| `false` | `removeGeometries` per tutti i prefissi `GA_*`, `GS_*`, `GC_*` |

---

### `clearGreenLayer()`

Reset completo layer verde: registry + stato cluster + `removeGeometries`.

---

### `clearTerritoryLayer()`

Rimuove solo prefisso `T_*` e cache territorio.

---

### `clearMapVectorLayers()`

Rimuove **tutte** le geometrie vettoriali (`T_*`, `GA_*`, `GS_*`, `GC_*`) e svuota il registry.

---

### `fitToGreenExtent()`

Zoom sull’unione bbox di `GA_*`, `GS_*`, `GC_*`.

---

### `setGreenLayerVisibleWhenMoveEnds()`

Nasconde temporaneamente il layer verde (`setGreenLayerVisible(false)`) durante animazioni fit. Usato in `showGreenLayer` della navigazione.

---

### `ensureGreenLayerVisibleAfterFit()`

Dopo ~480 ms ripristina il layer verde (e ricalcola cluster se attivo). Chiamato insieme al precedente in `showGreenLayer`.

---

### `setTerritoryFillVisible(visible)`

Toggle fill territorio senza perdere la cache interna `lastTerritoryGeometries`.

| `visible` | Comportamento |
|-----------|---------------|
| `true` | Re-aggiunge geometrie `T_*` dalla cache |
| `false` | Rimuove `T_*` dalla mappa (click non possibile finché non ripristinate) |

Usato quando si entra nel layer verde per evitare che il grigio copra il verde durante il fit.

---

### `storeLeafAreaForRestore?(areaId, feature)` / `getStoredLeafArea?` / `clearStoredLeafArea?`

Memorizzano una feature foglia (area senza sub-aree) per ripristino breadcrumb. Implementati in `useTerritoryMapBridge` via `geoinsightLeafStorage.ts`, non nell’adapter Geoinsight.

---

## Metodi extra sull’adapter (non in MapBridge)

Accessibili solo tramite `handleFeatureInfo` / hook, non sul bridge pubblico:

| Metodo | Uso |
|--------|-----|
| `handleFeatureInfo(event)` | Parser click → navigazione |
| `flushPending()` | Svuota coda pre-ready |
| `onMapZoomChange(zoom)` | Interno: cluster asset |
| `syncZoomFromMap()` | Aggiorna store zoom da ref |

---

## Coda operazioni (`runOrQueue`)

Tutte le chiamate che toccano il ref Geoinsight passano da una coda:

1. Se `isMapReady === true` e ref disponibile → esecuzione immediata.
2. Altrimenti → operazione push su `pending[]`.
3. Su `ready` + `flushAdapterPending()` → esecuzione FIFO di tutte le operazioni.

**Regola:** chiamare sempre `flushAdapterPending()` in `onReady` del container.

---

## Tabella riepilogo rapida

| Obiettivo | Metodo |
|----------|--------|
| Caricare regioni | `loadGeoJson(geo)` + `fitToCurrentExtent()` |
| Caricare province/comuni | `loadGeoJson(geo)` + `fitToCurrentExtent()` |
| Evidenziare una feature | `loadGeoJsonAndShowOnlyFeatureById` o `showOnlyFeature` |
| Aree verdi | `loadGreenLayer(geo)` |
| Asset verdi (viewport server) | `loadGreenLayerViewport(fetcher, areasFetcher)` |
| Singola area foglia | `loadGreenLayerFromFeature(feature)` |
| Reset totale vettori | `clearMapVectorLayers()` |
| Nascondere grigio su verde | `setTerritoryFillVisible(false)` |
| Click → navigazione | `setOnFeatureSelect(handler)` + `handleFeatureInfo` |

Vedi anche: [Cookbook](./cookbook.md), [Navigazione territorio](./api-navigazione-territorio.md).
