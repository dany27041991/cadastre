# ASSET_AREA: stati e eventi temporanei

Questo documento illustra come modellare i **cambi di stato** (amministrativo e operativo) e gli **eventi temporanei** sulle aree verdi, con esempi concreti.

---

## 3. Esempi di cambiamento di stato (senza evento)

**Contesto:** un’area passa da “in progettazione” a “approvata” a “attiva”, senza eventi esterni (es. cantieri).

**ASSET_AREA:**
- `id` = 100  
- `level_id` = FUNCTIONAL_SUBAREA  
- `area_name` = "Area gioco nord"

**Storico stato amministrativo:**

| asset_id | type | value     | start_date  | end_date   |
|----------|------|-----------|-------------|------------|
| 100      | ADMIN | IN_DESIGN | 01-01-2024  | 31-05-2024 |
| 100      | ADMIN | APPROVED  | 01-06-2024  | 31-08-2024 |
| 100      | ADMIN | ACTIVE    | 01-09-2024  | NULL       |

*Tabella di riferimento: storico stati (es. ASSET_STATUS_HISTORY o equivalente).*

---

## 4. Esempio operativo: chiusura temporanea

**Contesto:** parco attivo → chiuso per manutenzione → riaperto.

**ASSET_AREA:** `id` = 10, MANAGEMENT_UNIT "Parco Centrale"

**Storico stato operativo:**

| asset_id | type | value             | start      | end        |
|----------|------|-------------------|------------|------------|
| 10       | OPER | IN_MANAGEMENT     | 01-01-2024 | 14-03-2025 |
| 10       | OPER | TEMPORARILY_CLOSED| 15-03-2025 | 30-03-2025 |
| 10       | OPER | IN_MANAGEMENT     | 31-03-2025 | NULL       |

---

## 5. Evento temporaneo (non è uno stato)

Gli **eventi temporanei** (TEMPORARY_STATE) non cambiano lo stato amministrativo dell’asset; descrivono condizioni che si **sovrappongono** (cantieri, sponsor, concessioni).

**Caso:** dentro il parco viene aperto un cantiere su una porzione. Lo stato amministrativo del parco resta (es. ACTIVE). Si modella l’evento su un’area fisica.

**ASSET_TEMPORARY_EVENT (o equivalente):**

| id | asset_id | event_type       | start_date | end_date   |
|----|----------|------------------|------------|------------|
| 1  | 200      | CONSTRUCTION_SITE| 01-04-2025 | 30-06-2025 |

*(asset_id 200 = PHYSICAL_COMPONENT, es. prato interessato dal cantiere)*

Per la **differenza tra stato ed evento** (mutua esclusività vs sovrapposizione) e i vincoli logici si veda [Vincoli logici](./logical-constraints.md#2-stati-e-eventi-asset_area--asset-verdi).

---

## 6. Esempio completo: strada alberata

**Struttura:** MANAGEMENT_UNIT (fittizia) → LINEAR_COMPONENT (tratta) → POINT_COMPONENT (alberi).

### Caso 1: Albero in emergenza

Stato **operativo** dell’albero (asset puntuale): da in gestione a emergenza, poi ritorno a in gestione.

**ASSET_STATUS_HISTORY (o equivalente):**

| asset_id | type | value         | start      | end        |
|----------|------|---------------|------------|------------|
| 450      | OPER | IN_MANAGEMENT | 01-01-2024 | 10-02-2025 |
| 450      | OPER | EMERGENCY     | 11-02-2025 | 15-02-2025 |
| 450      | OPER | IN_MANAGEMENT | 16-02-2025 | NULL       |

### Caso 2: Tratta stradale in concessione sponsor

Sulla **tratta** (LINEAR_COMPONENT) viene registrato un evento temporaneo (sponsor). Gli alberi sulla tratta restano con stato operativo normale (es. IN_MANAGEMENT).

**ASSET_TEMPORARY_EVENT:**

| asset_id | event_type | start      | end        |
|----------|------------|------------|------------|
| 300      | SPONSOR    | 01-01-2025 | 31-12-2025 |

*(asset_id 300 = tratta stradale)*

---

## Riferimenti

- Livelli e gerarchia: [area-level-table.md](./area-level-table.md).
- Modello dati: [database-mapping-diagram.md](../design/database-mapping-diagram.md) (ASSET_AREA, stati, eventuale ASSET_TEMPORARY_EVENT).
