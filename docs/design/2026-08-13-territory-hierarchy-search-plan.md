# Piano — Ricerca gerarchica territorio (SearchInput Layers)

**Spec:** [2026-08-13-territory-hierarchy-search-design.md](./2026-08-13-territory-hierarchy-search-design.md)  
**Stato:** ready  

> **Addendum cutover 2026-09-04:** Infrastructure search = UNION su `public.regions|provinces|municipalities|sub_municipal_area` only.  
> Nessun JOIN su `cadastre.green_areas`. Hit `green_areas` / `sub_areas` non emessi dall’API search.

## 0. Vincoli

- Nessuna regressione su click mappa, toggle, viewport verde, filtri tabella, detail.
- UI solo dxc-webkit `SearchInput`.
- Jump riusa loader esistenti (`loadRegions` / `loadProvinces` / … / `loadSubAreas`).

---

## 1. BE — search endpoint

**Modulo:** `territory/geo` (Clean Architecture).

| Layer | Lavoro |
|-------|--------|
| Domain | DTO/entity hit: `value`, `label`, `level`, `id`, parent ids |
| Application | Use case `SearchTerritoryHierarchy(q, limit)` |
| Infrastructure | Repository SQL UNION/JOIN su `regions`, `provinces`, `municipalities`, `sub_municipal_area` (**admin only**; no green PG) |
| Web | `GET /api/territory/search?q=&limit=` in nuovo o esistente ctrl; registrare router |

**SQL v1**

- `ILIKE '%' || :q || '%'` su `name` (province: path label con suffisso allineato a FE i18n, es. `"Lecce" || ' Provincia'` o costruzione path lato Python).
- Path: `Italia - {region} - {province[+suffix]} - {municipality} - …`.
- `q` vuoto / blank → un hit `level=italy`, `label=Italia`, `value=italy`.
- `limit` default 20.
- Wire in `core.api.container` + `dependencies`.

**Smoke:** `GET .../search?q=Puglia`, `q=Lecce`, `q=Santa`, `q=` → Italia.

---

## 2. FE — API client

- [`territory.api.ts`](../../frontend/src/features/territory/api/territory.api.ts): `searchTerritory(q: string, limit?: number) → TerritorySearchHit[]`.
- Tipo `TerritorySearchHit` in `features/territory` / `entities/territory` (allineato allo spec).

---

## 3. FE — jumpToSearchHit (navigation)

- In [`useTerritoryNavigation.ts`](../../frontend/src/features/territory/model/hooks/useTerritoryNavigation.ts) (o modulo `lib/jumpToTerritorySearchHit.ts` chiamato dall’hook):
  - `italy` / clear → `loadRegions()`.
  - `regions` → `loadProvinces(id, regionName)`.
  - `provinces` → breadcrumb regione + `loadMunicipalities` (come click provincia: riusare firma loader attuale).
  - `municipalities` / `sub_municipal_areas` / `green_areas` / `sub_areas` → sequenza equivalente al drill esistente usando ids del hit (preferire una sola chiamata al loader “foglia” che setta crumb correttamente, come fanno già i loader).
- Esporre `jumpToSearchHit` nel result dell’hook.
- **Non** passare da `handleFeatureSelect` (quel path blocca overlay); jump bypassa il guard overlay di proposito.

Verificare firme in [`useAdminTerritoryLoaders.ts`](../../frontend/src/features/territory/model/hooks/useAdminTerritoryLoaders.ts) e allineare crumb labels (suffisso provincia).

---

## 4. FE — wiring nav → InfoPanel

Oggi `LayersPanel` non ha `nav`. Estendere context (stesso pattern di `registerGreenAssetsLayer`):

- [`GreenTablePanelContext.tsx`](../../frontend/src/features/territory/context/GreenTablePanelContext.tsx):
  - `registerTerritorySearchNav({ breadcrumb, jumpToSearchHit, loadRegions, loading } | null)`
  - oppure campi dedicati + register da [`TerritoryMapWidget.tsx`](../../frontend/src/widgets/territory-map-widget/TerritoryMapWidget.tsx).
- Widget: `useEffect` register/unregister con breadcrumb + jump + loadRegions.

---

## 5. FE — TerritorySearchInput + LayersPanel

- Nuovo componente UI (es. `widgets/layout/info-panel/TerritorySearchInput.tsx`):
  - `SearchInput` + `loadOptions` → `territoryApi.searchTerritory`.
  - `value` / label controlled da path breadcrumb (`Italia` se vuoto).
  - `onChange` → `jumpToSearchHit` (parse hit da `value` o mappa option→hit).
  - `onClear` → `loadRegions()`.
  - Evitare loop sync breadcrumb→value (ref “lastJump” o confronta path).
- [`LayersPanel.tsx`](../../frontend/src/widgets/layout/info-panel/LayersPanel.tsx): montare search **sopra** `GreenLayerToggles`.
- i18n it/en: label, placeholder, helper se serve.

---

## 6. Verify (manuale)

1. Layers → digita Puglia → select → province Puglia (come click regione).
2. Santa Rosa (o nodo noto seed) → path completo → stesso drill.
3. Clear → Italia / regioni.
4. Toggle OFF + click mappa → SearchInput path aggiornato.
5. Toggle ON + search jump → scope aggiornato; cluster/aree seguono; no regressione clear toggle.
6. Filtri tabella / detail invariati.

---

## Ordine implementazione

1. BE search + smoke curl  
2. FE API type + client  
3. `jumpToSearchHit` + test mentale sui loader  
4. Context register + widget  
5. `TerritorySearchInput` + LayersPanel + i18n  
6. Verify checklist  

## Rollback

Feature isolata: rimuovere SearchInput da LayersPanel + endpoint; navigation click/toggle intatti.
