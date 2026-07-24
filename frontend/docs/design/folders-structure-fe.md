# Frontend – Struttura cartelle e convenzioni

Documentazione della struttura del progetto frontend.

---

## Root del progetto (`frontend/`)

Oltre a `src/` (codice applicativo), il progetto frontend ha:

- **`public/`** – file serviti così come sono alla root (Vite). Struttura **`public/assets/`**:
  - **`i18n/`** – (opzionale) non più usato per le stringhe app: le traduzioni sono in **`src/shared/i18n/locales/`** (bundle, compatibile single-spa);
  - **`images/`** – immagini (logo, banner, ecc.);
  - **`fonts/`** – font (woff2, woff, ecc.).
- `index.html`, `vite.config.ts`, `tsconfig.json`, `package.json`, ecc.

---

## Struttura `src/`

```
src/
│
├── app/                                        # Bootstrap e configurazione globale
│   ├── index.tsx                               # Root: Providers + App
│   ├── App.tsx                                 # Contenuto principale (Router + vista default)
│   │
│   ├── router/
│   │   ├── router.tsx
│   │   └── routes.ts
│   │
│   ├── providers/
│   │   ├── index.tsx                           # StrictMode, ErrorBoundary, Theme, Query
│   │   ├── query-provider.tsx                  # React Query
│   │   ├── theme-provider.tsx
│   │   └── error-boundary.tsx
│   │
│   └── config/
│       ├── env.ts
│       └── constants.ts
│
│
├── shared/                                     # Riutilizzabile ovunque (NO dominio)
│   │
│   ├── ui/                                     # Componenti puramente visuali
│   │   ├── button/
│   │   ├── input/
│   │   ├── select/
│   │   ├── modal/
│   │   ├── spinner/
│   │   ├── icon/
│   │   │
│   │   ├── data-table/                         # UI generica per tabelle
│   │   │   ├── DataTable.tsx
│   │   │   ├── DataTableHeader.tsx
│   │   │   ├── DataTableRow.tsx
│   │   │   ├── DataTableEmpty.tsx
│   │   │   └── types.ts
│   │   │
│   │   ├── pagination/
│   │   │   └── Pagination.tsx
│   │   │
│   │   └── filter-panel/
│   │       ├── FilterPanel.tsx
│   │       └── FilterField.tsx
│   │
│   ├── hooks/                                  # Hook generici (useDebounce, useToggle, useUrlState)
│   │   └── useUrlState.ts                      # Sync stato con URL
│   │
│   ├── lib/                                    # Utility generiche per categoria
│   │   ├── http/
│   │   │   └── fetcher.ts
│   │   │
│   │   ├── table-core/                         # 🧠 Headless table engine
│   │   │   ├── createTable.ts
│   │   │   ├── useTable.ts
│   │   │   ├── table.types.ts
│   │   │   ├── pagination.ts
│   │   │   ├── sorting.ts
│   │   │   ├── filtering.ts
│   │   │   └── query-adapter.ts                # Bridge con React Query
│   │   │
│   │   ├── url/
│   │   │   └── queryParams.ts
│   │   │
│   │   └── cache/
│   │       └── queryKeys.ts                    # Key centralizzate per cache e invalidation
│   │
│   ├── config/
│   │   └── map.ts
│   │
│   └── types/
│       ├── api.ts
│       └── geojson.ts
│
│
├── entities/                                   # Dominio puro riutilizzabile
│   │
│   ├── territory/
│   │   ├── model/
│   │   │   ├── types.ts
│   │   │   ├── schema.ts
│   │   │   └── mapper.ts
│   │   └── index.ts
│   │
│   ├── green-area/
│   │   ├── model/
│   │   │   ├── types.ts
│   │   │   ├── schema.ts
│   │   │   └── mapper.ts
│   │   └── index.ts
│   │
│   └── green-asset/
│       ├── model/
│       │   ├── types.ts
│       │   ├── schema.ts
│       │   └── mapper.ts
│       └── index.ts
│
│
├── features/                                   # Logica applicativa per use-case
│   │
│   ├── territory/                              # Navigazione territoriale + dati verde
│   │   ├── api/
│   │   │   ├── fetcher.ts                      # Fetch geobuf/JSON condiviso
│   │   │   ├── territory.api.ts
│   │   │   ├── greenAreaMap.api.ts
│   │   │   ├── greenAssetMap.api.ts
│   │   │   └── greenTable.api.ts
│   │   │
│   │   ├── context/
│   │   │   └── GreenTablePanelContext.tsx
│   │   │
│   │   ├── lib/                                # Utility pure (drill, identità feature, tabella)
│   │   │
│   │   ├── model/
│   │   │   ├── constants/
│   │   │   ├── fetchers/
│   │   │   │   ├── levelFetchers.ts
│   │   │   │   └── mapNavigationFetchers.ts
│   │   │   └── hooks/
│   │   │       ├── useTerritoryNavigation.ts
│   │   │       └── useGreenAssetsLayer.ts
│   │   │
│   │   ├── types/
│   │   │
│   │   ├── ui/
│   │   │   ├── map-header/
│   │   │   ├── map-breadcrumbs/
│   │   │   ├── green-data-table/
│   │   │   └── loading-overlay/
│   │   │
│   │   └── index.ts
│   │
│   │
│   ├── territory-map-geoinsight/               # Motore mappa Geoinsight (adapter vendor)
│   │   ├── lib/                                # WKT, stili asset, bbox viewport, geometrie cluster
│   │   │
│   │   ├── model/
│   │   │   ├── adapter/                        # geoinsightMapAdapter + moduli (green layers,
│   │   │   │                                   # viewport cluster, selezione, runtime vendor)
│   │   │   ├── hooks/
│   │   │   │   └── useGeoinsightMapBridge.ts
│   │   │   ├── greenClusterPipeline.ts
│   │   │   ├── geometryRegistry.ts
│   │   │   └── eventBridge.ts
│   │   │
│   │   ├── ui/
│   │   │   ├── GeoinsightMapContainer.tsx
│   │   │   └── GeoinsightFocusContainer.tsx
│   │   │
│   │   └── index.ts
│   │
│   │
│   ├── green-asset-explorer/                   # Tabella + filtri + paginazione
│   │   ├── model/
│   │   │   ├── filters.config.ts
│   │   │   ├── columns.config.ts
│   │   │   ├── useGreenAssetTable.ts           # Usa shared/lib/table-core
│   │   │   └── query.ts
│   │   │
│   │   ├── api/
│   │   │   └── greenAssetExplorer.api.ts
│   │   │
│   │   ├── ui/
│   │   │   ├── GreenAssetTable.tsx             # Usa DataTable generica
│   │   │   ├── GreenAssetFilters.tsx           # Usa FilterPanel generico
│   │   │   └── GreenAssetToolbar.tsx
│   │   │
│   │   └── index.ts
│   │
│   │
│   └── green-area-explorer/                    # Tabella + filtri + paginazione
│       ├── model/
│       │   ├── filters.config.ts
│       │   ├── columns.config.ts
│       │   ├── useGreenAreaTable.ts            # Usa shared/lib/table-core
│       │   └── query.ts
│       │
│       ├── api/
│       │   └── GreenAreaExplorer.api.ts
│       │
│       ├── ui/
│       │   ├── GreenAreaTable.tsx
│       │   ├── GreenAreaFilters.tsx
│       │   └── GreenAreaToolbar.tsx
│       │
│       └── index.ts
│
│
├── widgets/                                    # Composizione di feature
│   ├── layout/
│   │   ├── main/
│   │   │   ├── MainContent.tsx
│   │   │   └── MainContent.module.css
│   │   │
│   │   └── sidebar/
│   │       └── Sidebar.tsx
│   │
│   ├── territory-map-widget/
│   │   ├── TerritoryMapWidget.tsx
│   │   ├── useTerritoryMapBridge.ts
│   │   ├── useTerritoryMapEffects.ts
│   │   └── index.ts
│   │
│   ├── green-asset-explorer-widget/
│   │   ├── GreenAssetExplorerWidget.tsx
│   │   └── index.ts
│   │
│   └── green-area-explorer-widget/
│       ├── GreenAreaExplorerWidget.tsx
│       └── index.ts
│
└── main.tsx
```

---

## Convenzioni

### 1. **`app/`**

* `index.tsx`: root component, monta Providers + App.
* `App.tsx`: Router + vista default (widget TerritoryMap).
* `router/`: definizione route e Router component.
* `providers/`: StrictMode, ErrorBoundary, ThemeProvider, QueryProvider.
* `config/`: env (VITE_*) e costanti app-level.

---

### 2. **`shared/`**

* `ui/`: componenti riutilizzabili, generici (button, modal, spinner, icon).
  Contiene anche `data-table/`, `pagination/` e `filter-panel/` generici.
* `lib/`: utility generiche (http, table-core, url, cache).
  Table Core Engine headless: gestione pagination, sorting, filtering, query adapter React Query.
* `hooks/`: hook generici (`useDebounce`, `useToggle`, `useUrlState`).
* `config/`: configurazioni condivise (API_URL, mappa, ecc.).
* `types/`: tipi globali (GeoJSON, API generici).
* `styles/`: globals.css, variables.css.

---

### 3. **`entities/`**

* Dominio puro: tipi, schema, mapper.
* Tipi e logica di mapping centralizzata.
* Feature importano da `@/entities/<nome>`.

---

### 4. **`features/`**

* Organizzate per use-case:

  * **model/**: hook + data fetchers + orchestrazione.
  * **api/**: fetcher + API specifica.
  * **ui/**: componenti React della feature.
  * **lib/**: utility interne.
  * **types/**: tipi feature-specific (bridge, props).
  * **index.ts**: public API della feature.

* Table feature (`green-asset-explorer` e `green-area-explorer`) usano `shared/lib/table-core` + DataTable generico + FilterPanel generico + React Query.

---

### 5. **`widgets/`**

* Composizioni di feature:

  * layout (sidebar, main)
  * map widget
  * explorer widget
* Non contengono logica di dominio, solo orchestrazione di feature + UI.

---

### 6. **Regole di dipendenza**

```
app → widgets → features → entities → shared
```

* Mai invertire.
* Features importano solo shared + entities.
* Widgets importano shared + features.
* Entities e shared non importano da app, features o widgets.

---

### 7. **Nuove feature / entities / widget**

* **Nuova entity**: `entities/<nome>/model/types.ts`, `model/<nome>.ts`, `index.ts`.
* **Nuova feature**: `features/<nome>/model, api, ui, types, lib, index.ts`.
* **Nuovo widget**: `widgets/<nome>/` con componente + `index.ts`.

---

### 8. **Table Core Engine avanzato**

* Headless e generico.
* Gestione stato: pagination, sorting, filtering.
* Sync con URL (`useUrlState`).
* React Query integration + caching + invalidation strategica.
* Feature passano solo:

  * queryKey
  * fetcher
  * colonne
  * schema filtri
* UI è completamente separata (`DataTable`, `FilterPanel`, `Pagination`).

---

### 🚀 Miglioramenti senior

Puoi:

* Sincronizzare filtri e paginazione con URL (deep-linking e persistenza refresh).
* Rendere table-core completamente indipendente dalla UI.
* Integrare React Query direttamente nel motore (caching, retry, background fetch).
* Gestire caching e invalidation strategica centralizzata tramite query keys.

---

### Riepilogo

| Area          | Ruolo                                                              |
| ------------- | ------------------------------------------------------------------ |
| **app/**      | Bootstrap, router, providers, config.                              |
| **shared/**   | UI generica, lib, hooks, config, types, styles, Table Core Engine. |
| **entities/** | Dominio puro (territory, green-area, green-asset).                |
| **features/** | Model, API, UI, lib, types per use-case.                          |
| **widgets/**  | Composizione di feature (layout, map, explorer).                   |
| **main.tsx**  | Entry point, monta App da `app/index.tsx`.                         |
