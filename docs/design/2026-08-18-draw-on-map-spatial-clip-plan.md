# Piano — Disegna su mappa (clip spaziale)

**Spec:** [2026-08-18-draw-on-map-spatial-clip-design.md](./2026-08-18-draw-on-map-spatial-clip-design.md)  
**Stato:** ready  

> **Addendum cutover:** clip in DuckDB su lakehouse; cluster = gold Parquet (non matview PG).

## 0. Vincoli

- Nessuna regressione su Area Italia: search, drill, toggle, viewport, filtri, detail. Senza `clip_wkt` il BE è identico.
- UI: ListItem Monitoraggio + Toggle/filtri esistenti; draw = API Geoinsight nativa.
- Un poligono; Layers solo dopo complete valido; search/drill assenti in `draw`.
- Click territorio disabilitato per tutto l’ingresso `draw` (anche toggle OFF).

---

## 1. BE — helper clip + viewport/table

**Modulo:** `territory/areas` e `territory/assets` (stesso strato repository già usato).

Helper condiviso (es. `territory/common` o funzione locale duplicata minima):

- Parse `clip_wkt`: `ST_GeomFromText(wkt, 4326)`, `ST_IsValid`, geometry type Polygon/MultiPolygon.
- Invalido → `HTTPException 400`.
- Condizione SQL: `func.ST_Intersects(model.geometry, clip_geom)`.

| Endpoint | Cambio |
|----------|--------|
| `GET .../green-areas/viewport` | Query opzionale `clip_wkt`; pass-through a `get_roots_in_bbox` (AND con envelope bbox). |
| `GET .../green-areas/table` | `clip_wkt` → `list_table_rows_paged` (AND; resta `parent_id IS NULL` se nessuno scope admin). |
| `GET .../green-assets/viewport` | `clip_wkt` → use case viewport. |
| `GET .../green-assets/table` | `clip_wkt` → `list_table_rows_paged`. |

**Asset cluster + clip:** gold Parquet + clip in DuckDB (centroid/extent). Count = totali precalcolati cella/unità. Raw/tabella = intersezione stretta sulla geometria.

Wire: ctrl → use case (`viewport_*`, `list_*_table_paged`) → repository. Nessun nuovo bounded context.

**Smoke (dopo restart BE):**

- Viewport/table **senza** `clip_wkt` = risposta attuale.
- Con `clip_wkt` di un poligono Lecce noto: `total` minore del nazionale; pan bbox fuori dal poligono → features vuote o comunque tutte intersecanti il clip.
- WKT `POINT(...)` o garbage → 400.

---

## 2. FE — API client

- [`greenAreaMap.api.ts`](../../frontend/src/features/territory/api/greenAreaMap.api.ts): `clipWkt?: string` su `GreenAreaViewportParams` (+ query string).
- [`greenAssetMap.api.ts`](../../frontend/src/features/territory/api/greenAssetMap.api.ts): stesso su viewport.
- [`greenTable.api.ts`](../../frontend/src/features/territory/api/greenTable.api.ts) / `greenTableParams.ts`: se clip, `p.set('clip_wkt', wkt)`.
- Helper `polygonToWkt` + cap vertici (256) in `features/territory/lib/` (puro, testabile).

---

## 3. FE — context scope

[`GreenTablePanelContext.tsx`](../../frontend/src/features/territory/context/GreenTablePanelContext.tsx):

- `entryMode: 'admin' | 'draw'`
- `spatialClip: GeoJSON Polygon | null`
- setter; `resetPanelState` azzera mode=`admin`, clip=`null`

Niente fork di `GreenContext`: admin resta vuoto; il clip è il recinto.

---

## 4. FE — MapBridge draw

- Tipizzare su [`mase-commons-geoinsight.ts`](../../frontend/src/vendor/mase-commons-geoinsight.ts): `activateDrawGeometry`, `deleteAllDrawnGeometries`, `deleteDrawnGeometries` (se serve).
- [`GeoinsightMapContainer.tsx`](../../frontend/src/features/territory-map-geoinsight/ui/GeoinsightMapContainer.tsx): prop `onGeometryDrawn` → `<Geoinsight onGeometryDrawn={...} />` (oggi documentata, non wired).
- Adapter/runtime: `activateDrawGeometry()`, `deactivateDrawGeometry()`, `clearDrawnGeometries()`.
- Widget: da `onGeometryDrawn` normalizzare a Polygon GeoJSON; se invalido toast e non cambiare step.

`setClickNavigationEnabled`: in `draw` sempre `false` (oltre al freeze già attivo con overlay verdi).

---

## 5. FE — wizard

[`InfoPanelContent.tsx`](../../frontend/src/widgets/layout/info-panel/InfoPanelContent.tsx):

- `draw-on-map` → `entryMode='draw'`, attiva draw, **non** `goToLayers`.
- Su clip salvato dal widget (callback context o stato clip) → `goToLayers`.
- `area-italia` durante draw: spegne draw, cancella geometrie, `entryMode='admin'`, poi Layers come oggi.
- `goToMonitoraggio`: oltre al reset attuale, `clearDrawnGeometries`.

[`LayersPanel.tsx`](../../frontend/src/widgets/layout/info-panel/LayersPanel.tsx): montare `TerritorySearchInput` solo se `entryMode === 'admin'`.

[`TerritoryMapWidget.tsx`](../../frontend/src/widgets/territory-map-widget/TerritoryMapWidget.tsx): registra draw handlers; su complete scrive `spatialClip` e notifica il wizard (stesso pattern `registerTerritorySearchNav`).

Zoom opzionale sul bbox del poligono dopo complete (fit), senza sostituire il clip.

---

## 6. FE — viewport e tabella seguono il clip

- [`useGreenAssetsLayer.ts`](../../frontend/src/features/territory/model/hooks/useGreenAssetsLayer.ts): i fetcher chiudono su `clipWkt` da context; la key di follow include fingerprint clip (altrimenti il viewport non riparte quando arriva il poligono).
- Tabella: `buildGreen*TableQuery` aggiunge `clip_wkt` se clip presente; **non** toccare il ramo `area_id` da search (in `draw` non c’è search).

i18n it/en: toast geometria invalida / draw fallito.

---

## 7. Verify (manuale)

1. Area Italia → search Puglia, toggle, filtri, detail: come prima; network senza `clip_wkt`.
2. Monitoraggio → Disegna → poligono → Layers **senza** search; toggle OFF di default.
3. Aree ON: poligoni verdi solo nel recinto; pan fuori → nessun “leak”.
4. Asset ON: cluster/raw solo nel recinto; stessa prova pan.
5. Avanti → filtri → Cerca: tabella `total` coerente col clip; filtri colonna ok.
6. Detail da tabella/mappa ok.
7. Indietro: Monitoraggio, overlay disegno sparito; nuovo Area Italia = nazionale.
8. Draw abort / poligono invalido: resto su Monitoraggio, toast.
9. Durante draw, click Area Italia: flusso Italia, niente clip.

---

## Ordine implementazione

1. BE `clip_wkt` (aree viewport+table, poi asset viewport+table + skip admin clusters) + smoke curl  
2. FE helper WKT + API query params  
3. Context `entryMode` / `spatialClip` + reset  
4. MapBridge + `onGeometryDrawn` + freeze click  
5. Wizard InfoPanel + Layers search condizionale  
6. `useGreenAssetsLayer` + `greenTableParams`  
7. i18n toast + checklist  

## Rollback

Rimuovere ramo `draw-on-map` dal wizard e i query param `clip_wkt`. Area Italia e repository senza clip restano il path di default. Overlay Geoinsight: `deleteAllDrawnGeometries` al reset.

## Rischi

| Rischio | Mitigazione |
|---------|-------------|
| Firma `onGeometryDrawn` bundle ≠ docs | Spike 30 min su payload reale prima di normalizzare WKT |
| Admin clusters ignorano il poligono | Matview con centroid/extent ∩ clip; count = totale precalcolato |
| URL GET troppo lunga | Cap 256 vertici FE; 400 se oltre |
| Remount StrictMode riattiva draw | Draw ON solo se `entryMode==='draw'` e `spatialClip==null` |
