# Metodologia dimensionamento SIV – Catasto arboreo

Documento di supporto ai workbook `Fabbisogno_SIV_Catasto_Arboreo.xlsx` e `dataiku_rsc_siv_catasto.xlsx`.

## 1. Perimetro dati

| Parametro | Valore | Note |
|-----------|--------|------|
| Comuni target | ~7.904 | Codici ISTAT; arrotondamento comunicato ~8.000 |
| Tipologia asset | `asset_type = tree` | Solo alberi puntuali (geometry_type = P) |
| Stima alberi nazionali | **~8,4 M** | Scaling da benchmark interno |
| Aree verdi contenitrici | ~300–500 k | Stima da rapporto area/asset nel benchmark |

### Calcolo stima alberi

Benchmark eseguito il **2026-02-14** su dataset sintetico nazionale (`cadastre/infrastructure/scripts/database/performance/`):

- **2.001.449** alberi (`asset_type = tree`)
- **1.878** comuni con almeno un asset
- Scaling lineare: `2.001.449 × (7.904 / 1.878) ≈ 8.421.000` alberi

Range prudente per il dimensionamento: **6–10 M alberi** (comuni rurali a bassa densità vs. grandi città).

## 2. Analisi API verde e cache

### 2.1 Endpoint mappa (GeoJSON / Geobuf)

| Endpoint | Cache | Chiave | Max size |
|----------|-------|--------|----------|
| `GET /green-areas` | Sì (LRU lzma) | `(region_id, province_id, municipality_id[, sub_municipal_area_id])` | 2048 |
| `GET /green-assets` | Sì (LRU lzma) | `(region_id, province_id, municipality_id[, sub_municipal_area_id])` | 2048 |

**Non cacheati** (query dirette al DB):

- `/green-areas` con `parent_id` (figli gerarchia area)
- `/green-areas` con `contained_in_area_id` (overlap geodesico)
- `/green-assets` con `green_area_id` (asset in singola area)
- `/green-areas/table` e `/green-assets/table` (paginazione, filtri, sort)

### 2.2 Endpoint geo amministrativi

| Endpoint | Cache | TTL |
|----------|-------|-----|
| `/regions` | CompressedTTLCache | 86.400 s (24 h) |
| `/regions/{id}/provinces` | CompressedTTLCache | 86.400 s |
| `/provinces/{id}/municipalities` | CompressedTTLCache | 86.400 s |
| `/municipalities/{id}/sub-municipal-areas` | CompressedTTLCache | 86.400 s |

Implementazione: `core/cache/__init__.py` — compressione **lzma preset 9** + pickle.

### 2.3 Impatto sul dimensionamento

| Componente | Stima | Motivazione |
|------------|-------|-------------|
| RAM per pod backend | 4–8 GB (prod) | Decompressione lzma + fino a 2048 entry × 2 cache; payload tipico comune ~100–400 KB compressi |
| RAM worst-case (mega-comune) | fino a 16 GB | Comune con >100k alberi può generare entry cache >50 MB decompressed |
| CPU backend | 2–4 vCPU | Serializzazione geobuf, compress/decompress cache, JWT |
| Redis (opzionale) | 2–4 GB | Solo se si migra da cache in-process a cache distribuita tra repliche |
| PostGIS | 16 vCPU, 64 GB RAM | Query spatial per comune 0,4–11 s su 8,7 M asset (benchmark); indici GIST + partizionamento ISTAT |

**Nota:** Redis è presente in `requirements.txt` ma **non** nel compose attuale; la cache è **in-process** per pod.

## 3. Performance database (benchmark 2026-02-14)

| Query | Tempo | Dataset |
|-------|-------|---------|
| Count asset totali Italia | 3,2 s | 8.711.407 asset |
| Count tree Italia | 4,8 s | 2.001.449 tree |
| Aggregazione per provincia | 5,0 s | 17 province |
| Aggregazione per comune (sample) | 0,9–11 s | top 500 comuni |
| Specie distinte per comune | 23–47 s | query pesante (non in API sync) |

Configurazione benchmark: `work_mem = 256MB`, PostGIS 16, dataset sintetico multi-regione.

## 4. Risorse infrastrutturali stimate

Baseline di dimensionamento: **catasto nazionale completo** con aree verdi e asset verdi su tutti i ~7.904 comuni ISTAT (~36 M asset, ~8,4 M alberi). I fogli Excel **Fabbisogno Corrente** e **Fine Progetto** riportano la stessa richiesta integrale di risorse.

> **Nota storage:** PostGIS e MinIO coprono i dati di dominio. Backend e frontend includono un **PVC locale per replica** (log, file temporanei, headroom futuro). PostGIS PaaS include **vCPU e RAM** oltre al disco (query spatiali su ~36 M asset).

### Sviluppo

| Servizio | vCPU | RAM | Disco locale/replica | Repliche |
|----------|------|-----|----------------------|----------|
| Backend FastAPI | 2 | 4 GB | 10 GB | 1 |
| Frontend microfrontend | 1 | 2 GB | 5 GB | 1 |
| PostGIS | 4 | 8 GB | 10 GB | 1 |
| MinIO | — | — | 10 GB | 1 |

### Collaudo

| Servizio | vCPU | RAM | Disco locale/replica | Repliche |
|----------|------|-----|----------------------|----------|
| Backend | 2 | 4 GB | 20 GB | 2 |
| Frontend | 1 | 2 GB | 10 GB | 2 |
| PostGIS | 8 | 16 GB | 100 GB | 1 |
| MinIO | — | — | 100 GB | 1 |

### Produzione

| Servizio | vCPU | RAM | Disco locale/replica | Repliche |
|----------|------|-----|----------------------|----------|
| Backend | 4 | 8 GB | 50 GB | 6 (HPA → 12, CPU 65%) |
| Frontend | 1 | 2 GB | 20 GB | 3 |
| PostGIS | 16 | 64 GB | 500 GB | 1 (+ replica RO) |
| MinIO | — | — | 500 GB | 1 |

### Storage PostGIS – breakdown (scenario nazionale ~36 M asset)

| Voce | Stima |
|------|-------|
| `green_assets` (tutti i tipi) | ~100–140 GB |
| `green_areas` | ~30–50 GB |
| Confini ISTAT + catalogo DBT | ~3 GB |
| Indici GIST + B-tree | ~40–60 GB |
| Storico + WAL + headroom 30% | **~250–350 GB** (500 GB con margine replica/backup) |

## 5. Modelli AI / Dataiku — iTree

Dimensionamento **solo modello iTree** (servizi ecosistemici: CO₂, stormwater, energy) su inventario arboreo censito.

| Parametro iTree (Dataiku) | Valore |
|---------------------------|--------|
| CPU Request / Limit | 1 / 2 vCore |
| RAM Request / Limit | 4 / 8 GB |
| Workload | Light — batch per comune |
| Parallelo | 2 job |
| Totale workload | 4 vCore / 16 GB |

| Ambiente | CPU | RAM |
|----------|-----|-----|
| Collaudo / Production | 4 vCore | 16 GB |
| Production Safe | 8 vCore | 32 GB |

## 6. Riferimenti codice

- Cache aree: `cadastre/backend/src/territory/areas/application/usecases/query/cache/catalog_green_area_cache.py`
- Cache asset: `cadastre/backend/src/territory/assets/application/usecases/query/cache/catalog_green_asset_cache.py`
- Controller API: `green_area_ctrl.py`, `green_asset_ctrl.py`
- Benchmark: `cadastre/infrastructure/scripts/database/performance/`
- Architettura target: `docs/design/07-technical-architecture.md`

## 7. Rigenerazione workbook

Approccio **A (clone template)**: i file vengono generati clonando `Fabbisogno_SIM_Globale.xlsx` (cartella `Documentazione/DIMENSIONAMENTO/ESEMPI`) e `dataiku_rsc_cu.xlsx`, sostituendo le righe dati con sole entry SIV e preservando **Foglio1**, AutoFilter, Tabella1/Tabelle Excel, stili e formule. **Foglio1** resta identico al template SIM (catalogo VM di riferimento, elenco Si/No per colonna *Rilasciato*).

```bash
python3 cadastre/docs/sizing/generate_siv_sizing_workbooks.py
```

Output:

- `cadastre/docs/sizing/Fabbisogno_SIV_Catasto_Arboreo.xlsx`
- `cadastre/docs/sizing/dataiku_rsc_siv_catasto.xlsx`
- Copia su Desktop accanto ai template SIM

La metodologia resta in questo file `.md`, non nel workbook Excel.
