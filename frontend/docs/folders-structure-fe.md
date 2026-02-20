# Frontend – Struttura cartelle e convenzioni

Documentazione della struttura del progetto frontend, allineata a [modular-package-structure.md](./modular-package-structure.md).

---

## Struttura `src/`

```
src/
│
├── api/                          # Chiamate API e contratti
│   ├── client.ts                 # Fetcher, GeoJSON, client HTTP
│   └── territory/
│       ├── index.ts              # Barrel (re-export)
│       ├── territory.ts          # API territorio (geo + aree verdi + asset)
│       ├── areas/
│       │   └── greenAreas.api.ts # API aree verdi
│       └── assets/
│           └── greenAssets.api.ts # API asset verdi
│
├── shared/                       # Risorse condivise (nessun import da features o api)
│   ├── constants/
│   │   └── map.ts                # API_URL, ITALY_CENTER, ITALY_ZOOM
│   ├── types/
│   │   ├── index.ts              # Barrel (re-export sottocartelle)
│   │   ├── territory/            # Livelli e breadcrumb
│   │   │   ├── index.ts
│   │   │   └── territory.ts
│   │   ├── geojson/              # Contratto GeoJSON
│   │   │   ├── index.ts
│   │   │   └── geojson.ts
│   │   ├── api/                  # Contratti API territorio
│   │   │   ├── index.ts
│   │   │   └── territory-api.ts
│   │   ├── navigation/           # Bridge, stato, loaders navigazione
│   │   │   ├── index.ts
│   │   │   ├── navigation.interfaces.ts
│   │   │   └── navigation.types.ts
│   │   └── map/                  # Hook mappa e handler select
│   │       ├── index.ts
│   │       ├── handler.types.ts
│   │       ├── territory-map.interfaces.ts
│   │       └── territory-map.types.ts
│   ├── config/
│   │   └── greenAssetCluster.ts # Config cluster layer verde
│   ├── styles/
│   │   └── index.css             # Stili globali
│   ├── hooks/
│   │   ├── useTerritoryMap.ts
│   │   └── useTerritoryNavigation.ts
│   └── factory/
│       └── loaders/
│           ├── mapNavigationLoaders.ts
│           └── levelLoaders.ts
│
├── features/
│   └── map/                      # Feature: mappa e navigazione territorio
│       ├── components/
│       │   └── map/
│       │       ├── index.ts      # Barrel (MapHeader, GreenPalette)
│       │       ├── MapHeader.tsx
│       │       ├── MapHeader.module.css
│       │       └── palette/
│       │           ├── GreenPalette.tsx
│       │           ├── GreenPalette.module.css
│       │           ├── loading-overlay/
│       │           └── tree-icon/
│       └── types/
│           └── interfaces/
│               └── mapComponents.interfaces.ts  # MapHeaderProps, GreenPaletteProps, GreenContext
│
├── components/                   # Layout e UI riutilizzabili
│   └── layout/
│       ├── sidebar/
│       │   └── Sidebar.tsx
│       └── main-content/
│           ├── MainContent.tsx
│           ├── MainContent.module.css
│           └── map-breadcrumbs/
│               └── MapBreadcrumbs.tsx
│
├── App.tsx
├── main.tsx
└── vite-env.d.ts
```

---

## Convenzioni

### 1. **`api/`**
- **`client.ts`**: fetcher HTTP, tipi GeoJSON, `createFetcher`.
- **`territory/`**: API territorio (geo, aree verdi, asset). Barrel **`index.ts`** per import da `@/api/territory`.
- Nessun import da `shared` oltre a costanti/tipi (es. `constants/map`).

### 2. **`shared/`**
- **Nessun import da `features` o da `api`** (solo tipi/utility generici e contratti definiti in shared).
- **`types/`**: sottocartelle per dominio (territory, geojson, api, navigation, map); barrel `index.ts` in ogni cartella e in `types/` per import da `@/shared/types` o `@/shared/types/territory`, ecc.
- **`config/`**: configurazione condivisa (es. cluster layer verde).
- **`hooks/`**: hook usati da più feature o dall’app (useTerritoryMap, useTerritoryNavigation). L’API territorio viene iniettata dal chiamante (App).
- **`factory/loaders/`**: loaders per livelli di navigazione; usano solo tipi da `shared/types`.

### 3. **`features/map/`**
- **`components/map/`**: MapHeader, GreenPalette (e sottocomponenti palette). Barrel `index.ts` per esportare i componenti pubblici.
- **`types/interfaces/`**: solo interfacce UI della feature (MapHeaderProps, GreenPaletteProps, GreenContext).
- La feature importa da **api**, **shared** e **components**; non da altre features.

### 4. **`components/`**
- Layout (Sidebar, MainContent, MapBreadcrumbs). Import solo da **shared** (tipi, costanti).
- Nessuna chiamata API né stato di dominio.

### 5. **Import**
- **API**: `from '@/api/territory'`.
- **Shared**: `from '@/shared/constants/map'`, `@/shared/types/territory`, `@/shared/hooks/useTerritoryMap`, `@/shared/styles/index.css`.
- **Feature map**: `from '@/features/map/components/map'` (barrel).

### 6. **Stili**
- Globale: **`shared/styles/index.css`** (importato in `main.tsx`).
- Per componente: **CSS modules** (`.module.css`) nella stessa cartella del componente.

---

## Riepilogo

| Area           | Ruolo |
|----------------|--------|
| **api/**       | Client HTTP e API territorio (geo, aree verdi, asset). |
| **shared/**    | Costanti, tipi e contratti, config, hook condivisi, loaders, stili globali. Nessuna dipendenza da features o api. |
| **features/map/** | Componenti mappa (MapHeader, GreenPalette) e tipi UI della feature. |
| **components/**   | Layout (sidebar, main-content, breadcrumb). Solo shared. |

La struttura rispetta le [regole di dipendenza](./modular-package-structure.md#6-regole-di-dipendenza-da-rispettare) del documento modulare.
