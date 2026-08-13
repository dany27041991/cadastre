# Plan: tabelle green — colonne detail + picker toolbar

**Spec:** [2026-08-13-green-table-detail-columns-design.md](./2026-08-13-green-table-detail-columns-design.md)  
**Data:** 2026-08-13  
**Stato:** done

## Goal

API table emette le stesse key del detail (`"NaN"` incluso); FE mostra default 5 + picker `SettingsIcon` in toolbar con Indietro; rimuove Gestione colonne da InfoPanel; persistenza `localStorage`.

## Steps

### 1. BE — estrarre proiezione metadata condivisa

**Da:** `green_detail_out.py` (`_prepare_area_values`, `_prepare_asset_values`, `_fmt_or_nan`, π, surface, …)

**A:** Modulo `territory/common/infrastructure/green_metadata_projection.py` (o simile) con:
- costanti key ordinate area/asset
- `project_area_metadata(row) -> dict[str, str]`
- `project_asset_metadata(row) -> dict[str, str]`

**Poi:** `build_area_detail` / `build_asset_detail` usano la proiezione per `metadata[]`.

### 2. BE — table list carica dati necessari + proietta

**File:** `green_areas_repository.list_table_rows_paged`, `green_assets_repository.list_table_rows_paged`

- Includere `attributes` nella load table (oggi escluso) **oppure** select dedicata per list che aggiunge:
  - Area: `attributes`, `ST_Area(geometry::geography)` AS `surface_area_m2_computed`, colonne scalar del subset
  - Asset: `attributes`, centroid lat/lon, colonne scalar del subset
- Dopo `orm_to_row_dict` / mapping: merge `project_*_metadata(row)` nelle chiavi prodotto (stringhe già formattate).
- Mantenere `id`, `region_id`, `province_id`, `municipality_id`, `green_area_id` per azioni.
- Enrich FK labels può restare (filtri/legacy) ma non è catalogo UI.

**Sort/filter v1:**
- Sortable: colonne DB native (`name`, `species`, `genus`, `variety`, enum status, `survey_date`, …).
- Non sortable in UI: `surface_area_m2`, `trunk_diameter_cm`, `latitude`, `longitude`, `plant_height_m`, `crown_diameter_m`, `species_code`, `plant_code` (alias di id — sort by `id` se si vuole), `area_code` area (= zril) sortable via `zril_identifier`.

Aggiornare whitelist `_AREA_SORT_MAP` / `_ASSET_SORT_MAP` / filter cols di conseguenza (map `area_code`→`zril_identifier` dove serve).

### 3. FE — catalogo + localStorage

**Nuovi file** sotto `features/territory/lib/`:

- `greenDetailColumnCatalog.ts` — `AREA_DETAIL_COLUMNS`, `ASSET_DETAIL_COLUMNS`, `AREA_DEFAULT_VISIBLE`, `ASSET_DEFAULT_VISIBLE`
- `greenTableVisibleCols.ts` — get/set/sanitize `linfa.green-table.visible-cols.{area|asset}`

**Aggiornare** `greenTableColumnLabel.ts` (o wrapper): preferire i18n `territory.panel.detail.meta.${key}` (stesso del modale).

**Celle:** se BE manda già `"NaN"`, non convertire `null` in `—` per key del catalogo (o trattare `null`/missing come `"NaN"` in `cellValue` per quelle key).

### 4. FE — `GreenTableColumnPicker`

Nuovo componente in `ui/green-data-table/`:
- Props: `kind`, `selectedKeys`, `onToggle(key)`, `onBack`
- Header Indietro (`BackNavHeader` se già in tabella, altrimenti `Button` + testo i18n)
- Checkbox dxc-webkit per ogni key catalogo
- Label da i18n meta

### 5. FE — `GreenDataTable`

- Stato `pickingColumns: boolean`
- Toolbar: `Button`/`icon` `SettingsIcon` → `pickingColumns=true`
- Se `pickingColumns` → render picker al posto di `CustomTable`
- `visibleKeys` = ordine catalogo ∩ selected (da storage + state); sync write su toggle
- Rimuovere dipendenza da `extraColumns` / `registerTableColumns` del context per le colonne (o adattare context)
- `isSortable: false` sulle key derivate (lista fissa)
- Sostituire `AREA_COLUMN_PRIORITY` / `ASSET_COLUMN_PRIORITY` / `pickDefaultFive` con catalogo spec

### 6. FE — InfoPanel / Context

- `GreenTablePanelSections`: rimuovere blocco Gestione colonne; solo filtri
- `filterColumnOptions` = catalogo detail del kind corrente (serve kind/area|asset nel context o props)
- `GreenTablePanelContext`: rimuovere `optionalColumnKeys`, `extraColumns`, `toggleExtraColumn`, `registerTableColumns` se non più usati; tenere `filterText`, `filterColumnKey`, `tablePanelActive`

### 7. i18n

- `territory.table.columnsToggle`, `territory.table.columnsTitle`, `territory.table.columnsBack`
- Riuso meta labels già presenti

### 8. Docs

- Spec status → `accepted`
- Nota breve su click-modal / table design cross-link

### 9. Verifica

```bash
# Table areas — ogni row ha le 8 key
curl -sS 'http://localhost:8000/api/territory/green-areas/...?page=1&page_size=2' | jq '.data[0] | keys'

# Table assets — 15 key prodotto + id tecnici
curl -sS '...' | jq '.data[0] | {plant_code, trunk_diameter_cm, latitude, surface: .surface_area_m2}'
```

UI: default 5; picker; Indietro; reload mantiene selezione; Info senza Gestione colonne.

## Ordine

1. Proiezione BE condivisa + refactor detail  
2. List table projection  
3. Catalogo FE + storage  
4. Picker + GreenDataTable  
5. Snellire InfoPanel/context  
6. Smoke + docs  

## Fuori scope

Reset default esplicito; drag reorder; sort su campi calcolati costosi.
