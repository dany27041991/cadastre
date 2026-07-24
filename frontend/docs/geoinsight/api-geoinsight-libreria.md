# API libreria @mase/commons-geoinsight

Reference dei metodi esposti dal **bundle Geoinsight** (componente React + ref imperativa). Include ciò che SIV usa oggi e ciò che il bundle supporta ma non è integrato nel Catasto arboreo.

---

## Componente React `<Geoinsight>`

### Props usate in SIV

| Prop | Tipo | Obbligatorio | Descrizione |
|------|------|--------------|-------------|
| `webgis_id` | `number` | sì | ID configurazione WebGIS (default `155`) |
| `cu_id` | `string` | sì | Codice CU (default `PNRR`) |
| `ref` | `RefObject<GeoinsightRef>` | sì | API imperativa mappa |
| `style` | `CSSProperties` | no | Dimensioni container |
| `onGetFeatureInfo` | `(event: unknown) => void` | sì* | Click su feature vettoriali / layer |
| `onPointerCoordsChange` | `(mapId, epsg, coords) => void` | no | Movimento puntatore |
| `onGenericEvent` | `{ events: string[], callbackFunction }` | sì* | Eventi lifecycle (`ready`, …) |

\*Richiesti per il funzionamento SIV.

### Props disponibili ma non usate in SIV

| Prop | Tipo | Descrizione |
|------|------|-------------|
| `onGeometryDrawn` | `(mapId, geomId, color, clip) => void` | Fine disegno geometria (draw tool) |
| `onDrawnGeometryInfo` | `(mapId, coordinates, features) => void` | Info su geometria disegnata |

---

## Hook `useRefGeoinsight(mode?)`

```ts
const { ref } = useRefGeoinsight()
// ref.current → GeoinsightRef dopo mount + ready
```

| Parametro | Descrizione |
|-----------|-------------|
| `mode` | Opzionale; pass-through al bundle (cu1.5 lo usa per varianti viewer) |

---

## Eventi

### Via `onGenericEvent`

| Evento | Quando | Payload |
|--------|--------|---------|
| `ready` | Mappa inizializzata, ref utilizzabile | `CustomEvent` |
| `onPointerCoordsChange` | Pan/zoom/coordinate | `detail[0].epsg`, coordinate |

### Callback dirette

| Callback | Quando |
|----------|--------|
| `onGetFeatureInfo` | Click su overlay vettoriale o layer interrogabile |
| `onPointerCoordsChange` | Stesso evento coordinate (forma alternativa) |

**SIV:** su `ready` eseguire setup (store, label off, dedupe, `onReady` app).

---

## `GeoinsightRef` — metodi usati in SIV

| Metodo | Firma | Descrizione |
|--------|-------|-------------|
| `getCenterAndScale` | `(mapId: number) => { epsg?, zoom?, level?, scale? }` | Stato vista corrente |
| `addGeometries` | `(mapId, geometries: WKT[]) => void` | Aggiunge overlay vettoriali |
| `removeGeometries` | `(mapId, geomIds: string[]) => void` | Rimuove per id |
| `zoomToBBOX` | `(mapId, { epsg, bbox: number[] }) => void` | Fit extent WGS84 |
| `setGeometryLabelVisibility` | `(mapId, visible: boolean) => void` | Toggle label geometrie |
| `deactivateDrawGeometry` | `(mapId) => void` | Disattiva modalità draw |

### Esempio diretto (bypass adapter — sconsigliato in app)

```ts
const mapId = geoinsightConfig.mapId
const ref = useGeoinsightStore.getState().geoinsightRef?.current

ref?.addGeometries?.(mapId, [{
  type: 'WKT',
  data: 'POINT(12.5 41.9)',
  geom_id: 'CUSTOM_1',
  epsg: 'EPSG:4326',
  hide_label: true,
}])

ref?.zoomToBBOX?.(mapId, {
  epsg: 'EPSG:4326',
  bbox: [12.4, 41.8, 12.6, 42.0],
})
```

Preferire sempre **MapBridge** per registry, coda pre-ready e consistenza click.

---

## `GeoinsightRef` — metodi bundle non usati in SIV

Esposti dal web component `map-widget` (da bundle 1.4+/1.5). Utili per integrazioni future:

| Metodo | Descrizione |
|--------|-------------|
| `addLayerByGuid` | Aggiunge layer catalogo per GUID |
| `removeLayerByGuid` | Rimuove layer per GUID |
| `setLayerVisibility` | Toggle visibilità layer TOC |
| `highlightGeometries` | Evidenzia geometrie esistenti |
| `applyLayerFilter` | Filtro su layer |
| `zoomToPoint` | Centra su punto |
| `activateDrawGeometry` | Attiva strumento disegno |
| `deleteAllDrawnGeometries` | Cancella disegni |
| `deleteDrawnGeometries` | Cancella disegni selezionati |
| `changeColorDrawnGeometries` | Cambia colore disegni |
| `changeMarkerDrawnGeometries` | Cambia marker disegni |
| `activateDrawnGeometryInfo` | Info su disegni |
| `deactivateDrawnGeometryInfo` | Disattiva info disegni |
| `setTime` | Layer temporali (time dimension) |
| `getMapStatus` | Stato viewer |
| `setMapVisible` / `setMapActive` / `setMapSynch` | Controllo multi-mappa |

Per usare questi metodi estendere l’interfaccia `GeoinsightRef` in `src/vendor/mase-commons-geoinsight.ts` e tipizzare le chiamate.

---

## Formato geometria WKT (`addGeometries`)

```ts
interface GeoinsightGeometryClip {
  type: 'WKT'
  data: string              // WKT da GeoJSON
  geom_id: string           // Univoco per mapId
  epsg: string              // 'EPSG:4326'
  color?: string | number[] // '#hex' o [r,g,b,a]
  label?: string
  geom_label?: string
  show_label?: boolean
  label_visibility?: boolean
  hide_label?: boolean
}
```

Conversione automatica: `geoJsonToGeoinsightGeometries()` in `@/features/territory/lib/geoJsonToGeoinsight`.

---

## `getCenterAndScale` — parsing zoom

```ts
import { parseZoomFromCenterScale } from '@/features/territory-map-geoinsight/model/parseMapZoom'

const raw = ref.getCenterAndScale?.(mapId)
const zoom = parseZoomFromCenterScale(raw)
// Priorità: zoom → level → derivato da scale
```

Usato per cluster asset verdi e sync `useGeoinsightStore.mapZoom`.

---

## Bootstrap modulo

| Funzione | Descrizione |
|----------|-------------|
| `initGeoinsightModule()` | Carica bundle AMD; Promise risolve quando pronto |
| `getGeoinsightModule()` | Sync; throw se non inizializzato |
| `Geoinsight` | Proxy React verso componente bundle |
| `useRefGeoinsight` | Re-export dopo init |

Standalone: chiamare **una volta** in `main.tsx` prima del render React.

---

## Web component interno `<map-widget>`

- Renderizzato dentro Shadow DOM.
- Selettore CSS per debug: `document.querySelector('map-widget').shadowRoot`.
- Pannello mappa: `.mw-maps-item` (dedupe se duplicati).
- Canvas OpenLayers dentro shadow root.

**Non modificare** il DOM interno salvo CSS documentati (`injectMapDrawHandleStyles`, dedupe).

---

## Endpoint REST Geoinsight (standalone)

Mappa completa in `geoinsightStandaloneEndpoints.ts`. Chiamate principali:

| Chiave endpoint | URL |
|-----------------|-----|
| TOC layers | `/core/api/geoinsight/v1/webgis/config/toc_layers` |
| Services/tools | `/core/api/geoinsight/v1/webgis/config/services` |
| Features | `/core/api/geoinsight/v1/features` |
| Feature info | `/core/api/geoinsight/v1/features/info` |

Parametri comuni query: `webgis_id`, `cu_id`.

Vedi [Riferimento](./riferimento.md) § Bootstrap per proxy e auth.

---

## Typings TypeScript

File: `src/types/mase-commons-geoinsight.d.ts` — subset minimo allineato cu1.5.

Per metodi aggiuntivi del bundle, estendere `GeoinsightRef` nel loader vendor e nel file `.d.ts`.

Vedi anche: [MapBridge](./api-map-bridge.md), [Contratto GeoJSON](./contratto-geojson.md).
