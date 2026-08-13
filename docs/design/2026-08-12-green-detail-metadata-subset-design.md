# Dettaglio area/asset — subset metadati (modale)

**Data:** 2026-08-12  
**Stato:** accepted  
**Piano:** [2026-08-13-green-detail-metadata-subset-plan.md](./2026-08-13-green-detail-metadata-subset-plan.md)  
**Aggiorna:** sezione “Subset metadati” di [2026-07-30-green-detail-click-modal-design.md](./2026-07-30-green-detail-click-modal-design.md) e del popover design superseduto.  
**Vincolo UI:** invariato — `GreenDetailModal` (dxc-webkit); nessuna nuova libreria UI.

## Obiettivo

Nel modale di dettaglio mappa mostrare **solo** i metadati di prodotto sotto elencati. Nessun altro campo. Chiavi sempre presenti nell’ordine fisso; valore assente → stringa `"NaN"`.

## Decisioni

| Tema | Scelta |
|------|--------|
| Approccio | BE emette subset fisso + derivazioni; FE solo label i18n / layout |
| Campi mancanti | Sempre in lista; `value = "NaN"` |
| Perimetro area | Un solo rigo `perimeter_type` (`REAL` / `FICTITIOUS`) |
| Identificativo area | Due righi: `name` + `area_code` (`zril_identifier`; se null → `"NaN"`) |
| Superficie area | `attributes.surface_area_m2` se presente; altrimenti `ST_Area` su geography (m²); altrimenti `"NaN"` |
| Codice pianta | `plant_code` = `id` (sempre) + `species_code` da attributes (o `"NaN"`) |
| Diametro tronco | Diametro da attributes se presente; else `circonferenza_cm / π`; else `"NaN"` |
| Altezza pianta | Solo metri da attributes; **non** usare `height_class`; else `"NaN"` |
| Enum (fase, protezione, salute) | Valore grezzo enum in DTO; label IT/EN via i18n FE (come oggi) |

## Contratto API (invariato nella forma)

`GET /api/territory/green-areas/{id}?region_id=&province_id=`  
`GET /api/territory/green-assets/{id}?region_id=&province_id=`

```ts
metadata: Array<{ key: string; value: string }>
```

- Ordine = ordine delle tabelle sotto.
- Ogni chiave del subset compare **sempre** (anche con `"NaN"`).
- `summary` / `bbox` / `geometry` invariati (titolo, framing, highlight).

Sentinel mancante: **`"NaN"`** (non `null`, non `"—"`, non omissione della chiave).

## Subset Area (livello 1 — Aree Gestite)

| # | `key` | Label IT (i18n) | Fonte |
|---|-------|-----------------|--------|
| 1 | `name` | Nome area | `green_areas.name` |
| 2 | `area_code` | Codice area | `zril_identifier` |
| 3 | `area_classification` | Classificazione area | colonna |
| 4 | `istat_classification` | Classificazione ISTAT | colonna |
| 5 | `intensity_of_fruition` | Intensità di fruizione | colonna |
| 6 | `perimeter_type` | Tipo perimetro | `REAL` \| `FICTITIOUS` |
| 7 | `survey_date` | Data rilievo | colonna (ISO date; senza ora se mezzanotte UTC) |
| 8 | `surface_area_m2` | Superficie area | attributes `surface_area_m2` → else `ST_Area(geometry::geography)` arrotondato a intero |

**Esclusi dal modale:** `level`, `geometry_type`, `administrative_status`, `operational_status`, `survey_status`, date management, ecc.

## Subset Asset (livello 2 — Assets verdi)

| # | `key` | Label IT (i18n) | Fonte |
|---|-------|-----------------|--------|
| 1 | `plant_code` | Codice pianta | `green_assets.id` (sempre valorizzato) |
| 2 | `species_code` | Codice specie | `attributes.species_code` |
| 3 | `area_code` | Codice area | `green_area_id` |
| 4 | `latitude` | Latitudine | `ST_Y(ST_Centroid(geometry))` WGS84 |
| 5 | `longitude` | Longitudine | `ST_X(ST_Centroid(geometry))` WGS84 |
| 6 | `survey_date` | Data rilievo | colonna |
| 7 | `species` | Specie | colonna |
| 8 | `genus` | Genere | colonna |
| 9 | `variety` | Varietà | colonna |
| 10 | `trunk_diameter_cm` | Diametro tronco (cm) | vedi regola diametro |
| 11 | `plant_height_m` | Altezza pianta | attributes: prima `plant_height_m`, poi `height_m`; **non** `height_class` |
| 12 | `crown_diameter_m` | Diametro chioma | `attributes.crown_diameter_m` (facoltativo) |
| 13 | `growth_stage` | Fase di sviluppo | colonna enum |
| 14 | `protection_status` | Protezione | colonna enum |
| 15 | `health_status` | Stato di salute | colonna enum |

### Regola diametro tronco

1. Se `attributes.trunk_diameter_cm` è numerico → usarlo.  
2. Altrimenti se `attributes.trunk_circumference_cm` è numerico → `round(circumference / π, 1)`.  
3. Altrimenti → `"NaN"`.

### Mapping enum → label (FE i18n; DTO resta codice)

Allineamento semantico alle voci prodotto (valori DB esistenti):

| Campo | Enum DB | Label IT attesa |
|-------|---------|-----------------|
| `growth_stage` | `YOUNG` | Pianta giovane |
| | `SEMI_MATURE` | (esistente; mostrare label i18n corrente) |
| | `MATURE` | Adulta |
| | `OVERMATURE` | Senescente |
| | `DEAD` / `UNKNOWN` | label i18n; se non in lista prodotto restano comunque |
| | *(assente nuovo impianto)* | finché non esiste enum dedicato → `"NaN"` o valore reale se/quando aggiunto |
| `protection_status` | `NONE` | Nessuno |
| | `MONUMENTAL` | Albero monumentale |
| | `PROTECTED` / `HISTORICAL` | Pianta di particolare interesse (label i18n) |
| `health_status` | `HEALTHY` | Sana |
| | `DEGRADED` | Degradata |
| | `SICK` | Malata |
| | `DECEASED` | Deceduta |
| | `DECLINING` | label i18n esistente (fuori lista prodotto ma valorizzabile) |

**Nota:** non si alterano gli enum DB in questo intervento; solo subset DTO + label FE.

**Esclusi dal modale:** `asset_type`, `geometry_type`, `family`, `risk_level`, `asset_status`, `managing_entity`, ecc.

## Implementazione (scope)

### Backend

- `green_detail_out.py`: sostituire `_AREA_METADATA_KEYS` / `_ASSET_METADATA_KEYS`; helper che emette **sempre** tutte le chiavi (`"NaN"` se vuoto); arricchimento row con campi derivati prima del build.
- Repository `get_by_pk` (aree/asset): includere in select quanto serve (`attributes`, centroid lon/lat, `ST_Area` geography o calcolo in use-case). Preferire una query detail dedicata o colonne calcolate nel `get_by_pk` usato dal detail, senza cambiare il contratto HTTP.
- Formattazione numerica: lat/lon ~6 decimali; diametro 1 decimale; superficie intero m².

### Frontend

- i18n `territory.panel.detail.meta.*` per le nuove key (`plant_code`, `area_code`, `latitude`, `longitude`, `trunk_diameter_cm`, `plant_height_m`, `crown_diameter_m`, `surface_area_m2`, `species_code`; aggiornare label IT se necessario).
- `GreenDetailModal`: nessuna logica di filtro chiavi (si fida del DTO); eventuali label enum già gestite o da estendere se oggi mostrano il codice grezzo.
- Tabella dati / altri consumer del detail: fuori scope salvo regressioni.

### Docs

- Aggiornare subset in design click-modal + eventuale nota in `database-mapping-diagram` solo se si documentano chiavi attributes usate dal detail.

### Fuori scope

- Nuove colonne DDL per diametro/altezza/superficie.
- Seed Lecce: non obbligatorio ricalcolare; i fallback coprono i buchi.
- Cambiare enum `growth_stage` (nuovo impianto) — solo se richiesto in seguito.

## Criteri di accettazione

1. Modale area: esattamente le 8 key sopra, ordine fisso; assenti → `"NaN"`.  
2. Modale asset: esattamente le 15 key sopra, ordine fisso; assenti → `"NaN"`.  
3. Nessun metadato extra (`level`, `family`, …) nel response detail usato dal modale.  
4. Area con solo geometria e senza `surface_area_m2` in attributes: superficie numerica da `ST_Area`.  
5. Asset con sola circonferenza: `trunk_diameter_cm` ≈ circonferenza/π.  
6. Asset senza altezza in metri: `plant_height_m` = `"NaN"` (anche se esiste `height_class`).  
7. Click dettaglio area/asset Lecce non 500; lat/lon presenti per geometrie point/polygon.

## Rischi / note

- `"NaN"` è stringa di prodotto, non JSON `null` — non confondere con `Number.NaN` lato FE.  
- `area_code` area = ZRIL; `area_code` asset = `green_area_id` (stesso key, semantica diversa per `kind`) — accettato; label i18n unica “Codice area”.  
- Centroid di MultiPolygon può cadere fuori dal poligono; accettabile per v1 (posizione geografica indicativa).
