# API navigazione territorio

Reference per **`useTerritoryNavigation`** e le **API backend** `/api/territory` che alimentano la mappa.

> **Green viz (post-cutover):** viewport/table/detail aree e asset → MinIO + DuckDB. Query params **`date_from` / `date_to` sempre obbligatori**.  
> Il livello UI `green_areas` / `sub_areas` è **navigazione/breadcrumb**, non tabella PostGIS. Search typeahead = solo admin (`public.*`).

---

## Hook `useTerritoryNavigation`

```ts
import { useTerritoryNavigation, territoryApi } from '@/features/territory'

const nav = useTerritoryNavigation(mapBridge, {
  api: territoryApi,
  t, // opzionale: i18n per label breadcrumb
})
```

### Stato restituito

| Campo | Tipo | Descrizione |
|-------|------|-------------|
| `level` | `TerritoryLevel` | Livello amministrativo corrente |
| `breadcrumb` | `BreadcrumbCrumb[]` | Stack navigazione |
| `loading` | `boolean` | Fetch in corso |

### Livelli (`TerritoryLevel`)

```
regions → provinces → municipalities → sub_municipal_areas → green_areas → sub_areas
```

| Livello | Significato |
|---------|-------------|
| `regions` | Panorama nazionale |
| `provinces` | Province di una regione |
| `municipalities` | Comuni di una provincia |
| `sub_municipal_areas` | Sub-aree ISTAT del comune |
| `green_areas` | Aree verdi del comune/sub-area |
| `sub_areas` | Sub-aree gerarchiche (parent/child) |

---

## Loader (caricamento esplicito)

### `loadRegions(): Promise<void>`

- Reset: `clearMapVectorLayers()` + breadcrumb vuoto.
- API: `GET /api/territory/regions?format=geobuf`
- Mappa: `loadGeoJson(geojson)` + `fitToCurrentExtent()`.

---

### `loadProvinces(regionId, label): Promise<void>`

- Reset vettori.
- Breadcrumb: `[{ level: 'provinces', id: regionId, label }]`
- API: `GET /api/territory/regions/{regionId}/provinces?format=geobuf`
- Mappa: `loadGeoJson` + fit.

---

### `loadMunicipalities(provinceId, label): Promise<void>`

- Append breadcrumb con suffisso provincia (i18n).
- API: `GET /api/territory/provinces/{provinceId}/municipalities?format=geobuf`
- Mappa: `loadGeoJson` + fit.

---

### `loadSubMunicipalAreas(regionId, municipalityId, label, clickedFeature?): Promise<void>`

- Se `clickedFeature` presente → `showOnlyFeature` immediato.
- API: `GET /api/territory/municipalities/{municipalityId}/sub-municipal-areas?format=geobuf`
- Filtro drill ISTAT livello 1 (`filterSubMunicipalByDrill`).
- Se **nessuna sub-area**: salto automatico a `green_areas` per il comune.
- On error: mantiene solo la feature evidenziata.

---

### `loadGreenAreas(regionId, municipalityId, subMunicipalAreaLabel, subMunicipalAreaId?, clickedFeature?): Promise<void>`

- `clearGreenLayer()` (non reset territorio completo).
- API: `GET /api/territory/green-areas?region_id=&province_id=&municipality_id=&sub_municipal_area_id=`
- Se feature cliccata → `showOnlyFeature` prima del fetch.
- Mappa: `showGreenLayer` → `loadGreenLayer(...)` (poligoni, no cluster), `setTerritoryFillVisible(false)`, fit verde.

---

### `loadSubAreas(areaId, regionId, label, clickedFeature?): Promise<void>`

- API: `GET /api/territory/green-areas?...&contained_in_area_id={areaId}`
- Se GeoJSON vuoto e feature cliccata → `storeLeafAreaForRestore` + `loadGreenLayerFromFeature`.
- Altrimenti: `showGreenLayer`.

---

## Azioni navigazione

### `handleFeatureSelect(id, label, feature?)`

Invocato dall’adapter al click su geometria registrata. In base a `level` corrente:

| `level` | Azione |
|---------|--------|
| `regions` | `loadProvinces(id, label)` |
| `provinces` | `loadMunicipalities(id, label)` |
| `municipalities` | `loadSubMunicipalAreas(regionId, id, label, feature, provinceId)` |
| `sub_municipal_areas` | `loadGreenAreas(regionId, municipalityId, label, subAreaId, feature)` |
| `green_areas` | `loadSubAreas(id, regionId, label, feature)` |
| `sub_areas` | `loadSubAreas(id, regionId, label, feature)` |

**Prerequisito:** `map.setOnFeatureSelect(nav.handleFeatureSelect)` registrato prima dei click.

---

### `navigateTo(index): Promise<void>`

Torna al crumb `breadcrumb[index]` ricaricando i dati.

| `index` | Comportamento |
|---------|---------------|
| `< 0` | Equivalente a `loadRegions()` |
| `0..n` | Tronca breadcrumb, fetch del livello target, aggiorna mappa |

Gestione speciale:

- `sub_municipal_areas` senza feature → evidenzia comune dal GeoJSON province.
- `green_areas` / `sub_areas` → `handleGreenLevelNavigation` (outline territorio + layer verde).

---

### `goBack(): void`

Shortcut: `navigateTo(breadcrumb.length - 2)`.

---

## Breadcrumb (`BreadcrumbCrumb`)

```ts
interface BreadcrumbCrumb {
  level: TerritoryLevel
  id: number
  label: string
  navigable?: boolean
  subMunicipalAreaId?: number
  regionId?: number
  provinceId?: number
  municipalityId?: number
  subMunicipalDrillLevel?: 1 | 2 | 3
  subMunicipalDrillStack?: number[]
}
```

| Campo | Quando |
|-------|--------|
| `id` | ID entità del livello (regione, provincia, comune, area verde, …) |
| `regionId` / `provinceId` | Contesto per API green-areas/assets |
| `subMunicipalAreaId` | Filtro spatial su aree verdi |
| `municipalityId` | Usato in `sub_areas` per expansion API |
| `navigable: false` | Crumb non cliccabile (salto automatico a green) |

---

## API backend territorio

Base URL: `API_URL` (config app). Formato risposta: **geobuf** decodificato in GeoJSON.

### Gerarchia amministrativa

| Metodo client | Endpoint | Parametri path/query |
|---------------|----------|----------------------|
| `getRegions()` | `GET /api/territory/regions?format=geobuf` | — |
| `getProvincesByRegion(regionId)` | `GET /api/territory/regions/{id}/provinces?format=geobuf` | |
| `getMunicipalitiesByProvince(provinceId)` | `GET /api/territory/provinces/{id}/municipalities?format=geobuf` | |
| `getSubMunicipalAreasByMunicipality(municipalityId)` | `GET /api/territory/municipalities/{id}/sub-municipal-areas?format=geobuf` | |

### Aree verdi

`GET /api/territory/green-areas?format=geobuf`

| Query param | Obbligatorio | Descrizione |
|-------------|--------------|-------------|
| `region_id` | sì | ID regione |
| `province_id` | sì | ID provincia |
| `municipality_id` | no | Comune |
| `sub_municipal_area_id` | no | Filtro sub-area ISTAT |
| `parent_id` | no | Figli diretti di un’area verde |
| `contained_in_area_id` | no | Aree contenute/intersecanti un’area parent |

Helper: `buildGreenAreasQuery(params)` in `greenAreaMap.api.ts`.

### Asset verdi

`GET /api/territory/green-assets?format=geobuf`

| Query param | Obbligatorio | Descrizione |
|-------------|--------------|-------------|
| `region_id` | sì | |
| `province_id` | sì | |
| `municipality_id` | sì | |
| `green_area_id` | no | Scope singola area |
| `sub_municipal_area_id` | no | Filtro spatial |

Helper: `buildGreenAssetQuery(params)` in `greenAssetMap.api.ts`.

**Nota:** risposta vuota → `EMPTY_GEOJSON` (FeatureCollection senza features), non errore.

---

## Diagramma flusso click

```mermaid
flowchart TD
  click[Click su poligono T_ / GA_ / GS_]
  click --> parse[extractGeomIdFromFeatureInfo]
  parse --> registry[GeometryRegistry lookup]
  registry --> cluster{Cluster multiplo?}
  cluster -->|sì| zoom[zoomToBbox cluster]
  cluster -->|no| select[onFeatureSelect id label feature]
  select --> level{level corrente}
  level -->|regions| prov[loadProvinces]
  level -->|provinces| mun[loadMunicipalities]
  level -->|municipalities| sub[loadSubMunicipalAreas]
  level -->|sub_municipal_areas| green[loadGreenAreas]
  level -->|green_areas| suba[loadSubAreas]
  level -->|sub_areas| suba
  prov --> api[Fetch /api/territory]
  mun --> api
  sub --> api
  green --> api
  suba --> api
  api --> bridge[MapBridge loadGeoJson / loadGreenLayer]
```

---

## Integrazione con il layer asset verdi (`useGreenAssetsLayer`)

A partire da `green_areas` / `sub_areas`, il toggle asset verdi (`GreenAssetsLayerToggle` + hook `useGreenAssetsLayer`):

1. Deriva lo scope amministrativo dal breadcrumb (`getGreenContext`).
2. Chiama `loadGreenLayerViewport(fetcher, areasFetcher)`: l'adapter fetcha per bbox+zoom + **`date_from`/`date_to`** (`territoryApi.getGreenAssetsViewport` / `getGreenAreasViewport`) a ogni pan/zoom assestato; cluster **gold lakehouse** ai livelli bassi, asset raw all'ultimo zoom.
3. `setTerritoryFillVisible(false)`.

Disattivazione: `restoreGreenAreas({ skipFit: true })` (mantiene lo zoom utente) o `clearGreenLayer()`.

Vedi [Integrazione widget](./integrazione-widget.md).

---

## Esempio completo

```tsx
function MapPage() {
  const map = useGeoinsightMapBridge()
  const mapBridge = useMemo(() => ({
    loadGeoJson: map.loadGeoJson,
    // ... tutti i metodi MapBridge
  }), [map])

  const nav = useTerritoryNavigation(mapBridge, { api: territoryApi, t })

  useEffect(() => {
    map.setOnFeatureSelect(nav.handleFeatureSelect)
  }, [map.setOnFeatureSelect, nav.handleFeatureSelect])

  return (
    <>
      <Breadcrumb
        items={nav.breadcrumb}
        onNavigate={nav.navigateTo}
        onBack={nav.goBack}
      />
      {nav.loading && <Spinner />}
      <GeoinsightMapContainer
        onFeatureInfo={map.handleFeatureInfo}
        onReady={() => {
          map.flushAdapterPending()
          void nav.loadRegions()
        }}
      />
    </>
  )
}
```

Vedi anche: [MapBridge API](./api-map-bridge.md), [Contratto GeoJSON](./contratto-geojson.md), [Cookbook](./cookbook.md).
