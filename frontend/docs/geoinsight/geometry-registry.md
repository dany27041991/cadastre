# GeometryRegistry

Registry interno che associa ogni **`geom_id`** Geoinsight ai metadati territoriali necessari per click, fit e navigazione.

Percorso: `src/features/territory-map-geoinsight/model/geometryRegistry.ts`.

---

## Scopo

Geoinsight conosce solo `geom_id` + WKT. L’app deve risalire a:

- `id` numerico entità
- `label` per breadcrumb
- `layerKind` (territorio / verde / cluster)
- `bbox` per zoom
- `properties` e `geometry` originali

Il registry fa da ponte tra overlay mappa e dominio applicativo.

---

## Tipi

```ts
type GeometryLayerKind = 'territory' | 'green_area' | 'green_asset' | 'cluster'

interface GeometryRegistryEntry {
  id: number
  label: string
  geomId: string
  layerKind: GeometryLayerKind
  bbox: [number, number, number, number] | null
  properties: Record<string, unknown>
  geometry: object
  isCluster?: boolean
  memberCount?: number
}
```

---

## API pubblica

### `register(entry: GeometryRegistryEntry): void`

Inserisce o sovrascrive entry per `entry.geomId`.

### `getByGeomId(geomId: string): GeometryRegistryEntry | undefined`

Lookup al click (`handleFeatureInfo`).

### `getIdsByPrefix(prefix: string): string[]`

Elenco `geom_id` che iniziano con prefisso (`T_`, `GA_`, …).

### `removeByPrefix(prefix: string): string[]`

Rimuove entry per prefisso; **restituisce** gli id rimossi (per `removeGeometries`).

### `removeAll(): string[]`

Svuota registry; restituisce tutti gli id.

### `getTerritoryBboxes(): Array<[number, number, number, number] | null>`

Bbox di entry `layerKind === 'territory'` → `fitToCurrentExtent`.

### `getGreenBboxes(): Array<...>`

Bbox di `green_area`, `green_asset`, `cluster` → `fitToGreenExtent`.

### `toMapFeature(entry): TerritoryMapFeature`

Converte entry in `{ id, label, properties, geometry }`.

---

## Ciclo di vita

```
loadGeoJson / loadGreenLayer
    → removeByPrefix (layer precedente)
    → geoJsonToGeoinsightGeometries
    → register per ogni meta
    → addGeometries(ref)

click onGetFeatureInfo
    → extractGeomIdFromFeatureInfo
    → getByGeomId
    → toMapFeature → handleFeatureSelect

clear / navigate
    → removeByPrefix o removeAll
    → removeGeometries(ref, ids)
```

---

## Prefissi standard

Definiti in `constants.ts`:

```ts
GEOM_PREFIX = {
  territory: 'T_',
  greenArea: 'GA_',
  greenAsset: 'GS_',
  cluster: 'GC_',
}
```

**Regola:** non riusare lo stesso `geom_id` per entità diverse nello stesso `mapId`.

---

## Cluster

Entry cluster (`GC_*`):

| Campo | Valore |
|-------|--------|
| `isCluster` | `true` |
| `memberCount` | numero asset nel cluster |
| `id` | indice display (non id entità) |

Click su cluster con `memberCount > 1` → zoom, non navigazione.

---

## Estendere con nuovo layer

1. Aggiungere prefisso in `GEOM_PREFIX`.
2. In adapter custom: `register` con `layerKind` appropriato.
3. In `handleFeatureInfo`: branch per nuovo prefisso o layerKind.
4. Opzionale: metodi bbox dedicati se serve fit separato.

---

## Debug

In DevTools console (dopo click):

```js
// Non esportato — solo via breakpoint o log temporaneo in adapter
// Verificare che geom_id del click esista nel registry
```

Sintomi registry inconsistente:

| Sintomo | Causa probabile |
|---------|-----------------|
| Click ignorato | `geom_id` non registrato o già rimosso |
| Navigazione id sbagliato | ID duplicato in GeoJSON |
| Fit errato | bbox null (geometria puntiforme/degenerata) |

Vedi: [Contratto GeoJSON](./contratto-geojson.md), [MapBridge](./api-map-bridge.md).
