# Tabella completa dei livelli AREA_LEVEL

## Tabella livelli

| Livello (level_name) | Ordine gerarchico | Descrizione semantica | Cosa rappresenta in pratica | Esempi tipici | Note GIS operative |
|----------------------|-------------------|------------------------|-----------------------------|---------------|----------------------|
| **MANAGEMENT_UNIT** | 1 | Unità territoriale base gestita dall’ente | Area di competenza amministrativa del verde | Parco, giardino, viale alberato (area fittizia) | Poligono radice della gerarchia |
| **SUB_MANAGEMENT_UNIT** | 2 | Suddivisione amministrativa interna opzionale | Compartimenti, lotti funzionali, sotto-perimetri | Settore nord del parco, lotto manutentivo | Non sempre presente; necessario nei casi complessi |
| **FUNCTIONAL_SUBAREA** | 3 | Sotto-area definita dall’uso/fruizione | Spazi con funzione specifica per i cittadini | Area gioco, area cani, orti, sport, oasi | Deve stare dentro una MANAGEMENT/SUB unit |
| **PHYSICAL_COMPONENT** | 4 | Superficie fisica omogenea di vegetazione o arredo | Copertura materiale del suolo | Prato, aiuola, pavimentazione, arredo areale | Copertura totale senza buchi né sovrapposizioni |
| **LINEAR_COMPONENT** | 5 | Elemento fisico lineare gestito | Oggetti sviluppati lungo una linea | Tratta stradale, siepe lineare, filare, percorso tecnico | Fondamentale per aree fittizie stradali |
| **POINT_COMPONENT** | 6 | Elemento fisico puntuale | Oggetti discreti sul territorio | Alberi, arredi puntuali, chilometriche, sensori | Livello inventariale minimo |
| **TEMPORARY_STATE** | trasversale | Stato amministrativo o di accessibilità temporaneo | Condizioni che modificano uso o gestione | Cantiere, concessione, sponsor, inaccessibile, attesa censimento | Può sovrapporsi logicamente ad altri livelli (non topologicamente) |
| **GEODETIC_REFERENCE** | fuori gerarchia | Riferimento topografico/cartografico | Punti di controllo del rilievo | Vertici di stazione, vertici d’inquadramento | Non rappresenta verde né fruizione |

---

## Lettura gerarchica sintetica

```
MANAGEMENT_UNIT
   └── SUB_MANAGEMENT_UNIT (opzionale)
         └── FUNCTIONAL_SUBAREA
               └── PHYSICAL_COMPONENT
                     ├── LINEAR_COMPONENT
                     └── POINT_COMPONENT

Elementi trasversali:
   TEMPORARY_STATE
   GEODETIC_REFERENCE
```

---

## Matrice delle dipendenze tra livelli

**Legenda:** ✔ = consentito · ✖ = non consentito · △ = consentito solo in casi specifici

*Cella = può il livello in riga (PARENT) contenere il livello in colonna (CHILD)?*

| PARENT ↓ / CHILD → | MGMT | SUB_MGMT | FUNC | PHYS | LINEAR | POINT |
|--------------------|:----:|:--------:|:----:|:----:|:------:|:-----:|
| MANAGEMENT_UNIT | ✖ | ✔ | ✔ | ✖ | △ | ✖ |
| SUB_MANAGEMENT_UNIT | ✖ | ✖ | ✔ | ✖ | △ | ✖ |
| FUNCTIONAL_SUBAREA | ✖ | ✖ | ✖ | ✔ | ✖ | ✖ |
| PHYSICAL_COMPONENT | ✖ | ✖ | ✖ | ✖ | ✔ | ✔ |
| LINEAR_COMPONENT | ✖ | ✖ | ✖ | ✖ | ✖ | ✔ |
| POINT_COMPONENT | ✖ | ✖ | ✖ | ✖ | ✖ | ✖ |

### Interpretazione

- **MANAGEMENT_UNIT** può contenere: SUB_MANAGEMENT_UNIT, FUNCTIONAL_SUBAREA; △ LINEAR_COMPONENT solo in area fittizia stradale.
- **SUB_MANAGEMENT_UNIT** può contenere: FUNCTIONAL_SUBAREA; △ LINEAR_COMPONENT solo in casi specifici (es. area fittizia).
- **FUNCTIONAL_SUBAREA** contiene solo **PHYSICAL_COMPONENT**. Non può contenere direttamente punti o linee; deve passare dal livello fisico.
- **PHYSICAL_COMPONENT** contiene: LINEAR_COMPONENT, POINT_COMPONENT (es. prato → alberi; pavimentazione → arredi).
- **LINEAR_COMPONENT** può contenere: POINT_COMPONENT (es. tratta stradale → alberi; vialetto → lampioni).
- **POINT_COMPONENT** è foglia terminale della gerarchia (non contiene altri livelli).

Per le **regole di coerenza gerarchica** e i vincoli (salto di livello, esempi non validi) si veda [Vincoli logici](./logical-constraints.md#1-gerarchia-area_level).

---

## I due livelli trasversali: TEMPORARY_STATE e GEODETIC_REFERENCE

Sono gli unici due livelli che **non seguono la gerarchia principale** e sono fondamentali per un sistema GIS robusto.

---

### 1. TEMPORARY_STATE (elemento trasversale logico–amministrativo)

**Cos’è:** non è una parte fisica dell’area, ma una **condizione temporanea** che modifica accessibilità, responsabilità, gestione e manutenzione.

**Perché è “trasversale”:** può riferirsi a qualunque livello (MANAGEMENT_UNIT intera, FUNCTIONAL_SUBAREA, PHYSICAL_COMPONENT, LINEAR_COMPONENT, POINT_COMPONENT). Non modifica la geometria strutturale e non entra nella gerarchia fisica: è una sovrapposizione *logica*, non topologica.

| Caso | Cosa succede |
|------|--------------|
| Area cantiere | Porzione temporaneamente non fruibile |
| Concessione | Area data in gestione a terzi |
| Sponsor | Area con responsabilità manutentiva diversa |
| Inaccessibile | Chiusura per sicurezza |
| Attesa censimento | Stato inventariale |

**Implementazione GIS:** (A) layer dedicato con poligoni temporanei (data_inizio, data_fine, tipo_stato, riferimento_entità); (B) tabella relazionale senza geometria con FK verso l’oggetto interessato — relazione N:1 temporale, senza duplicazione geometrica.

---

### 2. GEODETIC_REFERENCE (elemento tecnico-cartografico)

**Cos’è:** non è verde, non è fruizione, non è gestione. È un **riferimento topografico** per precisione geometrica.

**Esempi:** vertici di stazione totale, caposaldi GPS, vertici d’inquadramento, punti fiduciali catastali. Servono per rilievo, controllo qualità, georeferenziazione, allineamento nel tempo.

**Perché è “fuori gerarchia”:** non appartiene a MANAGEMENT_UNIT, FUNCTIONAL_SUBAREA né PHYSICAL_COMPONENT. È uno strato tecnico di supporto: può servire per tutto, ma non è parte di nulla.

---

### Differenza tra i due

| | TEMPORARY_STATE | GEODETIC_REFERENCE |
|---|------------------|---------------------|
| È fisico? | No | Sì (punto reale sul terreno) |
| È parte del verde? | No | No |
| Influenza la gestione? | Sì | No |
| Influenza la precisione cartografica? | Indirettamente | Sì |
| È temporale? | Sì | No (normalmente stabile) |

---

### In sintesi

- **Gerarchia principale** → descrive *cosa è* e *come è fatto* il territorio.
- **TEMPORARY_STATE** → descrive *in che condizione si trova*.
- **GEODETIC_REFERENCE** → descrive *come lo misuro con precisione*.

---

## Perché questa tabella è “completa”

Copre contemporaneamente:

- **Livello 1 normativo** → MANAGEMENT_UNIT  
- **Fruizione e gestione** → FUNCTIONAL_SUBAREA + TEMPORARY_STATE  
- **Inventario fisico** → PHYSICAL / LINEAR / POINT  
- **Topografia** → GEODETIC_REFERENCE  

Ed è:

- stabile nel tempo  
- indipendente da tipologie specifiche  
- pronta per PostGIS, QGIS, GeoPackage, Digital Twin urbano  

---

## Esempi d’uso

### 1) Area verde reale (parco, giardino)

```
[Poligono grande = AREA DI GESTIONE (Livello 1)]
        │
        ├── [Poligoni interni = AREE FUNZIONALI (Livello 2)]
        │         ├── area gioco
        │         ├── area sport
        │         ├── area cani
        │         ├── orti / oasi / ecc.
        │         └── superfici vegetazione e arredo
        │              → copertura totale senza buchi né sovrapposizioni
        │
        ├── [Linee = RETI E PERCORSI]
        │         ├── vialetti pedonali
        │         ├── percorsi ciclabili
        │         └── eventuali reti tecniche
        │
        └── [Punti = ELEMENTI PUNTUALI (Livello 3)]
                  ├── alberi
                  ├── arredi (panchine, giochi, cestini…)
                  └── vertici topografici
```

Il poligono grande è fruibile; tutto ciò che sta dentro descrive uso reale e componenti fisiche.

### 2) Area stradale alberata (area fittizia)

```
[Poligono largo = AREA FITTIZIA DI GESTIONE (Livello 1)]
        │
        └── [Linea centrale = GRAFO TRATTA STRADALE IN GESTIONE (Livello 2)]
                │
                ├── [Punti = ALBERI STRADALI (Livello 3)]
                │
                ├── [Punti = CHILOMETRICHE / RIFERIMENTI]
                │
                └── [Piccoli poligoni opzionali = TORNELLI o CIGLI]
```

La gestione effettiva è lineare, non areale; il poligono è solo contenitore amministrativo e non rappresenta fruizione verde.

### 3) Casi temporanei (cantieri, concessioni, sponsor)

Valido sia per parchi sia per aree stradali:

```
[DENTRO AREA DI GESTIONE]
        │
        └── [Poligoni temporanei = STATO AMMINISTRATIVO]
                ├── area cantiere
                ├── area in concessione
                ├── area sponsor
                └── area temporaneamente inaccessibile
```

Modificano accessibilità, responsabilità e manutenzione, non la struttura fisica di base.

### 4) Strato geodetico

```
[Sistema territoriale]
        ├── punti = vertici di stazione
        └── punti = vertici d’inquadramento
```

Servono per precisione cartografica; non appartengono alla fruizione.

---

## Riassunto ultra-sintetico

| Contesto | Struttura |
|----------|-----------|
| **Parco reale** | Poligono area → poligoni funzionali, linee percorsi, punti alberi/arredi |
| **Strada alberata** | Poligono fittizio → linea tratta stradale → punti alberi, punti chilometrici |

---

## Riferimenti

- Vincoli gerarchia e livelli: [logical-constraints.md](./logical-constraints.md#1-gerarchia-area_level).
- Entità AREA_LEVEL e relazioni: [database-mapping-diagram.md](../design/database-mapping-diagram.md).
