# Catalogo oggetti DBT: Tipi principali, secondari e attributi

## Struttura logica

Il catalogo organizza gli oggetti del verde in tre livelli:

| Livello | Sigla | Ruolo |
|--------|--------|--------|
| **Tipi Principali** | TP | Macro-categorie |
| **Tipi Secondari** | TS | Dettaglio tipologico |
| **Attributi** | ATT | Caratteristiche manutentive |

**Codice oggetto:** `TXYYZZZ` (7 caratteri alfanumerici)  
**Prefisso geometrico:** `S` = superficie, `L` = linea, `P` = punto  
*(Usato nel formato GIS shapefile .SHP.)*

**Codifica:** `Geometria (S/L/P) + TP + TS + ATT`  
*Esempio: Albero → P (punto) + 1 (Vegetazione) + 03 (Pianta) + 108 (Albero) = **P103108***

---

## Criteri di strutturazione

1. **Geometria** definita in base all'unità di misura manutentiva (punto, linea, superficie).
2. **Quattro Tipi Principali (TP):**
   - **1 – Vegetazione:** elementi vegetali (alberi, siepi, prati, ecc.).
   - **2 – Arredo urbano:** manufatti per la fruizione (panchine, pavimentazioni, cestini, ecc.).
   - **3 – Fruizione e gestione:** perimetri, aree funzionali e speciali.
   - **4 – Fattori ambientali:** elementi esterni che influenzano gestione e manutenzione.

Si distinguono elementi obbligatori per la gestione del verde ed elementi facoltativi integrabili nel tempo.

Per la **regola di copertura completa e senza sovrapposizioni** (e relativi vincoli GIS) si veda [Vincoli logici](../logical-constraints.md#3-catalogo-dbt-e-copertura-del-suolo).  

### Tabella 1 – Esempi per Tipo principale e geometria

| Tipi principali | Punto | Linea | Superficie |
|----------------|-------|------|------------|
| 1 Vegetazione | Albero | Siepe | Prato |
| 2 Arredo urbano | Cestino | Cordolo | Pavimentazione |
| 3 Fruizione e gestione | – | – | Area gioco |
| 4 Fattori ambientali | – | – | Area proliferazione agenti infestanti |

### Tabella 2 – Tipi Principali (TP)

Elenco completo: [primary_types.md](types/primary_types.md).

| Codice TP | Tipo principale |
|-----------|------------------|
| 1 | Vegetazione |
| 2 | Arredo Urbano |
| 3 | Fruizione e Gestione |
| 4 | Fattori Ambientali |

### Tabella 3 – Tipi Secondari (TS)

Elenco completo: [secondary_types.md](types/secondary_types.md).

| Codice TS | Tipo secondario |
|-----------|------------------|
| 01 | Prato |
| 02 | Aiuola |
| 03 | Pianta |
| 04 | Specchio d'acqua |
| 05 | Area pavimentata |
| 06 | Impianti sportivi - pallavolo/basket |
| 07 | Impianti sportivi - campo bocce |
| 08 | Impianti sportivi - pista pattinaggio |
| 09 | Impianti sportivi - calcio |
| 10 | Impianti sportivi - calcetto |
| 11 | Impianti sportivi - altro |
| 12 | Edificio |
| 13 | Manufatto edilizio architettonico |
| 14 | Manufatto arredo urbano |
| 15 | Muro |
| 16 | Cordolo |
| 17 | Recinzione |
| 18 | Cancello |
| 19 | Panchina |
| 20 | Canalina scolo acque |
| 21 | Pozzetto |
| 22 | Fontanella |
| 23 | Idrante |
| 24 | Cestino |
| 25 | Area convenzionata |
| 26 | Area assegnazione temporanea |
| 27 | Area funzionale |
| 28 | Impianti sportivi - pista ciclabile |
| 29 | Impianti sportivi - piattaforma skateboard |
| 30 | Accesso |
| 31 | Scala/Rampa |
| 32 | Elemento del sistema di irrigazione |
| 33–39 | Impianti sportivi (rugby, tennis, softball, baseball, atletica, mini calcio, mini basket) |
| 40 | Area soggetta a malattie |
| 41 | Infrastrutture |
| 42 | Pavimentazioni antitrauma |
| 43 | Analisi specialistiche |
| 50 | Eventi accidentali |
| 99 | Informazione geodetica |

### Tabella 4 – Tipi Attributi (estratto)

Elenco completo: [attribute_types.md](types/attribute_types.md).

| Codice ATT | Descrizione |
|------------|-------------|
| 000 | generico |
| 001 | sabbia |
| 002 | ghiaia |
| 003 | calcestre |
| 004 | pietra naturale |
| 005 | asfalto |
| 006 | autobloccanti |
| 007 | lastre cls |
| 008 | ciotoli |
| … | … |
| 108 | albero |
| 109 | cespuglio |
| … | … |

---

## Esempi per Tipo principale

### TP = 1 Vegetazione

| Esempio | Oggetto | Geometria | TS | ATT | Codice GIS | Uso |
|---------|---------|-----------|---|-----|------------|-----|
| A | Albero ornamentale | P | 03 Pianta | 108 Albero | **P103108** | Potature, monitoraggio fitosanitario, patrimonio arboreo |
| B | Prato ornamentale | S | 01 Prato | 000 generico | **S101000** | Sfalcio, irrigazione, concimazione |

### TP = 2 Arredo urbano

| Esempio | Oggetto | Geometria | TS | ATT | Codice GIS | Uso |
|---------|---------|-----------|---|-----|------------|-----|
| C | Panchina in pietra | L | 19 Panchina | 004 pietra naturale | **L219004** | Manutenzione materiale, inventario arredi |
| D | Pavimentazione autobloccanti | S | 05 Area pavimentata | 006 autobloccanti | **S205006** | Manutenzione pavimentazioni |

### TP = 3 Fruizione e gestione

| Esempio | Oggetto | Geometria | TS | ATT | Codice GIS | Uso |
|---------|---------|-----------|---|-----|------------|-----|
| E | Area giochi bambini | S | 27 Area funzionale | 000 generico | **S327000** | Sicurezza, manutenzioni, responsabilità amministrativa |

### TP = 4 Fattori ambientali

| Esempio | Oggetto | Geometria | TS | ATT | Codice GIS | Impatto |
|---------|---------|-----------|---|-----|------------|---------|
| F | Fascia sotto linea tranviaria | S | 41 Infrastrutture | 000 generico | **S441000** | Limita altezza alberi, potature specifiche, sicurezza |

---

## 2.2 Shapefile di consegna

### 2.2.1 Caratteristiche generali

- **Formato .SHP:** usato per interoperabilità GIS; gestisce geometria e attributi descrittivi (piante, strutture, ecc.).
- **Struttura:** 4 macro-categorie (1 Vegetazione, 2 Arredo urbano, 3 Fruizione e gestione, 4 Fattori ambientali), ciascuna con shapefile dedicati.
- **Geometria:** coordinate geografiche → **Point** (es. alberi), **Polyline** (es. sentieri), **Polygon** (es. aree verdi).

Per **regole e vincoli topologici** degli shapefile (conformità catalogo, posizionamento, sovrapposizioni, dimensioni, esoneri, oggetti semplici) si veda [Vincoli logici](../logical-constraints.md#4-shapefile-e-vincoli-topologici).

---

### Campi standard degli shapefile

| Nome campo | Formato | Lunghezza | Obbl. | Descrizione |
|------------|---------|-----------|-------|-------------|
| ID_ZRIL | testo | 12 | No | Identificativo univoco della porzione di territorio rilevata. |
| CODE_ISTAT | testo | 5 | Sì | Codice ISTAT del Comune (es. 015146 Milano). |
| ZONA | numero | 10 | Sì | Identificativo zona comunale (quartiere/circoscrizione/zona manutenzione). |
| AREA | testo | 80 | Sì | Codice area verde dentro la zona (es. ParcoCentrale). |
| OBJ_ID | numero | 12 | Sì | Numerazione univoca progressiva 1…n dell'elemento. |
| TP | testo | 1 | Sì | Tipo principale (1–4). |
| TS | testo | 2 | Sì | Tipo secondario. |
| CODICE | testo | 7 | Sì | Codice completo (es. S213203). |
| DATA_INI | data | 8 | Sì | Messa in opera (GGMMAAAA). |
| DATA_FINE | data | 8 | Sì | Rimozione (GGMMAAAA). |
| DATA_AGG | data | 8 | Sì | Ultimo aggiornamento (GGMMAAAA). |
| MODIF_DA | testo | 80 | No | Operatore ultima modifica. |
| NOTE | testo | 254 | No | Annotazioni. |
| FOTO | testo | 100 | No | Nome file immagine. |

---

### I quattro campi territoriali/operativi (riepilogo)

| Campo DB (shapefile) | Significato | Origine |
|----------------------|------------|--------|
| **zril_identifier** (ID_ZRIL) | Porzione di territorio rilevata; lotti/campagne/settori (es. settore A/B/C). Operativo, non amministrativo. | Capitolato, team censimento, fornitore GIS. Non ISTAT. |
| **istat_code** (CODE_ISTAT) | Codice ufficiale Comune (es. 015146 Milano, 001272 Torino). Unico standard nazionale. | ISTAT – Codici comuni; DBT, INSPIRE, catasto, open data PA. |
| **municipal_zone** (ZONA) | Suddivisione interna: quartiere, circoscrizione, zona manutenzione (es. Roma Municipi, Milano Zone 1–9). | Ufficio tecnico/servizio verde/SIT comunale. |
| **area_code_local** (AREA) | Singola area verde nella zona (es. ParcoSempione). Report costi/patrimonio per area. | Censimento verde, anagrafe aree, capitolato. |

**Gerarchia logica:** ISTAT (Comune) → ZONA → AREA → oggetti rilevati. *survey_unit_id* è parallelo (campagna/porzione di rilievo).

**Processo:** Fase 1 – Comune fornisce elenco aree, zone, codice ISTAT → si compilano istat_code, municipal_zone, area_code_local. Fase 2 – Fornitore GIS crea ID_ZRIL per lotti e controlli qualità.

**Perché esistono:** tracciabilità amministrativa (dove: Comune, zona, parco), tracciabilità operativa (chi/cosa/quando), interoperabilità tra Comuni/Regioni/ISTAT/DBT.

---

### Processo di rilievo (sintesi)

1. **Pianificazione:** Comune definisce aree da censire, zone e aree verdi; si fissano standard e riferimenti territoriali.
2. **Suddivisione operativa:** territorio in lotti/settori per squadre, avanzamento e qualità.
3. **Rilievo sul campo:** codice univoco per oggetto, caratteristiche (TP/TS/ATT), area, foto, date; raccolta con tablet/GPS o schede.
4. **Verifica e validazione:** controlli, correzioni, integrazione in SIT/DB comunali.
5. **Utilizzo:** manutenzioni, costi, monitoraggio patrimonio, aggiornamento cartografie e DB.

---

## Riferimenti

- **Cataloghi tipi:** [Tipi principali](types/primary_types.md), [Tipi secondari](types/secondary_types.md), [Tipi attributi](types/attribute_types.md).
- Vincoli copertura e shapefile: [logical-constraints.md](../logical-constraints.md#3-catalogo-dbt-e-copertura-del-suolo) e [§4 Shapefile](../logical-constraints.md#4-shapefile-e-vincoli-topologici).
- Diagramma entità-relazioni: [database-mapping-diagram.md](../../design/database-mapping-diagram.md) (PRIMARY_TYPES, SECONDARY_TYPES, ATTRIBUTE_TYPES, OBJECT_CODES).
