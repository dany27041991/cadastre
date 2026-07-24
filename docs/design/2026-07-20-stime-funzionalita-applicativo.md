# Stime — Catasto arboreo (SIV) · MVP1

**Data:** 2026-07-20 · **Unità:** gg (min–max) · **Contingenza:** nessuna  
**Scope:** piattaforma applicativa (mappa, ricerca, dashboard aggregati, glossario)  
**Fuori scope → MVP2:** federazione nazionale, Dataiku/DSS  

I requisiti di dettaglio possono evolvere: le stime sono per **macro-capacità**, non per specifica tecnica chiusa.

---

## Perimetro funzionale (invariato)

| # | Capacità |
|---|----------|
| 1 | Visualizzazione aree/asset per territorio amministrativo |
| 2 | Visualizzazione per zona disegnata |
| 3 | Caricamento file geografici (vettoriali e/o raster) e incrocio sul territorio |
| 4–5 | Ricerca aree e asset (filtri, tabelle, mappa) |
| 6 | Dashboard aggregati (Patrimonio / Biodiversità / Servizi / Governance) su aree-asset |
| 7 | Glossario |

Le dashboard MVP1 restano su **aggregati aree/asset**; non vengono rifatte in MVP2.

---

## Stime per macro-categoria

### A. Contesto e navigazione
*Contesto condiviso su cui poggiano mappa, ricerche e dashboard.*

| Sottocategoria | Contenuto (generico) | gg |
|----------------|----------------------|-----|
| Contesto territorio | Zona di lavoro attiva (admin / disegno / file) | 3–4 |
| Regole di filtro | Stessa “zona” per elenchi, mappa, grafici | 3–4 |
| Navigazione app | Menu e percorsi alle sezioni | 2–3 |
| **Totale A** | | **8–11** |

### B. Esplorazione territoriale
*Tutto ciò che fa vedere e selezionare il territorio e i dati censiti sulla mappa.*

| Sottocategoria | Contenuto (generico) | gg |
|----------------|----------------------|-----|
| Navigazione amministrativa | Drill-down territoriale e layer aree/asset | 5–9 |
| Selezione geometrica | Disegno/modifica zona e dati contenuti | 9–14 |
| Import geografico | Upload multi-formato, overlay, incrocio, gestione errori | 20–32 |
| **Totale B** | | **34–55** |

### C. Ricerca e consultazione
*Trovare e consultare i dati, oltre la sola mappa.*

| Sottocategoria | Contenuto (generico) | gg |
|----------------|----------------------|-----|
| Ricerca aree verdi | Filtri, tabella, paginazione, link mappa | 8–12 |
| Ricerca asset verdi | Stesso schema (riuso pattern) | 6–10 |
| Glossario | Elenco, ricerca, schede | 6–9 |
| **Totale C** | | **20–31** |

### D. Dashboard
*Viste grafiche aggregate sul territorio attivo.*

| Sottocategoria | Contenuto (generico) | gg |
|----------------|----------------------|-----|
| Aggregazioni e grafici | Calcoli + schermate per le voci dashboard | 13–20 |
| Allineamento al territorio | Aggiornamento al cambio zona | 3–4 |
| **Totale D** | | **16–24** |

### E. Test e collaudo
*Verifica su tutto il perimetro MVP1.*

| Sottocategoria | Contenuto (generico) | gg |
|----------------|----------------------|-----|
| Automazione | Unitari, integrazione, e2e | 13–20 |
| Carico | Performance e stress | 8–12 |
| Accettazione e consegna | UAT, a11y/UX base, documentazione | 8–13 |
| **Totale E** | | **29–45** |

---

## Riepilogo MVP1

| Macro | gg |
|-------|-----|
| A. Contesto e navigazione | 8–11 |
| B. Esplorazione territoriale | 34–55 |
| C. Ricerca e consultazione | 20–31 |
| D. Dashboard | 16–24 |
| E. Test e collaudo | 29–45 |
| **Totale** | **107–166** |

| Scenario | gg | ~mesi (1 FTE / 2 FTE) |
|----------|-----|------------------------|
| Tradizionale | 107–166 | 5,5–8,5 / 3–5,5 |
| Con Cursor (~−38%) | **65–107** | 3–5,5 / 2–3,5 |

Dettaglio Cursor: [2026-07-20-stime-funzionalita-applicativo-cursor.md](./2026-07-20-stime-funzionalita-applicativo-cursor.md)  
MVP2: [2026-07-20-stime-funzionalita-mvp2.md](./2026-07-20-stime-funzionalita-mvp2.md)
