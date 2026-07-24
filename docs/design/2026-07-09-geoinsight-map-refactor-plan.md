# Refactor Plan: Geoinsight territory map

**Data:** 2026-07-09  
**Obiettivi:** (1) pulizia codice morto, (2) refactor leggibile con file piccoli, (3) zero regressione logica mappa.

---

## Current State

- **Integrazione:** `TerritoryMapWidget` → `useGeoinsightMapBridge` → `GeoinsightMapAdapter` (~585 righe) → `GeometryRegistry` + vendor `@mase/commons-geoinsight`.
- **Navigazione:** `useTerritoryNavigation` usa `MapBridge` engine-agnostic; widget ricostruisce un secondo `mapBridge` con leaf storage duplicato.
- **Debito:** API esposte ma inutilizzate, campi privati mai letti, duplicazione WKT/WebMercator/leaf, docs drift, 0 test automatici sullo stack Geoinsight.

## Target State

```
territory-map-geoinsight/
├── index.ts                         # API pubblica minima
├── lib/
│   ├── geometryToWkt.ts             # WKT condiviso
│   └── webMercatorConstants.ts      # scale base unica
├── model/
│   ├── geometryRegistry.ts
│   ├── eventBridge.ts
│   ├── greenClusterPipeline.ts
│   ├── mapZoomUtils.ts
│   ├── parseMapZoom.ts
│   ├── geoinsightConstants.ts       # spostato da constants.ts (no dip. invertita)
│   ├── adapter/
│   │   ├── geoinsightMapAdapter.ts       # facade ~120 righe
│   │   ├── geoinsightMapRuntime.ts       # queue, ref, add/remove geometries
│   │   ├── geoinsightTerritoryLayers.ts  # T_* load/fit/clear
│   │   ├── geoinsightGreenLayers.ts      # GA_*/GS_* load/visible/clear
│   │   ├── geoinsightGreenCluster.ts     # cluster cache + zoom
│   │   ├── geoinsightMapViewport.ts      # fit, zoom, bbox
│   │   ├── geoinsightMapSelection.ts     # click, drill context
│   │   └── geoinsightLeafStorage.ts      # unica sorgente leaf-area
│   └── hooks/
│       └── useGeoinsightMapBridge.ts
└── ui/                              # invariato (container, focus, styles, inject)

widgets/territory-map-widget/
├── TerritoryMapWidget.tsx           # orchestrazione UI ~150 righe
├── useTerritoryMapBridge.ts         # MapBridge per navigazione (leaf + adapter)
└── useTerritoryMapEffects.ts        # resync, syncDrillContext, table panel
```

**Budget righe:** nessun file > **250 righe** (adapter facade ~120).

**MapBridge:** solo metodi effettivamente usati da `useTerritoryNavigation` / `useGreenAssetsLayer`.

---

## Affected Files

| File | Change | Dipendenze |
|------|--------|------------|
| `geoinsightMapAdapter.ts` | Split → `adapter/*` | Tutti i consumer adapter |
| `useGeoinsightMapBridge.ts` | Slim + leaf storage esterno | Widget |
| `TerritoryMapWidget.tsx` | Estrarre hook, rimuovere doppio bridge | Nav, green assets |
| `navigation.ts` (MapBridge) | Rimuovere API morte | Nav, adapter |
| `map.ts` (UseTerritoryMapResult) | Allineare a MapBridge | Hook |
| `useGeoinsightStore.ts` | Rimuovere `isReady`, valutare `mapFocus` | Container, focus |
| `geoJsonToGeoinsight.ts` | Import da `geoinsightConstants` condiviso | Adapter |
| `greenClusterPipeline.ts` | Usare `geometryToWkt` condiviso | Adapter |
| `index.ts` (feature) | Export pubblici ridotti | App |
| `docs/geoinsight/*.md` | Sync con API reale | — |

---

## Execution Plan

### Phase 0 — Baseline (obbligatoria)

- [ ] **0.1** Eseguire smoke test manuale e annotare esito (checklist § Verification).
- [ ] **0.2** `npm run build` frontend → OK.
- [ ] **0.3** Tag/commit di lavoro corrente (branch dedicato consigliato: `refactor/geoinsight-map-cleanup`).

**Verify:** checklist completa prima di qualsiasi modifica.

---

### Phase 1 — Pruning sicuro (zero cambio comportamento)

Rimuove solo codice **provatamente morto**.

- [ ] **1.1** Eliminare export/funzioni non importate:
  - `buildRawGreenAssetLayerPayload`
  - `GeometryRegistry.registerBatch`
  - `TERRITORY_GEOMETRY_STROKE_WIDTH`, `TERRITORY_GEOMETRY_COLOR`
- [ ] **1.2** Rimuovere campi privati adapter mai letti: `showGreenOnMoveEnd`, `drawnGeometryInfoActive`.
- [ ] **1.3** Store: rimuovere `isReady` / `setReady` (mantenere solo `isMapReady`).
- [ ] **1.4** Hook: rimuovere `mapRef` sempre null da `UseGeoinsightMapBridgeResult`.
- [ ] **1.5** `GeoinsightMapContainer`: ridurre chiamate duplicate `activateDrawnGeometryInfo` (ready handler: 1 sola, adapter resta fonte su add).
- [ ] **1.6** Rinominare wrapper `getRegionIdFromOlFeature` → chiamata diretta `getRegionIdFromMapFeature` in navigazione.

**Verify:** build + smoke checklist §1.

---

### Phase 2 — Consolidamento bridge e leaf storage

- [ ] **2.1** Creare `geoinsightLeafStorage.ts` (createLeafStorage API).
- [ ] **2.2** Spostare `storedLeafRef` da widget → `useTerritoryMapBridge.ts`; collegare a `storeLeafAreaForRestore` / `getStoredLeafArea` / `clearStoredLeafArea`.
- [ ] **2.3** Rimuovere `storedLeaf` interno da adapter + metodi duplicati in `asMapBridge()`.
- [ ] **2.4** `useGeoinsightMapBridge` restituisce oggetto già compatibile `MapBridge`; widget passa quel bridge (via `useTerritoryMapBridge`) a `useTerritoryNavigation` **senza** secondo `useMemo` copy-paste.
- [ ] **2.5** Estrarre `useTerritoryMapEffects.ts`: `syncDrillContext`, `handleMapReady` + debounce resync, cleanup timer.

**Verify:** build + smoke checklist §2 (focus drill foglia + toggle alberi + breadcrumb back).

---

### Phase 3 — Split adapter (leggibilità)

Suddivisione per responsabilità; `GeoinsightMapAdapter` delega ai moduli.

| Modulo | Responsabilità |
|--------|----------------|
| `geoinsightMapRuntime.ts` | `runOrQueue`, `flushPending`, `getRef`, `addGeometries`, `removeGeomIds` |
| `geoinsightTerritoryLayers.ts` | `loadGeoJson`, `loadGeoJsonAndShowOnlyFeatureById`, `clearTerritoryLayer`, `setTerritoryFillVisible` |
| `geoinsightGreenLayers.ts` | `loadGreenLayer`, `loadGreenLayerFromFeature`, visibility, clear |
| `geoinsightGreenCluster.ts` | cluster cache, `onMapZoomChange`, `applyGreenAssetClusterDisplay` |
| `geoinsightMapViewport.ts` | `fitToCurrentExtent`, `fitToGreenExtent`, `zoomToBbox`, zoom helpers |
| `geoinsightMapSelection.ts` | `handleFeatureInfo`, `handleDrawnGeometryInfo`, `syncDrillContext`, `selectByGeomId` |

- [ ] **3.1** Estrarre moduli uno alla volta (ordine: runtime → viewport → territory → green → cluster → selection).
- [ ] **3.2** Adapter facade mantiene **stessa** firma pubblica `asMapBridge()` durante la migrazione.
- [ ] **3.3** Nessun cambiamento alle firme consumate da navigazione in questa fase.

**Verify:** build + smoke checklist completa dopo ogni sotto-step (3.1).

---

### Phase 4 — Shared lib e costanti

- [ ] **4.1** `lib/geometryToWkt.ts` — unificare duplicato in `geoJsonToGeoinsight` e `greenClusterPipeline`.
- [ ] **4.2** `lib/webMercatorConstants.ts` — usato da `parseMapZoom` e `mapZoomUtils`.
- [ ] **4.3** Rinominare/spostare `constants.ts` → `geoinsightConstants.ts`; aggiornare import (territory non importa da adapter).

**Verify:** build + smoke §3.

---

### Phase 5 — Pulizia API MapBridge (breaking types, non runtime)

Solo dopo Phase 2–4 stabilizzate.

- [ ] **5.1** Rimuovere da `MapBridge` / adapter / hook / widget:
  - `centerOnItaly` (mai chiamato; `fitToCurrentExtent` resta)
  - `purgeGreenAreaFromMap` (mai chiamato)
  - `TerritoryLoadGeoJsonOptions.showBoundaries` (ignorato)
- [ ] **5.2** Valutare `setMapFocus` / overlay focus: rimuovere store + `GeoinsightFocusContainer` overlay path **se** confermato non usato in prod; altrimenti lasciare invariato.
- [ ] **5.3** Ridurre export pubblici da `index.ts`: solo UI + hook (no `GeoinsightMapAdapter` / `GeometryRegistry` salvo test).

**Verify:** build + smoke completa + grep nessun riferimento ai simboli rimossi.

---

### Phase 6 — Documentazione e test di regressione

- [ ] **6.1** Aggiornare `docs/geoinsight/api-map-bridge.md`, `cookbook.md`, `riferimento.md` allineati all’API reale.
- [ ] **6.2** Test unitari (pure, no Geoinsight DOM):
  - `geometryRegistry.test.ts`
  - `eventBridge.test.ts` (pick drill, geom id)
  - `greenClusterPipeline.test.ts`
  - `geoinsightLeafStorage.test.ts`
- [ ] **6.3** (Opzionale) E2E Playwright smoke: load app → regioni visibili → 1 drill.

**Verify:** `npm test` (se configurato) + smoke manuale finale.

---

## Verification Checklist (no-regression)

Ripetere **dopo ogni fase**:

| # | Scenario | Atteso |
|---|----------|--------|
| 1 | Avvio app, vista Italia | 20 regioni, mappa non bianca |
| 2 | Drill regione → provincia → comune | Poligoni + fit |
| 3 | Comune con/senza sottoaree → aree verdi | Layer verde, breadcrumb corretto |
| 4 | Drill sotto-area ricorsiva | Solo figli visibili, no poligono padre cliccabile |
| 5 | Sotto-area foglia (0 figli) | Leaf restore al back breadcrumb |
| 6 | Toggle Aree Gestite ↔ Assets Verdi | Layer + tabella coerenti |
| 7 | Accordion tabella aree/assets | Visibile e popolata |
| 8 | Breadcrumb “Indietro” ogni livello | Layer resync corretto |
| 9 | Hard reload / re-init Geoinsight | `resyncMapLayers` ripristina poligoni |
| 10 | Proxy Geoinsight (toc_layers) | 200, no overlay errore init |

---

## Rollback Plan

1. Ogni fase = commit atomico su branch dedicato.
2. Se smoke fallisce: `git revert` ultimo commit della fase.
3. Phase 3 (split adapter): possibile rollback per modulo se ogni estrazione è un commit separato.
4. Non mescolare pruning (Phase 1) e split (Phase 3) nello stesso commit.

---

## Risks & Mitigations

| Rischio | Mitigazione |
|---------|-------------|
| Split adapter introduce bug sottile su pending queue | Estrarre `runtime` per primo; test flush dopo re-init |
| Rimozione API rompe codice esterno | Grep repo + export index ridotto solo in Phase 5 |
| Leaf storage spostato rompe drill foglia | Test manuale §5 + unit test leaf storage |
| Nessuna suite E2E oggi | Checklist manuale obbligatoria; Phase 6 aggiunge unit test puri |
| Docs obsolete dopo refactor | Phase 6 dedicata, non inline |

---

## Approaches Considered

| Approccio | Pro | Contro |
|-----------|-----|--------|
| **A — Solo pruning** | Sicuro, veloce | Non risolve file 585 righe |
| **B — Pruning + split adapter (scelto)** | Leggibile, moduli testabili | Più commit, serve disciplina smoke |
| **C — Rewrite adapter from scratch** | API pulita | Alto rischio regressione |

**Raccomandazione:** **B** in 6 fasi sequenziali con gate di verifica.

---

## Out of Scope

- Cambi comportamento mappa (stroke, drill rules, clustering thresholds).
- Sostituzione bundle `@mase/commons-geoinsight`.
- Refactor `useTerritoryNavigation` oltre a MapBridge wiring.
- OpenLayers / vecchia versione frontend.

---

## Definition of Done

- [ ] Nessun file in `territory-map-geoinsight/model/adapter/` > 250 righe.
- [ ] `TerritoryMapWidget.tsx` ≤ 180 righe.
- [ ] Zero simboli export morti (grep + build).
- [ ] Smoke checklist 10/10.
- [ ] Docs geoinsight allineate.
- [ ] Almeno 4 file di unit test su moduli puri.
