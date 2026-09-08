# Plan: subset metadati modale dettaglio green area/asset

**Spec:** [2026-08-12-green-detail-metadata-subset-design.md](./2026-08-12-green-detail-metadata-subset-design.md)  
**Data:** 2026-08-13  
**Stato:** done  

> **Addendum cutover:** detail load via `*LakehouseRepository` + DuckDB; `date_from`/`date_to` obbligatori.

## Goal

API detail e modale mostrano solo il subset prodotto (8 area / 15 asset), sempre tutte le chiavi, mancanti → `"NaN"`, con derivazioni (ST_Area, centroid, diametro da circonferenza/π).

## Context tecnico rilevante

- DTO: `backend/.../dto/green_detail_out.py` (`build_area_detail` / `build_asset_detail`).
- Use-case: `catalog_green_area.get_green_area_detail` / analogo asset → `get_by_pk` + enrich labels + bbox/geometry.
- **Blocco attuale:** `get_by_pk` usa `_TABLE_EXCLUDE_COLS` → **non carica `attributes`**; serve path detail dedicato (o include attributes solo lì).
- FE: `GreenDetailModal` rende `detail.metadata` così com’è + i18n `territory.panel.detail.meta.*` in `frontend/src/shared/i18n/locales/{it,en}.json`.

## Steps

### 1. BE — helper metadata (DTO)

**File:** `cadastre/backend/src/territory/common/infrastructure/dto/green_detail_out.py`

- Sostituire `_AREA_METADATA_KEYS` / `_ASSET_METADATA_KEYS` con tuple ordinate dello spec.
- `_MISSING = "NaN"`.
- `_fmt_or_nan(value)` → stringa o `"NaN"` (None / `""` / whitespace → NaN).
- `_metadata_fixed(row, keys)` → emette **sempre** tutte le key.
- Helper derivati (puri, testabili):
  - `_attr(row, key)` da `row["attributes"]` dict.
  - `_trunk_diameter_cm(attrs)`: `trunk_diameter_cm` → else `trunk_circumference_cm / π` (1 decimale) → None.
  - `_plant_height_m(attrs)`: `plant_height_m` poi `height_m` (no `height_class`).
  - `_surface_area_m2(row)`: attr `surface_area_m2` → else `row["surface_area_m2_computed"]` → None.
- Prima di `_metadata_fixed`, normalizzare row:
  - **Area:** `area_code` ← `zril_identifier`; `surface_area_m2` ← helper.
  - **Asset:** `plant_code` ← `id`; `species_code` ← attr; `area_code` ← `green_area_id`; `trunk_diameter_cm` / `plant_height_m` / `crown_diameter_m` ← attrs; `latitude` / `longitude` ← row computed.
- Formattazione: date → `YYYY-MM-DD` se possibile; lat/lon 6 decimali; superficie intero.

### 2. BE — repository detail load

**File:** `green_areas_lakehouse_repository.py`, `green_assets_lakehouse_repository.py`

Aggiungere (preferito, senza sporcare table API):

```text
get_detail_by_pk(id, region_id, province_id) -> dict | None
```

- Carica colonne scalar necessarie al subset **+ `attributes`**.
- Select calcolati nella stessa query (o seconda leggera):
  - Area: `ST_Area(geometry::geography)::float` AS `surface_area_m2_computed` (solo se geometry NOT NULL).
  - Asset: `ST_Y(ST_Centroid(geometry))`, `ST_X(ST_Centroid(geometry))` AS latitude/longitude.
- Soft-delete invariato (`deleted_at IS NULL`).
- `get_by_pk` table/list: **non modificare** (resta senza attributes).

### 3. BE — use-case wiring

**File:** `catalog_green_area.py`, `catalog_green_asset.py`

- `get_*_detail`: usare `get_detail_by_pk` al posto di `get_by_pk`.
- Mantenere enrich admin labels + bbox + geometry come oggi.
- Nessun cambio path/query HTTP.

### 4. FE — i18n

**File:** `frontend/src/shared/i18n/locales/it.json`, `en.json`

Aggiungere/aggiornare sotto `territory.panel.detail.meta`:

| key | IT | EN |
|-----|----|----|
| `area_code` | Codice area | Area code |
| `plant_code` | Codice pianta | Plant code |
| `species_code` | Codice specie | Species code |
| `latitude` | Latitudine | Latitude |
| `longitude` | Longitudine | Longitude |
| `trunk_diameter_cm` | Diametro tronco (cm) | Trunk diameter (cm) |
| `plant_height_m` | Altezza pianta | Plant height |
| `crown_diameter_m` | Diametro chioma | Crown diameter |
| `surface_area_m2` | Superficie area (m²) | Area surface (m²) |
| `perimeter_type` | Tipo perimetro | Perimeter type |
| (esistenti) | verificare label allineate allo spec | |

Opzionale (stesso PR se già c’è mappa enum→label nel modale/tabella): allineare label IT enum growth/protection/health allo spec. Se oggi il modale mostra il **codice grezzo**, lasciare così in v1 (accettato dallo spec: “label via i18n FE”) e aggiungere mappa `metaValue` solo se esiste già pattern; altrimenti TODO minimo + i18n key-ready.

### 5. FE — modal

**File:** `GreenDetailModal.tsx`

- Nessun filtro chiavi (DTO è source of truth).
- Verificare che `"NaN"` non venga sostituito da `"—"`.
- Empty metadata branch: con subset fisso non dovrebbe più comparire a ready; lasciare fallback.

### 6. Docs

- Aggiornare subset in `2026-07-30-green-detail-click-modal-design.md` → link allo spec 2026-08-12.
- Spec status → `accepted`.

### 7. Verifica manuale

```bash
# Area Lecce
curl -s "http://localhost:8000/api/territory/green-areas/185902?region_id=16&province_id=75" | jq '.metadata'

# Asset (prendere un id reale da table/API)
curl -s "http://localhost:8000/api/territory/green-assets/<id>?region_id=16&province_id=75" | jq '.metadata'
```

Check:

1. Area: 8 key, ordine fisso; `surface_area_m2` numerico o NaN; no `level`/`geometry_type`.
2. Asset: 15 key; `plant_code` = id; lat/lon numerici; diametro da π se solo circonferenza; `plant_height_m` NaN se solo `height_class`.
3. Modale UI: stesse label/valori; nessun metadato extra.

## Ordine di merge / rischio

1. DTO helpers (+ unit test locale se già c’è pattern test DTO; altrimenti skip).  
2. Repository `get_detail_by_pk`.  
3. Use-case switch.  
4. i18n + smoke curl.  
5. Docs.

**Rischio basso:** table API invariata.  
**Rischio medio:** `ST_Area`/`Centroid` su geometrie invalide — già `ST_MakeValid` a seed; se NULL geometry → NaN.

## Fuori scope (confermato)

- DDL nuove colonne; reseed Lecce; nuovo enum “nuovo impianto”; commit git (solo su richiesta).
