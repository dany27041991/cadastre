# Geoinsight — riferimento utilizzo

Documentazione di riferimento per sviluppatori che integrano o estendono la mappa territoriale nel frontend SIV.

> **Documentazione estesa:** per API complete, cookbook e contratti dati vedi l’[indice](./README.md).

---

## 1. Panoramica

### 1.1 Libreria

| Elemento | Valore |
|----------|--------|
| Pacchetto npm | `@mase/commons-geoinsight` (^1.4.0 nel progetto; parità cu1.5 su 1.5.x) |
| Formato distribuzione | Bundle AMD (`dist/mase-commons-geoinsight.js`, ~6.5 MB) |
| Web component interno | `<map-widget>` (Shadow DOM, OpenLayers) |
| Componente React esposto | `<Geoinsight>` + hook `useRefGeoinsight()` |

Geoinsight gestisce:

- tile di base e layer configurati lato WebGIS (TOC);
- overlay vettoriali aggiunti runtime via `addGeometries`;
- click su feature (`onGetFeatureInfo`);
- zoom/pan, CRS, eventi generici (`ready`, `onPointerCoordsChange`).

Il frontend SIV **non** usa le API di disegno geometrie (draw) di cu1.5 HEC-RAS.

### 1.2 Configurazione WebGIS

Definita in `src/app/config/geoinsight.ts` (default in `geoinsightConstants.ts`):

```ts
webgisId: 155      // VITE_GEOINSIGHT_WEBGIS_ID
cuId: 'PNRR'       // VITE_GEOINSIGHT_CU_ID
mapId: 1           // VITE_GEOINSIGHT_MAP_ID
```

Override via variabili `VITE_GEOINSIGHT_*` finché non esiste un WebGIS dedicato SIV.

### 1.3 Due runtime

| Runtime | Entry | Bootstrap Geoinsight | Import `@mase/commons-geoinsight` |
|---------|-------|----------------------|-----------------------------------|
| **Standalone Vite** | `src/main.tsx` | `initGeoinsightModule()` + loader AMD custom | Alias → `src/vendor/mase-commons-geoinsight.ts` |
| **Shell Single-SPA** | `src/mase-siv.tsx` | Import map shell (bundle reale) | Pacchetto npm esternalizzato |

Il componente condiviso è **`GeoinsightMapContainer`**, allineato al contratto di `cu1.5-fe/src/components/map/Map.tsx`.

---

## 2. Architettura applicativa

```
┌─────────────────────────────────────────────────────────────────┐
│  TerritoryMapWidget                                              │
│  ├─ useGeoinsightMapBridge()  → MapBridge + handleFeatureInfo   │
│  ├─ useTerritoryNavigation()  → livelli, breadcrumb, API         │
│  └─ GeoinsightFocusContainer                                   │
│       └─ GeoinsightMapContainer  → <Geoinsight ref={...} />     │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  GeoinsightMapAdapter                                            │
│  ├─ GeometryRegistry (geom_id ↔ feature metadata)               │
│  ├─ geoJsonToGeoinsightGeometries (GeoJSON → WKT)               │
│  └─ greenClusterPipeline (cluster asset verdi)                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  @mase/commons-geoinsight (AMD)                                  │
│  └─ <map-widget> shadow DOM → OpenLayers canvas                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Backend MASE (proxy in dev)                                     │
│  /core/api/geoinsight/v1/...  (toc_layers, services, features) │
└─────────────────────────────────────────────────────────────────┘
```

### 2.1 Store condiviso

`useGeoinsightStore` (Zustand) tiene:

| Campo | Uso |
|-------|-----|
| `geoinsightRef` | Ref imperativa verso API mappa |
| `isMapReady` | Gate per operazioni vettoriali |
| `crs` | EPSG corrente (es. `EPSG:3857`) |
| `mapZoom` | Zoom numerico per cluster asset verdi |
| `mapFocus` | Modalità focus (z-index elevato) |

### 2.2 Prefissi `geom_id`

Ogni geometria vettoriale ha un id univoco usato da Geoinsight e dal registry interno:

| Prefisso | Layer | Esempio |
|----------|-------|---------|
| `T_` | Territorio amministrativo / aree verdi outline | `T_12` |
| `GA_` | Area verde (poligono singolo) | `GA_456` |
| `GS_` | Asset verde (punto/poligono) | `GS_789` |
| `GC_` | Cluster di asset | `GC_2_0` |

Al click, `extractGeomIdFromFeatureInfo` risolve l’id e `GeometryRegistry` restituisce metadati per la navigazione.

---

## 3. Bootstrap standalone (Vite)

### 3.1 Sequenza di avvio

1. `initMockAuth()` — popola `sessionStorage.fgp` e cookie mock.
2. `initGeoinsightModule()`:
   - carica `/portalediaccesso/env.json` (o fallback locale);
   - installa `window.define` AMD con stub `@mase/commons-*`;
   - carica script `/vendor/mase-commons-geoinsight.js` (raw, no transform Vite);
   - risolve export `{ Geoinsight, useRefGeoinsight }`.
3. React monta l’app anche se l’init Geoinsight fallisce (la mappa mostra l’errore inline; il resto dell’UI resta usabile).

**Regola:** non renderizzare `<Geoinsight>` prima di `await initGeoinsightModule()` riuscito; se l’init fallisce, evitare route/widget mappa o gestire l’errore nello store.

### 3.2 Plugin Vite `geoinsightRawBundlePlugin`

Il bundle AMD **non** può passare dal grafo ESM di Vite. Il plugin:

- serve il file raw su `/vendor/mase-commons-geoinsight.js` in dev;
- lo copia in `dist/` in build;
- preferisce `public/vendor/` se ≥ 6 MB, altrimenti `node_modules/@mase/commons-geoinsight/dist/`.

Se il bundle manca o è troncato (~4.2 MB), la mappa non si inizializza: rieseguire `npm install` con VPN/registry MASE.

### 3.3 Proxy dev

In `vite.config.ts`, queste path sono proxate verso `VITE_MASE_API_ORIGIN` (default `https://sim-dev.mase.gov.it`) con cookie e header `fgp`:

- `/core/api/geoinsight`
- `/core/api/integrationlogic`
- `/portalediaccesso/common-labels.json`
- `/portalediaccesso/commons/geoinsight`

`/portalediaccesso/env.json` is served from `public/portalediaccesso/env.json` (no VPN). Other Geoinsight GETs use an on-disk cache (`node_modules/.geoinsight-cache`) with a 5s proxy timeout when sim-dev is unreachable.

### 3.4 Stub AMD e endpoint

Il bundle Geoinsight dipende da moduli AMD `@mase/commons-client`, `@mase/commons-utility`, `@mase/commons-event`. In standalone il loader fornisce stub che:

- **`GeoinsightClient`**: mappa completa degli endpoint REST (`geoinsightStandaloneEndpoints.ts`). **Importante:** `endpointStore.init()` sostituisce tutti i default del bundle; la mappa deve essere **completa**, non parziale.
- **`webgis` / `gisServices`**: fetch reali verso `toc_layers` e `services` con unwrap di `response.data`.
- **`CONFIG.GET_WEBGIS_CONFIG`**: URL bloccato (`__standalone_block_duplicate_config__`) per evitare doppia init config.

Autenticazione fetch Geoinsight: `credentials: 'include'` + header `fgp` da `sessionStorage`.

### 3.5 Guard anti-duplicazione mappe

React StrictMode può invocare `setWebgisConfigs` due volte. Il loader:

1. intercetta `customElements.define('map-widget')` e patcha `connectedCallback`;
2. wrappa `setWebgisConfigs` con `viewerStore.reset()` se `mapsStore` non è vuoto;
3. `injectMapDrawHandleStyles.ts` rimuove pannelli `.mw-maps-item` duplicati nel shadow DOM (`dedupeGeoinsightMapPanels` + `MutationObserver`).

---

## 4. Componente `GeoinsightMapContainer`

Percorso: `src/features/territory-map-geoinsight/ui/GeoinsightMapContainer.tsx`.

### 4.1 Props

| Prop | Tipo | Descrizione |
|------|------|-------------|
| `onFeatureInfo` | `(event: unknown) => void` | Callback click feature (delegata all’adapter) |
| `onReady` | `() => void` | Invocata all’evento `ready` Geoinsight |

### 4.2 Props passate a `<Geoinsight>`

```tsx
<Geoinsight
  webgis_id={geoinsightConfig.webgisId}
  cu_id={geoinsightConfig.cuId}
  ref={ref}
  style={mapStyle}
  onGetFeatureInfo={onFeatureInfo}
  onPointerCoordsChange={onPointerCoordsChange}
  onGenericEvent={{
    events: ['ready', 'onPointerCoordsChange'],
    callbackFunction: handleGenericEvent,
  }}
/>
```

### 4.3 Evento `ready` — azioni obbligatorie

All’evento `ready` il container:

1. aggiorna `useGeoinsightStore` (ref, CRS, zoom, `isMapReady=true`);
2. nasconde etichette geometrie: `setGeometryLabelVisibility(mapId, false)`;
3. inietta CSS draw handle nel shadow DOM;
4. deduplica pannelli mappa;
5. invoca `onReady` del widget (tipicamente `loadRegions()` + `flushAdapterPending()`).

### 4.4 Layout

- **Standalone:** `geoinsightMapStyle.ts` → posizione assoluta, fill container.
- **Shell:** altezza `calc(HEIGHT_BODY - 50px)` come cu1.5.
- **Focus:** `GeoinsightFocusContainer` gestisce z-index `700` / `1035` e overlay scuro.

---

## 5. API imperativa (`GeoinsightRef`)

Esposta via ref da `useRefGeoinsight()`:

| Metodo | Firma | Uso |
|--------|-------|-----|
| `getCenterAndScale` | `(mapId) => { epsg?, zoom?, level?, scale? }` | CRS e zoom corrente |
| `addGeometries` | `(mapId, geometries[]) => void` | Aggiunge overlay WKT |
| `removeGeometries` | `(mapId, geomIds[]) => void` | Rimuove per `geom_id` |
| `zoomToBBOX` | `(mapId, { epsg, bbox }) => void` | Fit extent `[minX, minY, maxX, maxY]` |
| `setGeometryLabelVisibility` | `(mapId, visible) => void` | Mostra/nasconde label `T_*` |
| `deactivateDrawGeometry` | `(mapId) => void` | Non usato in SIV |

Tutte le chiamate dell’adapter passano da **`runOrQueue`**: se la mappa non è ready, l’operazione viene accodata e eseguita su `flushPending()` dopo `ready`.

---

## 6. Formato geometrie (`addGeometries`)

Conversione in `src/features/territory/lib/geoJsonToGeoinsight.ts`.

### 6.1 Payload WKT

```ts
{
  type: 'WKT',
  data: 'POLYGON((...))',   // da GeoJSON via terraformer-wkt-parser
  geom_id: 'T_12',
  epsg: 'EPSG:4326',
  color?: string | [r, g, b, a],  // hex o RGBA array
  label: '',
  geom_label: '',
  show_label: false,
  label_visibility: false,
  hide_label: true,
}
```

### 6.2 Colori

| Costante | Valore | Uso |
|----------|--------|-----|
| `TERRITORY_GEOMETRY_FILL_COLOR` | `#6b7280` | Fill territorio |
| `GREEN_AREA_GEOMETRY_COLOR` | `#16a34a` | Aree gestite (invariato) |
| Asset styling | `greenAssetMapStyle.ts` | Cluster azzurri, punti pieni, linee tratteggiate, superfici scure |

### 6.3 `loadGeoJson`

```ts
map.loadGeoJson(geojson)
map.fitToCurrentExtent()
```

---

## 7. MapBridge — contratto adapter

L’interfaccia `MapBridge` (`src/features/territory/types/navigation.ts`) è l’API che **`useTerritoryNavigation`** usa per pilotare la mappa. Implementata da `GeoinsightMapAdapter.asMapBridge()`.

**Reference completa:** [API MapBridge](./api-map-bridge.md) (tutti i metodi, firme, coda operazioni).

### 7.1 Territorio

| Metodo | Comportamento |
|--------|---------------|
| `loadGeoJson(geojson)` | Sostituisce layer `T_*`, registra feature, `addGeometries` |
| `loadGeoJsonAndShowOnlyFeatureById(geojson, id)` | Singola feature + zoom su bbox |
| `showOnlyFeature(feature)` | Isola una feature territorio |
| `fitToCurrentExtent()` | Union bbox di tutte le `T_*` |
| `clearTerritoryLayer()` | Rimuove prefisso `T_*` |
| `setTerritoryFillVisible(visible)` | Toggle fill senza perdere cache geometrie |

### 7.2 Layer verde

| Metodo | Comportamento |
|--------|---------------|
| `loadGreenLayer(geojson, { skipFit? })` | Poligoni aree verdi (`GA_*`), senza clustering |
| `loadGreenLayerViewport(fetcher, areasFetcher?)` | Modalità viewport server per gli asset (bbox+zoom) |
| `loadGreenLayerFromFeature(feature)` | Singola area (leaf senza figli) |
| `setGreenLayerVisible(false)` | Rimuove geometrie verdi dalla mappa |
| `clearGreenLayer()` | Reset registry + cluster state |
| `fitToGreenExtent()` | Fit su bbox `GA_*` / `GS_*` / `GC_*` |
| `getGreenLayerFeatures()` | Feature correnti nel registry verde |

### 7.3 Cluster asset verdi (viewport server-side)

Con `loadGreenLayerViewport(fetcher, areasFetcher?)`:

1. l'adapter calcola bbox+zoom correnti e chiama il fetcher (`GET /green-assets/viewport` con **`date_from`/`date_to`**);
2. il backend (DuckDB su MinIO) decide cluster **gold** (admin/grid preaggregati) o asset raw all'ultimo livello di zoom;
3. la risposta viene montata con diff (aggiunge/rimuove solo geometrie cambiate, `GC_*` / `GS_*`);
4. ogni pan/zoom assestato (debounce interno) rifetcha il viewport;
5. click su cluster con `memberCount > 1` → `zoomToBbox` per drill incrementale.

Per aree verdi poligonali (navigazione breadcrumb) usare `loadGreenLayer` (nessun clustering).

### 7.4 Click feature

Flusso:

1. `<Geoinsight onGetFeatureInfo={...} />`
2. `GeoinsightMapAdapter.handleFeatureInfo(event)`
3. `extractGeomIdFromFeatureInfo` → lookup registry
4. Se cluster con `memberCount > 1` → zoom; altrimenti → `onFeatureSelectRef(id, label, feature)`
5. `useTerritoryNavigation.handleFeatureSelect` aggiorna livello e breadcrumb

---

## 8. Integrazione navigazione territorio

### 8.1 Widget principale

`TerritoryMapWidget` collega:

```tsx
const map = useGeoinsightMapBridge()
const nav = useTerritoryNavigation(mapBridge, { api: territoryApi, t })

// on ready:
handleMapReady = () => {
  map.flushAdapterPending()
  void nav.loadRegions()
}

// click:
map.setOnFeatureSelect(nav.handleFeatureSelect)
```

### 8.2 Livelli e API backend

| Livello | API | Comportamento mappa |
|---------|-----|---------------------|
| `regions` | `GET /api/territory/regions` | `loadGeoJson` + `fitToCurrentExtent` |
| `provinces` | `.../provinces?region_id=` | `loadGeoJson` + `fitToCurrentExtent` |
| `municipalities` | `.../municipalities?province_id=` | idem |
| `sub_municipal_areas` | `.../sub-municipal-areas?municipality_id=` | idem (+ filtro drill ISTAT) |
| `green_areas` | `.../green-areas?...` | `loadGreenLayer` (poligoni, no cluster) |
| `green_assets` | `.../green-assets/viewport?bbox=&zoom=&...` | `loadGreenLayerViewport` (cluster server / raw) |

GeoJSON arriva in **geobuf** decodificato da `territory.api.ts`; l’adapter non conosce il formato di trasporto.

### 8.3 Gerarchia breadcrumb → mappe

`useTerritoryNavigation` mantiene `level` e `breadcrumb[]`. Ogni transizione:

1. `clearGreenLayer()` / `clearTerritoryLayer()` se necessario;
2. fetch API con parametri dal crumb corrente;
3. chiamata MapBridge appropriata;
4. opzionale `setTerritoryFillVisible(false)` durante fit su verde (evita copertura grigia).

Per dettagli sulle query API territorio, vedere i controller in `cadastre/backend/src/territory/`.

---

## 9. Hook `useGeoinsightMapBridge`

Restituisce l’interfaccia `MapBridge` più:

| Campo | Uso |
|-------|-----|
| `handleFeatureInfo` | Passare a `GeoinsightMapContainer` |
| `flushAdapterPending` | Dopo `ready`, svuota coda operazioni |
| `setOnFeatureSelect` | Registra handler navigazione |

Effetti interni:

- `isMapReady` → `flushPending()`;
- `mapZoom` → `onMapZoomChange()` per cluster.

---

## 10. Estendere la mappa

### 10.1 Aggiungere un nuovo layer vettoriale

1. Definire un prefisso in `GEOM_PREFIX` (es. `CUSTOM_`).
2. Convertire GeoJSON con `geoJsonToGeoinsightGeometries(collection, prefix, { color })`.
3. Registrare ogni feature in `GeometryRegistry`.
4. Chiamare `ref.addGeometries(mapId, geometries)`.
5. Gestire click in `handleFeatureInfo` o handler dedicato.

### 10.2 Nuovo consumatore senza navigazione territorio

Minimo indispensabile:

```tsx
import { initGeoinsightModule } from '@/vendor/mase-commons-geoinsight'
import { GeoinsightMapContainer, useGeoinsightMapBridge } from '@/features/territory-map-geoinsight'

await initGeoinsightModule()

function MyMap() {
  const map = useGeoinsightMapBridge()
  return (
    <GeoinsightMapContainer
      onFeatureInfo={map.handleFeatureInfo}
      onReady={() => {
        map.flushAdapterPending()
        map.loadGeoJson(myGeoJson)
      }}
    />
  )
}
```

### 10.3 Cosa non fare

- Non importare `@mase/commons-geoinsight` direttamente dal pacchetto npm in standalone (rompe AMD).
- Non chiamare `addGeometries` prima di `ready` senza passare dall’adapter (usa la coda).
- Non sostituire parzialmente `STANDALONE_GEOINSIGHT_ENDPOINTS` (rompe altri tool Geoinsight).
- Non manipolare il canvas OpenLayers fuori dal shadow DOM se non per CSS dedupe documentati.

---

## 11. Variabili d’ambiente

| Variabile | Default | Descrizione |
|-----------|---------|-------------|
| `VITE_GEOINSIGHT_WEBGIS_ID` | `155` | ID WebGIS |
| `VITE_GEOINSIGHT_CU_ID` | `PNRR` | Codice CU |
| `VITE_GEOINSIGHT_MAP_ID` | `1` | Indice mappa nel viewer |
| `VITE_MASE_API_ORIGIN` | `https://sim-dev.mase.gov.it` | Target proxy Geoinsight |
| `VITE_MOCK_COOKIE` | — | Cookie sessione per dev standalone |
| `VITE_MOCK_FGP` | — | Header FGP per dev standalone |
| `VITE_STANDALONE` | `'true'` in vite.config | Layout mappa standalone |

Rinnovo credenziali mock:

```bash
python3 cadastre/infrastructure/scripts/fetch-mock-credentials.py
node cadastre/infrastructure/scripts/renew-mock-credentials.mjs --file /tmp/mase-creds.json
docker compose -f cadastre/infrastructure/compose/docker-compose.yml restart frontend
```

---

## 12. Troubleshooting

### Mappa bianca / nessun tile

| Causa probabile | Verifica |
|-----------------|----------|
| Credenziali scadute | Network: `toc_layers` e `services` → 401/403 |
| Bundle mancante | GET `/vendor/mase-commons-geoinsight.js` → 404 o size < 6 MB |
| Init prima del loader | Console: `Geoinsight not initialized` |
| Proxy non configurato | Request `/core/api/geoinsight/...` fallisce in dev |

### Due mappe affiancate

| Causa | Fix applicato |
|-------|---------------|
| Doppia init `setWebgisConfigs` | Patch `viewerStore.reset()` nel loader |
| Pannelli `.mw-maps-item` duplicati | `dedupeGeoinsightMapPanels()` + observer |

### Etichette `T_1`, `T_2` sui poligoni

Chiamare `setGeometryLabelVisibility(mapId, false)` su `ready` e dopo ogni `addGeometries` (già nell’adapter).

### Confini regionali ancora visibili

I layer TOC del WebGIS possono disegnare confini amministrativi indipendentemente dagli overlay `T_*` — richiede configurazione lato WebGIS o disabilitazione layer in TOC.

### Click non naviga

1. Verificare `geom_id` nel registry (`GeometryRegistry.getByGeomId`).
2. Controllare che GeoJSON abbia `id` o `properties.id` numerico.
3. Ispezionare payload `onGetFeatureInfo` con `extractGeomIdFromFeatureInfo`.

### Operazioni perse al caricamento

Chiamare `flushAdapterPending()` nell’handler `onReady` **dopo** che lo store ha `isMapReady=true`.

---

## 13. Checklist verifica manuale

- [ ] Una sola istanza `.mw-maps-item` nel shadow DOM di `map-widget`
- [ ] Canvas OpenLayers visibile, tile base caricati
- [ ] `GET .../toc_layers?webgis_id=155&cu_id=PNRR` → 200
- [ ] Vista regioni: poligoni cliccabili, senza label `T_*`
- [ ] Drill regione → provincia → comune → sub-area → aree verdi
- [ ] Layer asset verdi: cluster a zoom basso, dettaglio a zoom alto
- [ ] Breadcrumb sincronizzato con extent mappa

---

## 14. Riferimenti esterni

### Documentazione SIV (questa cartella)

| Doc | Contenuto |
|-----|-----------|
| [API MapBridge](./api-map-bridge.md) | Tutti i metodi bridge |
| [API navigazione](./api-navigazione-territorio.md) | Loader, breadcrumb, REST territorio |
| [API libreria](./api-geoinsight-libreria.md) | GeoinsightRef completa, props, eventi |
| [Contratto GeoJSON](./contratto-geojson.md) | Requisiti dati |
| [Geometry Registry](./geometry-registry.md) | geom_id e registry |
| [Cookbook](./cookbook.md) | Scenari d’uso |
| [Integrazione widget](./integrazione-widget.md) | TerritoryMapWidget, layer asset verdi |

### Esterni

- Implementazione parità: `cu1.5-fe/src/components/map/Map.tsx`
- Design decision: `cadastre/docs/design/2026-07-06-geoinsight-cu15-parity-design.md`
- Auth standalone: `docs/security/autenticazione-e-utenza-mock-standalone.md`
