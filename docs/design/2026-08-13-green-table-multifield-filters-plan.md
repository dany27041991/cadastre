# Piano — Filtri multi-campo InfoPanel

**Spec:** [2026-08-13-green-table-multifield-filters-design.md](./2026-08-13-green-table-multifield-filters-design.md)  
**Stato:** done

## 1. FE — context + tabella

- [`GreenTablePanelContext.tsx`](../../frontend/src/features/territory/context/GreenTablePanelContext.tsx): `columnFiltersByKind`, setter/clear; rimuovere `filterText` / `filterColumnKey`.
- [`GreenDataTable.tsx`](../../frontend/src/features/territory/ui/green-data-table/GreenDataTable.tsx): debounce record filtri kind attivo → params multi-key; reset page.

## 2. FE — wizard + UI

- [`InfoPanelContent.tsx`](../../frontend/src/widgets/layout/info-panel/InfoPanelContent.tsx): step `filters`; Avanti layers→filters; Indietro filters→layers; nascondere Avanti su filters.
- Refactor [`GreenTablePanelSections.tsx`](../../frontend/src/widgets/layout/info-panel/GreenTablePanelSections.tsx) → lista `SearchInput` per `detailColumnsFor(kind)`.
- i18n titolo/hint step filtri.

## 3. BE — whitelist

- Estendere `_build_area_filter_conditions` / `_build_asset_filter_conditions` per tutte le key catalogo (mapping nello spec).
- Verificare ctrl table passino i query param nel dict `filters`.

## 4. Verify

- Smoke GET table Lecce con 2+ params AND.
