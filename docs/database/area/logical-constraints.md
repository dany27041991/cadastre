# Vincoli logici – Aree e catalogo verde

Raccolta dei vincoli logici che riguardano livelli gerarchici (AREA_LEVEL), stati/eventi delle aree e catalogo DBT/shapefile. Per contesto e tabelle si rimanda ai documenti di riferimento.

---

## 1. Gerarchia AREA_LEVEL

### 1.1 Matrice parent–child

Il livello figlio deve essere ammesso dalla matrice delle dipendenze (cella ✔ o △). Non sono ammessi salti di livello non previsti.

| PARENT ↓ / CHILD → | MGMT | SUB_MGMT | FUNC | PHYS | LINEAR | POINT |
|--------------------|:----:|:--------:|:----:|:----:|:------:|:-----:|
| MANAGEMENT_UNIT | ✖ | ✔ | ✔ | ✖ | △ | ✖ |
| SUB_MANAGEMENT_UNIT | ✖ | ✖ | ✔ | ✖ | △ | ✖ |
| FUNCTIONAL_SUBAREA | ✖ | ✖ | ✖ | ✔ | ✖ | ✖ |
| PHYSICAL_COMPONENT | ✖ | ✖ | ✖ | ✖ | ✔ | ✔ |
| LINEAR_COMPONENT | ✖ | ✖ | ✖ | ✖ | ✖ | ✔ |
| POINT_COMPONENT | ✖ | ✖ | ✖ | ✖ | ✖ | ✖ |

Legenda: ✔ consentito, ✖ non consentito, △ solo in casi specifici (es. area fittizia stradale).

### 1.2 Regole di coerenza gerarchica

- **Regola 1:** il livello del figlio deve essere ammesso dalla matrice (cella ✔ o △).
- **Regola 2:** non sono ammessi salti di livello non previsti.

**Esempi non validi:**

| Esempio non valido |
|--------------------|
| MANAGEMENT_UNIT → POINT_COMPONENT (il punto deve stare sotto PHYSICAL o LINEAR) |
| FUNCTIONAL_SUBAREA → POINT_COMPONENT (deve passare da PHYSICAL_COMPONENT) |

### 1.3 Livelli trasversali

- **TEMPORARY_STATE:** può sovrapporsi *logicamente* a qualunque livello; non modifica la geometria strutturale e non entra nella gerarchia fisica (sovrapposizione logica, non topologica).
- **GEODETIC_REFERENCE:** non rappresenta verde né fruizione; è fuori gerarchia, strato tecnico di supporto.

---

## 2. Stati e eventi (ASSET_AREA / asset verdi)

### 2.1 Stato amministrativo/operativo

- **Mutuamente esclusivo:** in un dato istante vale un solo stato per asset (es. ACTIVE o DISMISSED, IN_MANAGEMENT o TEMPORARILY_CLOSED).
- Gli stati descrivono *in che condizione si trova* l’asset.

### 2.2 Evento temporaneo (TEMPORARY_STATE)

- **Sovrapponibile:** più eventi possono coesistere sullo stesso asset nello stesso periodo (cantiere, sponsor, concessione, ecc.).
- Non cambia lo stato amministrativo dell’asset; descrive condizioni che si sovrappongono alla gestione ordinaria.

---

## 3. Catalogo DBT e copertura del suolo

### 3.1 Copertura completa e senza sovrapposizioni

- **Ambito:** dentro il perimetro dell’area verde (Fruizione e gestione).
- **Vincoli:**
  - Tutto il suolo deve essere classificato; nessuna zona vuota.
  - Due oggetti non possono occupare la stessa superficie.
  - Tra Vegetazione e Arredo urbano: copertura completa e senza sovrapposizioni.
- **GIS:** i poligoni di Vegetazione e Arredo urbano devono coprire il 100% dell’area, non sovrapporsi e combaciare sui bordi.

| Corretto | Errato |
|----------|--------|
| Es.: 60% prato, 20% aiuole, 15% vialetti, 5% area giochi → tutta la superficie descritta, nessuna sovrapposizione | Prato sotto il vialetto, zone senza classificazione → doppio conteggio, errori nei costi, dati GIS non validi |

### 3.2 Esoneri

- **Manufatti edilizi** (pergolati, tensostrutture, tettoie) possono sovrapporsi agli altri oggetti, dentro la stessa categoria o tra categorie diverse.

---

## 4. Shapefile e vincoli topologici

- **Conformità al catalogo:** codici e geometria secondo il catalogo oggetti (TP, TS, ATT, prefisso S/L/P).
- **Posizionamento:** oggetti di Vegetazione e Arredo urbano devono stare **dentro** le aree di Fruizione e gestione; copertura completa, senza “buchi”.
- **No sovrapposizioni/duplicati:** stessi geometria e attributi non devono sovrapporsi o duplicarsi (es. prato “bucato” dove c’è pavimentazione, non sotto).
- **Dimensioni:** superficie/perimetro derivati dalla geometria (calcolati, non inseriti a mano).
- **Oggetti semplici:** linee e poligoni = una sola entità geometrica per record (no parti disgiunte / oggetti multipli).

---

## Riferimenti

- Livelli e matrice: [area-level-table.md](./area-level-table.md).
- Stati e eventi (esempi): [asset-area-state-and-events.md](./asset-area-state-and-events.md).
- Catalogo e shapefile: [object-catalog-dbt.md](./obt/object-catalog-dbt.md).
