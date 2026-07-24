# Dimensionamento risorse hardware — Kubernetes

**Data:** 2026-07-08  
**Progetto:** Municipal Arboreal Cadastre (catasto verde comunale)  
**Ambiente target:** Kubernetes (produzione nazionale)  
**Stato:** bozza per revisione infrastruttura

---

## 1. Scopo e perimetro

Il documento definisce il dimensionamento delle risorse hardware (CPU, RAM, storage, rete) per il deployment Kubernetes della piattaforma **cadastre**, coprendo:

| Componente | In perimetro | Note |
|------------|:------------:|------|
| Backend FastAPI | ✓ | API territorio, aree verdi, asset verdi |
| Frontend React (nginx) | ✓ | Bundle statico in produzione |
| PostgreSQL + PostGIS | ✓ | Database primario + read replica |
| Geoinsight / WebGIS MASE | ✗ | Servizio esterno; requisiti client documentati |
| Hazelcast / cache distribuita | ✗ | Escluso per scelta; analisi con cache in-process |
| ClickHouse / Redis | ✗ | Non presenti nello stack compose attuale |

---

## 2. Assunzioni di base

| Parametro | Valore | Fonte |
|-----------|--------|-------|
| Comuni italiani | **~8.000** | ISTAT (~7.900; arrotondato) |
| Utenti concorrenti picco | **300–800** | Stima SaaS nazionale ore lavorative |
| Scenario dati di riferimento | **Target** | Censimento maturo su tutti i comuni |
| Worker uvicorn per pod backend | **1** | Evita duplicazione cache in-process |
| Cache backend | **In-process** (`CompressedLRUCache` / `CompressedTTLCache`) | Nessun Hazelcast |
| Formato risposta mappa | **geobuf** | Frontend decodifica in GeoJSON |

---

## 3. Stima volumi dati nazionali

### 3.1 Scenari di popolamento

| Scenario | Ipotesi | Asset verdi nazionali | Aree verdi nazionali | Asset/comune medio |
|----------|---------|----------------------:|---------------------:|-------------------:|
| **Conservativo** | Adozione parziale (stato attuale Legge 10/2013) | 15–25 M | 0,4–0,8 M | ~2.500 |
| **Target** ★ | Censimento maturo su tutti i comuni | **50–70 M** | **1,5–2,5 M** | **~7.500** |
| **Stress test** | Seed `populate_region_data.sql` su tutta Italia | 100–130 M | 3–5,5 M | ~15.000 |

★ Lo scenario **Target** è usato per tutto il dimensionamento infrastrutturale di questo documento.

### 3.2 Distribuzione per fascia comunale

| Fascia | N° comuni | Abitanti tipici | Asset/comune | Aree/comune |
|--------|----------:|-----------------|-------------:|------------:|
| Piccoli | ~5.500 | < 5.000 | 1.500–3.000 | 80–150 |
| Medi | ~2.000 | 5.000–50.000 | 5.000–15.000 | 200–500 |
| Grandi | ~400 | > 50.000 | 30.000–80.000 | 800–2.000 |
| Metropoli | ~100 | Capoluoghi / CMM | 200.000–500.000 | 1.500–2.000 |

**Riferimenti interni al progetto:**

| Riferimento | Valore |
|-------------|--------|
| Lazio + Lombardia (seed parziale) | ~8,7 M asset testati |
| Roma (`run_boost_municipality.sh`) | ~1.600 aree, ~320k alberi, ~119k filari |
| ISTAT (solo capoluoghi, alberi censiti) | ~2–3,6 M alberi (dato parziale) |

### 3.3 Storage database stimato (scenario Target)

| Componente | Dimensione stimata |
|------------|-------------------:|
| `green_assets` (dati + indici GIST) | 150–250 GB |
| `green_areas` (poligoni + indici GIST) | 50–80 GB |
| Territorio ISTAT + catalogo DBT + traduzioni | ~5 GB |
| Storico (`asset_area_history`, `asset_green_history`) | 40–80 GB |
| WAL, vacuum, crescita 3 anni (~20%) | 40% buffer |
| **PVC primario PostGIS** | **~400–500 GB** |
| Backup (snapshot 7 giorni) | +800 GB |
| **Totale storage con backup** | **~1,2 TB** |

---

## 4. Architettura cache backend (impatto RAM)

### 4.1 Implementazione attuale

| Cache | Classe | Max entry | TTL | Chiave | Contenuto |
|-------|--------|----------:|-----|--------|-----------|
| Asset verdi mappa | `CompressedLRUCache` | **2.048** | — | `(region_id, province_id, municipality_id[, sub_municipal_area_id])` | FeatureCollection GeoJSON intero |
| Aree verdi mappa | `CompressedLRUCache` | **2.048** | — | idem | FeatureCollection GeoJSON intero |
| Regioni | `CompressedTTLCache` | 1 | 24 h | — | GeoJSON regioni |
| Province | `CompressedTTLCache` | 64 | 24 h | `region_id` | GeoJSON province |
| Comuni | `CompressedTTLCache` | 128 | 24 h | `province_id` | GeoJSON comuni |
| Sub-comunali | `CompressedTTLCache` | 256 | 24 h | `municipality_id` | GeoJSON ASC |

**File sorgente:** `backend/src/core/cache/__init__.py`, `backend/src/territory/*/application/usecases/query/cache/`.

### 4.2 Flusso memoria per richiesta mappa (anche cache hit)

```
LRU (LZMA+pickle) → decompress → GeoJSON dict in RAM → geobuf.encode() → response HTTP
```

| Effetto | Impatto |
|---------|---------|
| Storage in LRU | Compressa (LZMA preset 9) |
| Per ogni richiesta | Decompressione completa del comune in RAM |
| Multi-worker | Ogni worker = LRU separata (duplicazione) |
| Multi-pod | Ogni pod = LRU separata (duplicazione cluster) |
| Endpoint `/table` | **Mai cachati** — sempre query DB |

### 4.3 Dimensione entry cache (solo asset mappa)

L'API mappa espone per feature: `id`, `geometry`, `asset_type`, `geometry_type`, `species`.

| Tipo comune | Asset | GeoJSON decompresso | In LRU (compresso) |
|-------------|------:|--------------------:|-------------------:|
| Piccolo | ~2.000 | 1–2 MB | 80–150 KB |
| Medio | ~10.000 | 5–8 MB | 400–800 KB |
| Grande | ~50.000 | 25–40 MB | 2–4 MB |
| Metropoli | ~300.000 | 80–120 MB | 8–15 MB |

### 4.4 Worst case: tutti gli 8.000 comuni in cache (1 worker, solo asset)

| Scenario | RAM backend |
|----------|------------:|
| Solo storage LRU compressa (steady state) | 4–5 GB |
| + base Python/FastAPI/connessioni | 5–6 GB |
| + picco decompressione concorrente (10 comuni grandi) | **8–10 GB** |
| + anche aree verdi (seconda LRU) | **+3–4 GB** |

> **Nota:** con `maxsize=2048` attuale non è possibile cachare tutti gli 8.000 comuni; il worst case richiederebbe `maxsize ≥ 8000`.

---

## 5. Pipeline geometrie frontend (impatto client)

### 5.1 Comportamento per layer

| Layer | Clustering | Caricamento |
|-------|:----------:|-------------|
| Aree verdi | No (`skipClustering: true`) | Tutti i poligoni del comune → WKT → Geoinsight |
| Asset verdi | Sì (zoom 10–13 precalcolati; raw a zoom ≥ 14) | **Intero comune** in un fetch geobuf |

### 5.2 Soglie progetto

| Soglia | Significato | Riferimento |
|--------|-------------|-------------|
| ≥ 10.000 feature | UI responsiva, freeze < 2 s | Spike plan G4 |
| > 50.000 feature | Blocker `addGeometries` Geoinsight | Spike plan B1 |
| ~300.000 feature | Non gestibile client-side oggi | Roma boost seed |

### 5.3 RAM browser per sessione utente

| Comune tipo | Asset | geobuf wire | RAM tab browser (stima) |
|-------------|------:|------------:|------------------------:|
| Piccolo | 1–3k | 100–400 KB | 15–30 MB |
| Medio | 5–15k | 0,5–2 MB | 30–60 MB |
| Grande | 50–80k | 4–8 MB | 150–250 MB ⚠️ |
| Metropoli | 300–500k | 20–40 MB | 800 MB–1,5 GB ❌ |

Il pod frontend nginx è leggero; il vincolo GIS è **lato browser** + servizio Geoinsight esterno.

---

## 6. Dimensionamento per ambiente

### 6.1 Sviluppo

| Componente | Repliche | CPU req / limit | RAM req / limit | Storage |
|------------|----------|-----------------|-----------------|---------|
| Backend FastAPI | 1 | 0,5 / 1 | 1 Gi / 2 Gi | — |
| Frontend (nginx) | 1 | 0,1 / 0,25 | 128 Mi / 256 Mi | — |
| PostGIS | 1 | 1 / 2 | 4 Gi / 8 Gi | 50 Gi PVC |
| **Totale nodo** | | **~2 CPU** | **~10 Gi** | **50 Gi** |

Dati: 1–2 regioni seed (< 1 M asset).

### 6.2 Collaudo / Staging

| Componente | Repliche | CPU req / limit | RAM req / limit | Storage |
|------------|----------|-----------------|-----------------|---------|
| Backend FastAPI | 2 | 0,5 / 1 | 2 Gi / 4 Gi | — |
| Frontend (nginx) | 2 | 0,1 / 0,25 | 128 Mi / 256 Mi | — |
| PostGIS | 1 | 2 / 4 | 8 Gi / 16 Gi | 150 Gi PVC |
| **Totale cluster** | | **~5 CPU** | **~27 Gi** | **150 Gi** |

Dati: 5–10 M asset (2–4 regioni).

### 6.3 Produzione nazionale (scenario Target) ★

#### 6.3.1 Backend FastAPI

| Parametro | Valore | Motivazione |
|-----------|--------|-------------|
| Repliche min (HPA) | **6** | Disponibilità + distribuzione carico |
| Repliche max (HPA) | **20** | CPU > 65% per 3 min |
| Workers/pod | **1** | Una LRU per processo |
| CPU request / limit | **1 / 2** | LZMA decompress + geobuf encode |
| RAM request / limit | **4 Gi / 8 Gi** | Cache warm + picchi decompressione |
| HPA metric | CPU | RAM non adatta ad autoscaling reattivo |

**Comando produzione consigliato:**

```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --workers 1
```

#### 6.3.2 Frontend (nginx + bundle statico)

| Parametro | Valore |
|-----------|--------|
| Repliche | 2–3 |
| CPU request / limit | 0,1 / 0,25 |
| RAM request / limit | 128 Mi / 256 Mi |
| CDN | Obbligatoria per asset statici (~5–10 MB bundle) |
| Build | `npm run build` — **non** Vite dev server |

#### 6.3.3 PostGIS primary

| Parametro | Valore |
|-----------|--------|
| CPU request / limit | 8 / 16 |
| RAM request / limit | 64 Gi / 128 Gi |
| `shared_buffers` | 16 GB |
| `work_mem` | 256 MB |
| `effective_cache_size` | 48 GB |
| `shm_size` | 16 Gi |
| Storage PVC | 500 Gi NVMe (`ReadWriteOnce`) |
| `max_connections` | 200 | Connessioni dirette + pool SQLAlchemy |

#### 6.3.4 PostGIS read replica

| Parametro | Valore |
|-----------|--------|
| Repliche | 1 |
| CPU request / limit | 4 / 8 |
| RAM request / limit | 32 Gi / 64 Gi |
| Storage PVC | 500 Gi NVMe |
| Uso | Solo GET mappa / cataloghi territoriali |

---

## 7. RAM backend — scenari cluster (12 pod, no Hazelcast)

Assunzioni: 12 pod backend, 1 worker/pod, cache in-process indipendente.

### 7.1 Distribuzione traffico

| Fascia | Comuni | % richieste | Compressa/entry |
|--------|-------:|------------:|----------------:|
| Hot (capoluoghi, grandi) | ~100 | ~40% | 3–12 MB |
| Warm (medi) | ~1.900 | ~45% | 400–800 KB |
| Cold (piccoli) | ~6.000 | ~15% | 80–150 KB |

### 7.2 Scenario A — Realistico (cache parziale warm)

Ogni pod dopo warm-up: ~1.080 entry (~80 hot + 600 warm + 400 cold).

| | Per pod | Cluster (×12) |
|--|--------:|--------------:|
| Cache compressa | 0,8–1,0 GB | — |
| Base processo | 0,5 GB | — |
| **Steady state** | **1,2–1,5 GB** | **~17 GB** |
| Picco (+5 richieste grandi concorrenti) | 2,0–2,5 GB | **~26 GB** |

Duplicazione hot stimata: ~80 comuni × ~5 MB × 12 pod ≈ **4,8 GB** di dati identici replicati.

### 7.3 Scenario B — Worst case duplicazione (`maxsize=2048`)

Tutti i 12 pod convergono sugli stessi 2.048 comuni più richiesti.

| | Per pod | Cluster (×12) |
|--|--------:|--------------:|
| **Steady state** | 1,5–2,0 GB | **~20–24 GB** |
| **Picco** | 2,5–3,0 GB | **~30–36 GB** |

Comuni unici coperti cluster-wide: **2.048** (non 8.000).

### 7.4 Scenario C — Worst case assoluto (8.000 comuni × 12 pod)

Richiede `maxsize ≥ 8000` su ogni LRU.

| | Per pod | Cluster (×12) |
|--|--------:|--------------:|
| Solo asset (compressi) | ~5 GB | **~60 GB** |
| + picco | 8–10 GB | **~96–120 GB** |
| + aree verdi | +4 GB | **+48 GB** |

**Da evitare:** replica completa del dataset nazionale su ogni pod.

### 7.5 Scenario D — Raccomandato (`maxsize=512`)

| | Per pod | Cluster (×12) |
|--|--------:|--------------:|
| **Steady state** | ~1,0 GB | **~12 GB** |
| **Picco** | ~1,8 GB | **~22 GB** |

Union LRU cluster: ~3.000–4.000 comuni distinti coperti senza spreco.

### 7.6 Sintesi scenari backend (12 pod)

| Scenario | `maxsize` | RAM cluster steady | RAM cluster peak | Raccomandato |
|----------|----------:|-------------------:|-----------------:|:------------:|
| D — ottimizzato | 512 | ~12 GB | ~22 GB | ✓ |
| A — realistico | 2048 | ~17 GB | ~26 GB | ✓ |
| B — duplicazione hot | 2048 | ~24 GB | ~36 GB | ⚠️ |
| C — 8.000 × 12 pod | ≥ 8000 | ~60 GB | ~120 GB | ✗ |

---

## 8. Totale risorse cluster Kubernetes

### 8.1 Produzione — Scenario A (realistico, 12 pod backend)

| Componente | Repliche | CPU req | CPU limit | RAM req | RAM limit | Storage |
|------------|----------|--------:|----------:|--------:|----------:|--------:|
| Backend FastAPI | 12 | 12 | 24 | 48 Gi | 96 Gi | — |
| Frontend nginx | 3 | 0,3 | 0,75 | 384 Mi | 768 Mi | — |
| PostGIS primary | 1 | 8 | 16 | 64 Gi | 128 Gi | 500 Gi |
| PostGIS replica | 1 | 4 | 8 | 32 Gi | 64 Gi | 500 Gi |
| Ingress / monitoring | — | 1 | 2 | 1 Gi | 2 Gi | — |
| **Totale** | | **~25 CPU** | **~51 CPU** | **~145 Gi** | **~291 Gi** | **1,0 Ti** |

| | RAM |
|--|-----|
| **Steady state (effettivo)** | **~115 Gi** |
| **Peak (effettivo)** | **~135 Gi** |

### 8.2 Produzione — Scenario B (worst case duplicazione cache)

| | RAM cluster totale |
|--|-------------------:|
| Steady state | ~118 Gi |
| Peak | ~150 Gi |

### 8.3 Produzione — Scenario C (worst case assoluto)

| | RAM cluster totale |
|--|-------------------:|
| Steady state | ~158 Gi |
| Peak | ~230 Gi |

### 8.4 Riepilogo CPU/RAM/Storage per ambiente

| Ambiente | CPU (req) | RAM (req) | Storage | Backend pod |
|----------|----------:|----------:|--------:|------------:|
| Sviluppo | ~2 | ~10 Gi | 50 Gi | 1 |
| Collaudo | ~6 | ~28 Gi | 150 Gi | 2 |
| **Produzione** ★ | **~26** | **~146 Gi** | **1,0 Ti** | **6–20 (HPA)** |

---

## 9. Requisiti client (browser)

Il carico GIS principale non è sul pod frontend ma sulla postazione utente.

| Profilo | RAM tab browser | Comuni supportati |
|---------|----------------:|-------------------|
| Minimo | 4 GB disponibili | Piccoli/medi (< 15k asset) |
| Raccomandato | 8 GB disponibili | Tutti tranne metropoli |
| Metropoli | Layer WebGIS (D2) | Roma, Milano, Napoli, Torino |

Per comuni > **50.000 asset** (~30–50 su 8.000, < 1%): usare `sub_municipal_area_id` nell'API o layer WebGIS pubblicati.

---

## 10. Rete e bandwidth

### 10.1 Payload tipici per sessione

| Operazione | Payload | Frequenza |
|------------|--------:|-----------|
| Drill regione → provincia → comune | 50 KB – 2 MB (geobuf) | Per navigazione |
| Caricamento asset comune medio | 0,5–2 MB (geobuf) | Per toggle layer |
| Caricamento asset metropoli | 20–40 MB (geobuf) | Raro; da evitare |
| Tabella paginata (`/table`) | 10–50 KB/pagina | Continuo |

### 10.2 Bandwidth cluster (picco 500 utenti attivi su mappa)

| Calcolo | Valore |
|---------|--------|
| 500 utenti × 2 MB asset/comune medio | ~1 GB burst |
| Durata burst tipica | 30–60 s |
| Throughput medio picco | **150–300 Mbps** uscente dal backend |

---

## 11. Manifest Kubernetes di riferimento

### 11.1 Backend Deployment (estratto)

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: cadastre-backend
spec:
  replicas: 6
  template:
    spec:
      containers:
        - name: backend
          image: cadastre-backend:latest
          command: ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
          resources:
            requests:
              cpu: "1"
              memory: "4Gi"
            limits:
              cpu: "2"
              memory: "8Gi"
          readinessProbe:
            httpGet:
              path: /health
              port: 8000
            initialDelaySeconds: 10
            periodSeconds: 15
---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: cadastre-backend-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: cadastre-backend
  minReplicas: 6
  maxReplicas: 20
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 65
```

### 11.2 PostGIS StatefulSet (estratto)

```yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: postgis-primary
spec:
  replicas: 1
  template:
    spec:
      containers:
        - name: postgis
          image: postgis/postgis:16-3.4
          resources:
            requests:
              cpu: "8"
              memory: "64Gi"
            limits:
              cpu: "16"
              memory: "128Gi"
          volumeMounts:
            - name: data
              mountPath: /var/lib/postgresql/data
          env:
            - name: POSTGRES_DB
              value: arboreal_green_cadastre
  volumeClaimTemplates:
    - metadata:
        name: data
      spec:
        accessModes: ["ReadWriteOnce"]
        resources:
          requests:
            storage: 500Gi
        storageClassName: fast-ssd
```

---

## 12. Raccomandazioni e azioni prioritarie

| Priorità | Azione | Impatto |
|:--------:|--------|---------|
| **P0** | `maxsize` LRU configurabile via env (default **512**) | RAM cluster −50% |
| **P0** | 1 worker uvicorn per pod | Evita duplicazione intra-pod |
| **P1** | Cachare **bytes geobuf** già encodati, non dict GeoJSON | −CPU e −RAM per richiesta |
| **P1** | Obbligare scope `sub_municipal_area_id` per comuni > 50k asset | Sblocca metropoli |
| **P2** | Sticky session (opzionale) | Migliora hit rate LRU |
| **P2** | Read replica PostGIS per GET mappa | −carico sul primary |
| **P3** | Layer WebGIS (D2) per metropoli | Elimina blocker 50k+ feature |

---

## 13. Parametri PostgreSQL produzione

| Parametro | Valore | Note |
|-----------|--------|------|
| `shared_buffers` | 16 GB | ~25% RAM |
| `effective_cache_size` | 48 GB | ~75% RAM |
| `work_mem` | 256 MB | Query spaziali |
| `maintenance_work_mem` | 1 GB | VACUUM, CREATE INDEX |
| `max_parallel_workers_per_gather` | 4 | Allineato a `optimization_analysis.md` |
| `max_connections` | 200 | SQLAlchemy pool in-process per pod backend |
| `shm_size` (K8s) | 16 Gi | `emptyDir` medium Memory |

---

## 14. Riferimenti codice e documentazione

| Argomento | Percorso |
|-----------|----------|
| Cache compressa | `backend/src/core/cache/__init__.py` |
| Cache asset verdi | `backend/src/territory/assets/application/usecases/query/cache/catalog_green_asset_cache.py` |
| Cache aree verdi | `backend/src/territory/areas/application/usecases/query/cache/catalog_green_area_cache.py` |
| Clustering client | `frontend/src/features/territory/lib/greenAssetClusterCore.ts` |
| Adapter Geoinsight | `frontend/src/features/territory-map-geoinsight/model/geoinsightMapAdapter.ts` |
| Soglie performance | `docs/design/geoinsight-migration-spike-plan.md` |
| Ottimizzazione query | `docs/database/design/optimization/optimization_analysis.md` |
| Seed volumi | `infrastructure/scripts/database/seed/populate_region_data/seed_populate_region_data.sql` |
| Diagramma ER | `docs/database/design/database-mapping-diagram.md` |

---

## 15. Decisioni da confermare

| # | Decisione | Opzioni | Raccomandazione |
|---|-----------|---------|-----------------|
| D1 | `maxsize` LRU produzione | 256 / **512** / 2048 | **512** |
| D2 | Repliche backend min | 4 / **6** / 8 | **6** |
| D3 | Read replica PostGIS al go-live | Sì / **No** | **Sì** se > 200 utenti concorrenti |
| D4 | CDN frontend | Sì / No | **Sì** |
| D5 | Sticky session backend | Sì / **No** | No (valutare post go-live) |

---

*Documento generato il 2026-07-08. Da aggiornare dopo benchmark su dati seed reali (Lazio, Roma boost) e prima del go-live produzione.*
