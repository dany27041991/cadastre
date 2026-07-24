# Spike plan — Migrazione mappa a Geoinsight (obbligatorio)

**Progetto:** Catasto arboreo (SIV) — `cadastre/frontend`  
**Data:** 2026-07-06  
**Stato:** Da avviare  
**Vincolo architetturale:** **Geoinsight è obbligatorio** come unico motore mappa in produzione. OpenLayers (`ol`) va rimosso al termine della migrazione; non è ammesso un approccio ibrido permanente.

**Riferimento implementativo:** `cu1.5-fe-MVP3-local` — `@mase/commons-geoinsight`, componente `<Geoinsight>`, ref API su `map-widget`.

---

## 1. Obiettivo dello spike

Validare in 2–3 settimane che Geoinsight supporta **tutti i flussi critici** del catasto arboreo prima del refactor completo (~4–6 mesi). Lo spike non deve essere un prototipo buttato via: il codice prodotto resta la base del branch di migrazione.

### 1.1 Criteri di successo (go)

| # | Criterio | Soglia |
|---|----------|--------|
| G1 | `<Geoinsight>` montato in Single-SPA (`mase-siv`) con auth FGP | Widget visibile, nessun errore console |
| G2 | Drill-down admin: regione → provincia → comune | Click/select feature → navigazione breadcrumb |
| G3 | Caricamento green areas per comune | Rendering entro 3s su comune medio (seed) |
| G4 | Caricamento green assets (≥10k feature) | UI responsiva; nessun freeze >2s |
| G5 | Toggle layer aree/asset (`GreenPalette`) | Layer visibili/nascosti correttamente |
| G6 | Fit/zoom su extent selezionato | Equivalente UX a `fitToCurrentExtent` / `zoomToBBOX` |
| G7 | Pulizia layer/geometrie tra navigazioni | Nessun artefatto visivo residuo |
| G8 | Nessuna dipendenza runtime da `ol` nello spike branch | `package.json` senza `ol` nelle parti migrate |

### 1.2 Criteri di fallimento (no-go → escalation infrastruttura)

Se uno di questi fallisce, **non** si torna a OpenLayers: si apre ticket al team Geoinsight/WebGIS con requisiti espliciti.

| # | Blocker | Escalation |
|---|---------|------------|
| B1 | `addGeometries` non regge >50k feature | Richiedere layer WMS/WFS pubblicati o API batch |
| B2 | Nessun evento click identificabile su feature vector | Richiedere callback ufficiale equivalente a feature select |
| B3 | Clustering non disponibile e performance inaccettabile | Richiedere clustering server-side su WebGIS |
| B4 | `webgis_id` / `cu_id` SIV non disponibili | Blocco infra — spike in pausa |

---

## 2. Prerequisiti esterni (da risolvere prima dello sprint 0)

| ID | Prerequisito | Owner | Output atteso |
|----|--------------|-------|---------------|
| P1 | `webgis_id` dedicato SIV/Catasto | Team WebGIS | ID numerico + documentazione |
| P2 | `cu_id` (es. `"SIV"` o `"CATASTO"`) | Team WebGIS | Stringa registrata |
| P3 | Accesso Nexus a `@mase/commons-geoinsight` ^1.2.0 | DevOps / Infra | Package installabile in `cadastre/frontend` |
| P4 | `map-widget` web component nel shell Single-SPA MASE | Team portale | Widget caricato prima di `@mase/siv` |
| P5 | Documentazione API ref Geoinsight (oltre empirismo CU1.5) | Team Geoinsight | Elenco metodi: add/remove geometries, events, layer |
| P6 | Strategia dati green: **client WKT** vs **layer pubblicati** | Architettura MASE + SIV | Decisione scritta (vedi §4) |

**Branch spike:** `spike/geoinsight-migration` da `main`.

---

## 3. Architettura target

### 3.1 Principio: MapBridge engine-agnostic

Oggi `MapBridge` e `useTerritoryNavigation` dipendono da tipi OpenLayers (`ol/Feature`). La migrazione introduce un **adapter Geoinsight** che implementa la stessa interfaccia usando tipi dominio.

```
TerritoryMapWidget
  └── useTerritoryNavigation(mapBridge)
        └── mapBridge = useGeoinsightMapBridge()   ← nuovo (spike)
              └── GeoinsightMapAdapter
                    ├── @mase/commons-geoinsight ref
                    ├── geometryRegistry (geom_id → metadata)
                    └── eventBridge (click → handleFeatureSelect)
```

### 3.2 Tipi dominio (sostituiscono `ol/Feature`)

| File nuovo | Contenuto |
|------------|-----------|
| `frontend/src/features/territory/types/mapFeature.ts` | `TerritoryMapFeature { id, label, properties, geometryWkt?, bbox? }` |
| `frontend/src/features/territory/types/mapBridge.ts` | `MapBridge` riscritto con `TerritoryMapFeature` al posto di `Feature` |

### 3.3 Layer logici su Geoinsight

Geoinsight usa `mapId = 1` (come CU1.5). Ogni layer logico del catasto mappa a un **prefisso `geom_id`**:

| Layer logico | Prefisso geom_id | Esempio |
|--------------|------------------|---------|
| Territorio admin | `T_` | `T_region_12` |
| Green areas | `GA_` | `GA_1042` |
| Green assets | `GS_` | `GS_88301` |
| Cluster display | `GC_` | `GC_10_4821` (zoom_level + cell) |

**Pulizia:** prima di ogni navigazione, `removeGeometries(1, ids)` per prefisso corrente.

### 3.4 Conversione dati API → Geoinsight

Pipeline attuale: `fetchGeobufOrEmpty` → `GeoJSONFeatureCollection` → OL features.

Pipeline target:

```
fetchGeobufOrEmpty → GeoJSONFeatureCollection
  → geoJsonToGeoinsightGeometries(collection, prefix, epsg)
  → GeoinsightGeometry[]  { type: "WKT", data, geom_id, epsg, color? }
  → ref.addGeometries(1, geometries)
```

File nuovo: `frontend/src/features/territory/lib/geoJsonToGeoinsight.ts`

Dipendenza suggerita (allineata a CU1.5): `terraformer-wkt-parser` o equivalente per GeoJSON → WKT.

### 3.5 Clustering su Geoinsight (obbligatorio da risolvere nello spike)

OpenLayers oggi usa grid clustering custom (`greenAssetCluster.ts`, ~120 righe + cache zoom 10–13).

**Opzioni da validare nello spike (in ordine di preferenza):**

1. **Clustering server-side** — layer WebGIS con tile/cluster pre-calcolati (richiede P6 + team WebGIS).
2. **Clustering client pre-calcolato** — mantenere algoritmo in `greenAssetCluster.ts` ma output → geometrie `GC_*` via `addGeometries` (senza `ol`).
3. **Semplificazione per zoom** — generalizzazione WKT per livelli bassi (fallback se 1–2 non disponibili).

> **Nota:** l'algoritmo di clustering può restare in TypeScript puro; va **solo** rimosso il coupling con `ol/Feature`.

---

## 4. Decisione dati (da prendere in sprint 0)

| Strategia | Descrizione | Quando usarla |
|-----------|-------------|---------------|
| **D1 — Client geometries** | API cadastre resta com'è; frontend converte geobuf → WKT → `addGeometries` | Comuni piccoli/medi, spike iniziale |
| **D2 — Layer WebGIS pubblicati** | Backend/pubblica layer su WebGIS; frontend usa `addLayerByGuid` | Comuni grandi, milioni di asset |
| **D3 — Master Catalog admin** | Confini ISTAT via `admin-boundaries-geoinsight` (come CU1.5) | Solo se allineamento dati ISTAT con PostGIS cadastre |

**Spike scope:** implementare **D1** per tutti i layer; prototipare **D2** su un comune grande (Roma/Lecce seed) per misurare limiti.

---

## 5. Piano per fasi — file dettagliati

### Fase 0 — Setup (3–4 giorni)

| Azione | File | Dettaglio |
|--------|------|-----------|
| **ADD** | `frontend/.npmrc` | Registry Nexus (copia da CU1.5 / `docs/components/registry.md`) |
| **MOD** | `frontend/package.json` | `"@mase/commons-geoinsight": "^1.2.0"`, rimuovere `ol`, `geobuf`, `flatgeobuf` solo a fine migrazione; aggiungere `terraformer-wkt-parser` |
| **ADD** | `frontend/src/app/config/geoinsight.ts` | `WEBGIS_ID`, `CU_ID`, `MAP_ID = 1`, colori layer |
| **ADD** | `frontend/src/app/store/useGeoinsightStore.ts` | Zustand: `geoinsightRef`, `isMapReady`, `crs`, `setGeoinsightRef`, `setReady` (pattern CU1.5) |
| **ADD** | `frontend/src/features/territory-map-geoinsight/ui/GeoinsightMapContainer.tsx` | `<Geoinsight webgis_id cu_id ref onGenericEvent onGetFeatureInfo />` |
| **ADD** | `frontend/src/features/territory-map-geoinsight/ui/GeoinsightFocusContainer.tsx` | Equivalente `FocusContainerMap.tsx` CU1.5 (z-index, overlay focus) |
| **MOD** | `frontend/webpack.config.cjs` | Verificare che `@mase/commons-geoinsight` non sia externalizzato erroneamente |
| **MOD** | `frontend/src/vite-env.d.ts` | Env: `VITE_GEOINSIGHT_WEBGIS_ID`, `VITE_GEOINSIGHT_CU_ID` |
| **ADD** | `infrastructure/compose/.env.example` | Variabili Geoinsight |

**Deliverable F0:** mappa Geoinsight vuota visibile in `CadastreLayout` (feature flag `VITE_USE_GEOINSIGHT=true`).

---

### Fase 1 — Adapter e geometry registry (4–5 giorni)

| Azione | File | Dettaglio |
|--------|------|-----------|
| **ADD** | `frontend/src/features/territory-map-geoinsight/model/GeoinsightRef.ts` | Tipo ref (wrapper su API commons-geoinsight) |
| **ADD** | `frontend/src/features/territory-map-geoinsight/model/geometryRegistry.ts` | Map `geom_id → { id, label, level, layerKind }`; metodi add/remove by prefix |
| **ADD** | `frontend/src/features/territory/lib/geoJsonToGeoinsight.ts` | GeoJSON FC → `GeoinsightGeometry[]`; gestione Point/LineString/Polygon/Multi* |
| **ADD** | `frontend/src/features/territory/lib/wktFromGeoJson.ts` | Helper WKT (terraformer o `@turf/turf` se già in stack) |
| **ADD** | `frontend/src/features/territory-map-geoinsight/model/geoinsightMapAdapter.ts` | Implementa `MapBridge` via ref + registry |
| **ADD** | `frontend/src/features/territory-map-geoinsight/model/hooks/useGeoinsightMapBridge.ts` | Hook pubblico; sostituisce `useTerritoryMap` nel widget |
| **ADD** | `frontend/src/features/territory/types/mapFeature.ts` | Tipo dominio feature |
| **MOD** | `frontend/src/features/territory/types/navigation.ts` | `MapBridge` usa `TerritoryMapFeature`; rimuovere import `ol/Feature` |
| **MOD** | `frontend/src/features/territory/types/map.ts` | Allineare `FeatureSelectHandler` a `TerritoryMapFeature` |
| **ADD** | `frontend/src/features/territory-map-geoinsight/index.ts` | Barrel export |

**Metodi adapter (mapping da OpenLayers):**

| Metodo MapBridge attuale | Implementazione Geoinsight |
|--------------------------|----------------------------|
| `loadGeoJson` | convert + `addGeometries`; registry add all |
| `loadGeoJsonAndShowOnlyFeatureById` | filter one feature + `zoomToBBOX` |
| `showOnlyFeature` | clear prefix `T_` + add one geometry + zoom |
| `fitToCurrentExtent` | bbox union registry corrente → `zoomToBBOX` |
| `centerOnItaly` | center/scale default (da config o hardcoded come OL) |
| `loadGreenLayer` | prefix `GA_` o `GS_`; clustering pre-process |
| `clearGreenLayer` | `removeGeometries` ids prefix `GA_`, `GS_`, `GC_` |
| `clearTerritoryLayer` | remove prefix `T_` |
| `clearMapVectorLayers` | remove all managed ids |
| `fitToGreenExtent` | bbox green registry → `zoomToBBOX` |
| `setGreenLayerVisible` | `setGeometryVisibility` o remove/re-add (da verificare in spike) |
| `setTerritoryFillVisible` | color/opacity su geometries (da verificare API) |

**Deliverable F1:** unit test su `geoJsonToGeoinsight.ts` + test manuale load regioni.

---

### Fase 2 — Eventi e navigazione (4–5 giorni)

| Azione | File | Dettaglio |
|--------|------|-----------|
| **ADD** | `frontend/src/features/territory-map-geoinsight/model/eventBridge.ts` | `onGetFeatureInfo` / `onGenericEvent` → `{ id, label, feature }` |
| **MOD** | `frontend/src/features/territory/model/hooks/useTerritoryNavigation.ts` | Sostituire cast `Feature` con `TerritoryMapFeature`; `clickedFeature?: TerritoryMapFeature` |
| **MOD** | `frontend/src/widgets/territory-map-widget/TerritoryMapWidget.tsx` | `useGeoinsightMapBridge` al posto di `useTerritoryMap`; rimuovere `import 'ol/ol.css'` |
| **MOD** | `frontend/src/widgets/layout/main/MainContent.tsx` | Container mappa: `<GeoinsightMapContainer />` al posto di `<div ref={mapRef}>` |
| **MOD** | `frontend/src/app/CadastreLayout.tsx` | Composizione Geoinsight + widget |
| **ADD** | `frontend/src/features/territory-map-geoinsight/model/hooks/useGeoinsightReady.ts` | Attende evento `ready` prima di prima load |

**Eventi Geoinsight da registrare (da CU1.5 + spike):**

```ts
onGenericEvent={{
  events: ['ready', 'onPointerCoordsChange', 'onFeatureSelected' /* da verificare */],
  callbackFunction: handleGenericEvent,
}}
onGetFeatureInfo={handleFeatureInfo}
```

**Deliverable F2:** drill-down completo regione → comune funzionante su Geoinsight.

---

### Fase 3 — Green layer + clustering (5–7 giorni)

| Azione | File | Dettaglio |
|--------|------|-----------|
| **MOD** | `frontend/src/features/territory/lib/greenAssetCluster.ts` | Rimuovere dipendenza `ol/Feature`; usare `{ id, geometry, properties }` generico |
| **ADD** | `frontend/src/features/territory-map-geoinsight/model/greenClusterPipeline.ts` | Raw features → cluster cells → WKT punti `GC_*` |
| **MOD** | `frontend/src/features/territory/ui/green-palette/GreenPalette.tsx` | Nessun cambio API se MapBridge invariato |
| **MOD** | `frontend/src/features/territory/model/hooks/useTerritoryNavigation.ts` | `storeLeafAreaForRestore` con `TerritoryMapFeature` |

**Test performance (obbligatori):**

| Dataset | Path seed | Target |
|---------|-----------|--------|
| Comune medio | seed default | G3 |
| Comune grande | `run_boost_municipality.sh` Roma | G4 |
| Lecce real data | `run_populate_lecce.sh` | G4 + clustering |

**Deliverable F3:** green areas + assets con toggle palette su Geoinsight.

---

### Fase 4 — Cleanup OpenLayers (2–3 giorni, fine spike)

| Azione | File |
|--------|------|
| **DELETE** | `frontend/src/features/territory/model/hooks/useTerritoryMap.ts` |
| **DELETE** | `frontend/src/features/territory/model/setup/territoryMapSetup.ts` |
| **DELETE** | `frontend/src/features/territory/model/setup/greenLayerStyle.ts` |
| **DELETE** | `frontend/src/features/territory/model/utils/territoryMapUtils.ts` (spostare util non-OL in `lib/`) |
| **MOD** | `frontend/package.json` | Rimuovere `ol`, `@types/*` ol-related |
| **MOD** | `frontend/src/features/territory/index.ts` | Export `useGeoinsightMapBridge`; deprecare `useTerritoryMap` |
| **MOD** | `.cursor/rules/frontend-ui-components-only.mdc` | Rimuovere eccezione OpenLayers; aggiungere obbligo Geoinsight per mappa |
| **ADD** | `docs/design/adr-001-geoinsight-mandatory-map-engine.md` | ADR decisione finale |

---

## 6. Configurazione ambiente

### 6.1 Variabili frontend

```env
# Geoinsight (obbligatorie con migrazione attiva)
VITE_USE_GEOINSIGHT=true
VITE_GEOINSIGHT_WEBGIS_ID=<da team WebGIS>
VITE_GEOINSIGHT_CU_ID=SIV
VITE_GEOINSIGHT_MAP_ID=1

# Esistenti
VITE_API_URL=http://localhost:8000
```

### 6.2 Feature flag transitorio

Durante lo spike, **solo** per non bloccare `main`:

```ts
// frontend/src/app/config/env.ts
export const USE_GEOINSIGHT = import.meta.env.VITE_USE_GEOINSIGHT === 'true'
```

In `TerritoryMapWidget`:

```tsx
const mapBridge = USE_GEOINSIGHT ? useGeoinsightMapBridge({ t }) : useTerritoryMap({ t })
```

**Regola:** il flag va rimosso al merge della migrazione; Geoinsight diventa l'unico path.

---

## 7. Struttura cartelle target (FSD)

```
frontend/src/
├── features/
│   ├── territory/                    # invariato: api, navigation, ui, lib
│   │   ├── lib/
│   │   │   ├── geoJsonToGeoinsight.ts    # NEW
│   │   │   └── greenAssetCluster.ts      # MOD (no ol)
│   │   └── types/
│   │       └── mapFeature.ts             # NEW
│   └── territory-map-geoinsight/     # NEW feature
│       ├── index.ts
│       ├── model/
│       │   ├── geoinsightMapAdapter.ts
│       │   ├── geometryRegistry.ts
│       │   ├── eventBridge.ts
│       │   ├── greenClusterPipeline.ts
│       │   └── hooks/
│       │       ├── useGeoinsightMapBridge.ts
│       │       └── useGeoinsightReady.ts
│       └── ui/
│           ├── GeoinsightMapContainer.tsx
│           └── GeoinsightFocusContainer.tsx
├── app/
│   ├── config/geoinsight.ts          # NEW
│   └── store/useGeoinsightStore.ts   # NEW
└── widgets/
    └── territory-map-widget/         # MOD → usa Geoinsight
```

---

## 8. Piano test

### 8.1 Test automatici (spike)

| Test | File | Scope |
|------|------|-------|
| GeoJSON → WKT conversion | `geoJsonToGeoinsight.test.ts` | Point, Polygon, MultiPolygon, empty FC |
| Geometry registry | `geometryRegistry.test.ts` | add/remove by prefix, lookup by geom_id |
| Cluster pipeline (no ol) | `greenClusterPipeline.test.ts` | stesso output count per zoom level |
| MapBridge contract | `geoinsightMapAdapter.test.ts` | mock ref; verify add/remove sequence |

### 8.2 Test manuali E2E (checklist)

- [ ] Login mock / secu → mappa carica
- [ ] Click regione → province visibili, breadcrumb aggiornato
- [ ] Click provincia → comuni
- [ ] Click comune → sub-comunali o salto green areas
- [ ] Green palette: toggle aree verdi
- [ ] Green palette: toggle asset → tabella accordion
- [ ] Breadcrumb back → layer puliti
- [ ] Navigazione profonda sub-areas → leaf area restore
- [ ] Comune grande: nessun crash memoria

---

## 9. Timeline spike (15 giorni lavorativi)

| Giorni | Fase | Milestone |
|--------|------|-----------|
| 1–4 | F0 Setup | Geoinsight montato |
| 5–9 | F1 Adapter | Regioni caricate via adapter |
| 10–13 | F2 Navigation | Drill-down admin completo |
| 14–18 | F3 Green | Areas + assets + palette |
| 19–21 | F4 Cleanup + report | Go/no-go documentato |

**Output finale spike:** report in `docs/design/geoinsight-spike-report.md` con metriche (tempi load, count feature, eventi API scoperti).

---

## 10. Roadmap post-spike (migrazione completa)

Se spike **go**:

| Sprint | Scope | Durata |
|--------|-------|--------|
| S1 | Merge spike → `main`; rimuovere flag OL | 1 sett |
| S2 | D2 layer WebGIS per comuni grandi (con team infra) | 2–3 sett |
| S3 | D3 allineamento confini Master Catalog (opzionale) | 2 sett |
| S4 | Test E2E Playwright su flussi mappa | 2 sett |
| S5 | Hardening: errori Geoinsight, loading states, i18n | 1 sett |
| S6 | Rimozione codice OL morto + doc aggiornata | 1 sett |

**Totale post-spike:** ~8–10 settimane (dipende da D2).

---

## 11. Rischi e mitigazioni (vincolo Geoinsight obbligatorio)

| Rischio | Mitigazione |
|---------|-------------|
| Performance client WKT insufficiente | Sprint dedicato D2 con WebGIS; non revert OL |
| API ref incompleta | Wrapper `GeoinsightRef` centralizzato; un solo punto di patch |
| Shadow DOM fragile (pattern CU1.5) | Non replicare hack; richiedere API ufficiali in P5 |
| Shell non carica `map-widget` | Coordinamento team portale in P4 prima dello spike |
| Regressioni navigazione | MapBridge contract test; navigation hook invariato |
| Certificati SSL Geoinsight dev | Stesso pattern `MASE_SECU_SSL_VERIFY` backend |

---

## 12. Riferimenti codice CU1.5

| Concetto | File CU1.5 |
|----------|------------|
| Componente mappa | `src/components/map/Map.tsx` |
| Focus overlay | `src/components/map/FocusContainerMap.tsx` |
| Store ref | `src/zustand/useMapStore.ts` |
| addGeometries WKT | `src/pages/nuova-elaborazione/CercaAreaAmministrativa.tsx` (righe 141–156) |
| addLayerByGuid | `src/zustand/useMapStore.ts` (tryApplyPData) |
| Package | `package.json` → `@mase/commons-geoinsight` |

---

## 13. Prossimi passi immediati

1. Aprire ticket **P1–P6** al team WebGIS / portale MASE.
2. Creare branch `spike/geoinsight-migration`.
3. Implementare **Fase 0** (setup package + container vuoto).
4. Daily check criteri G1–G8.
5. A day 15: redigere `geoinsight-spike-report.md` e ADR.

---

*Documento vivo: aggiornare al completamento di ogni fase con esito test e API scoperte.*
