# Contratto dati GeoJSON

Requisiti sulle **FeatureCollection** restituite da `/api/territory` e passate a MapBridge, affinché conversione WKT, click e navigazione funzionino correttamente.

> **Green viewport:** shape wire invariato (GeoJSON/`GC_*`/`GS_*`/`GA_*`). Fonte = lakehouse; le GET green richiedono `date_from`/`date_to`.

---

## Struttura minima

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "id": 12,
      "properties": {
        "id": 12,
        "name": "Lazio",
        "region_id": 12
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [[[...]]]
      }
    }
  ]
}
```

| Campo | Obbligatorio | Note |
|-------|--------------|------|
| `type` | sì | Deve essere `"FeatureCollection"` |
| `features` | sì | Array (può essere vuoto) |
| `features[].geometry` | sì | GeoJSON valido |
| `features[].id` o `properties.id` | sì* | ID numerico per navigazione |

\*Almeno uno dei due; usato da `resolveFeatureId()`.

---

## Identificazione feature

```ts
// src/features/territory/lib/featureIdentity.ts
resolveFeatureId(properties, explicitId?)
// Ordine: feature.id → properties.id → properties.ol_uid
```

| Requisito | Motivo |
|-----------|--------|
| ID numerico finito | Generazione `geom_id` (`T_12`, `GA_456`) |
| ID stabile tra fetch | Click e breadcrumb coerenti |
| Unicità per layer | Collisioni registry → click errato |

Se l’ID manca o non è numerico, la feature viene **silenziosamente ignorata** in conversione.

---

## Label breadcrumb

```ts
resolveFeatureLabel(properties, id, fallback?)
// Usa getFeatureLabel(properties, id)
```

Campi tipici in `properties`:

- `name`, `denominazione`, `label`
- Fallback: stringa `"#{id}"`

---

## Geometrie supportate

Conversione WKT via `terraformer-wkt-parser`:

| Tipo GeoJSON | Supportato |
|--------------|------------|
| `Point` | sì |
| `LineString` | sì |
| `Polygon` | sì |
| `MultiPoint` | sì |
| `MultiLineString` | sì |
| `MultiPolygon` | sì |
| `GeometryCollection` | no (skip) |

Geometria invalida o conversione fallita → feature esclusa.

---

## Coordinate e CRS

| Aspetto | Valore |
|---------|--------|
| CRS input atteso | WGS84 (`EPSG:4326`) |
| Campo adapter | `epsg: 'EPSG:4326'` su ogni clip WKT |
| Bbox | Calcolato da coordinate GeoJSON per fit |

Il backend territorio restituisce geometrie in WGS84. Non riproiettare lato frontend.

---

## Proprietà utili per navigazione

| Property | Livello | Uso |
|----------|---------|-----|
| `region_id` | comuni, sub-aree, verde | `getRegionIdFromMapFeature` per `loadSubAreas` |
| `province_id` | opzionale | Context API green |
| `municipality_id` | aree verdi | Query asset |
| `parent_id` | sub-aree | Gerarchia N-livelli |

Assenza di `region_id` su feature cliccata in `green_areas` può bloccare `loadSubAreas`.

---

## Prefissi `geom_id` generati

| Prefisso | Formula | Esempio |
|----------|---------|---------|
| Territorio | `T_{id}` | `T_12` |
| Area verde | `GA_{id}` | `GA_1001` |
| Asset verde | `GS_{id}` | `GS_5002` |
| Cluster | `GC_{zoomLevel}_{index}` | `GC_2_0` |

Il click restituisce uno di questi id in `onGetFeatureInfo` (path variabile; parser in `extractGeomIdFromFeatureInfo`).

---

## Collection vuota

```ts
// territory.api fetcher
EMPTY_GEOJSON = { type: 'FeatureCollection', features: [] }
```

Comportamento app:

| Scenario | Comportamento |
|----------|---------------|
| Sub-aree ISTAT assenti | Salto a `green_areas` |
| Sub-aree verdi assenti | `storeLeafAreaForRestore` + singola feature |
| Regioni con 0 feature | Mappa senza overlay (tile base ok) |

---

## Trasporto geobuf

Le API usano `?format=geobuf`. Decodifica in `createFetcher` → GeoJSON standard prima di MapBridge.

Il codice mappa **non** gestisce geobuf direttamente.

---

## Opzioni visualizzazione

Passate a `geoJsonToGeoinsightGeometries`, non nel GeoJSON:

| Opzione | Effetto |
|---------|---------|
| `color` | Colore stroke/fill |
| `showBoundaries: false` | Stroke `[0,0,0,0]` — area cliccabile, bordo invisibile |
| `epsg` | Default `EPSG:4326` |

---

## Checklist validazione GeoJSON

Prima di passare dati custom a MapBridge:

- [ ] `type === 'FeatureCollection'`
- [ ] Ogni feature ha `geometry` valida
- [ ] Ogni feature ha `id` numerico (top-level o `properties.id`)
- [ ] Coordinate lon/lat WGS84
- [ ] Label in `properties` per breadcrumb leggibile
- [ ] `region_id` presente dove serve drill-down verde

---

## Esempio feature minima cliccabile

```ts
const geojson: GeoJSONFeatureCollection = {
  type: 'FeatureCollection',
  features: [{
    type: 'Feature',
    id: 42,
    properties: { id: 42, name: 'Roma', region_id: 12 },
    geometry: {
      type: 'Polygon',
      coordinates: [[[12.4, 41.8], [12.6, 41.8], [12.6, 42.0], [12.4, 42.0], [12.4, 41.8]]],
    },
  }],
}

map.loadGeoJson(geojson)
map.fitToCurrentExtent()
```

Vedi anche: [Geometry Registry](./geometry-registry.md), [MapBridge API](./api-map-bridge.md).
