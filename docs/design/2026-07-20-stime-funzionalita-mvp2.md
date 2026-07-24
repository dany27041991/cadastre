# Stime — Catasto arboreo (SIV) · MVP2

**Data:** 2026-07-20 · **Unità:** gg (min–max) · **Contingenza:** nessuna  
**Prerequisito:** MVP1 completo  
**Stime:** solo software (lavoro scientifico esperti fuori)  

Requisiti di dettaglio (fonti, indicatori, formati report) possono cambiare: qui restano le **capacità essenziali**.

---

## Cosa è MVP2 (essenziale)

| Macro | Cosa fa | Cosa non fa |
|-------|---------|-------------|
| Acquisizione dati nazionali | Portare dati da fonti nazionali in piattaforma, in modo ripetibile ed estendibile | Non rifà mappa/ricerche/dashboard/glossario MVP1 |
| DSS e modelli Dataiku | 1–2 modelli su Dataiku + scenari, indicazioni e report in app | Non è una suite multi-modello ampia |
| Test e collaudo | Verifica dei soli flussi MVP2 | Non ristima i test MVP1 (solo smoke regressione) |

**Nessuna sovrapposizione:** le funzionalità MVP1 restano quelle; MVP2 aggiunge solo acquisizione dati nazionali + DSS/Dataiku.

---

## Stime per macro-categoria

### A. Acquisizione dati nazionali
*Portare in piattaforma dati e indicatori da fonti esterne (nazionali), con possibilità di aggiungere nuove fonti.*

| Sottocategoria | Contenuto (generico) | gg |
|----------------|----------------------|-----|
| Collegamento a MVP1 | Riuso del territorio attivo per indicatori e DSS | 6–10 |
| Framework di acquisizione | Catalogo fonti, connettori estendibili, schedulazione, accessi | 22–35 |
| Prime fonti nazionali | Primo set di fonti live + controlli di qualità | 28–45 |
| Catalogo indicatori | Modello e API per ambiti (bio / servizi / governance) a uso DSS | 18–30 |
| **Totale A** | | **74–120** |

### B. DSS e modelli Dataiku
*Pochi modelli AI e schermate di supporto alle decisioni (nuove, distinte dalle dashboard MVP1).*

| Sottocategoria | Contenuto (generico) | gg |
|----------------|----------------------|-----|
| Modelli Dataiku (1–2) | Collegamento piattaforma–Dataiku, esecuzione, salvataggio esiti | 12–22 |
| Scenari, indicazioni e report | UI DSS: ipotesi, indicazioni, export; filtri per target se necessari | 26–44 |
| **Totale B** | | **38–66** |

### C. Test e collaudo
*Solo perimetro MVP2.*

| Sottocategoria | Contenuto (generico) | gg |
|----------------|----------------------|-----|
| Test automatici | Unitari, integrazione, e2e sui flussi nuovi | 16–25 |
| Performance e stress | Prove di carico su acquisizione dati e job modello | 8–14 |
| Collaudo e documentazione | UAT, messaggi/stati utente, documentazione operativa | 10–17 |
| **Totale C** | | **34–56** |

---

## Riepilogo MVP2

| Macro | gg |
|-------|-----|
| A. Acquisizione dati nazionali | 74–120 |
| B. DSS e modelli Dataiku | 38–66 |
| C. Test e collaudo | 34–56 |
| **Totale** | **146–242** |

| Scenario | MVP2 | MVP1 + MVP2 |
|----------|------|-------------|
| Tradizionale | 146–242 | **253–408** |
| Cursor (~−35/40%) | **93–155** | **158–262** |

~mesi MVP2 (1 / 2 FTE): tradizionale 7–12 / 4,5–7,5 · Cursor 4,5–8 / 3–5,5  

Dettaglio Cursor: [2026-07-20-stime-funzionalita-mvp2-cursor.md](./2026-07-20-stime-funzionalita-mvp2-cursor.md)
