# Template Mappa interattiva

Template con **mappa interattiva** come elemento visivo principale, **pannello floating** per i filtri e **finestra di dettaglio** (accordion) espandibile per risultati, tabelle e grafici. Gli input agiscono sulla mappa e sul dettaglio in tempo reale.

---

## Panoramica

Questo template ha come elemento visivo principale una **mappa interattiva**, sulla quale l'utente può agire dinamicamente. In sovraimpressione alla mappa è presente un **pannello floating** che consente di inserire i filtri nell'applicativo. Gli input generano output visualizzati sia sulla mappa (contenuto aggiornato in tempo reale) sia nella **finestra di dettaglio**, che può essere espansa o chiusa. All'interno della finestra di dettaglio vengono mostrati i risultati richiesti (tabelle, grafici, informazioni), offrendo una visualizzazione completa e interattiva dei dati.

---

## Anatomia del template

1. **Floating Panel** – Pannello trascinabile con titolo (es. "Nome CU"), testo introduttivo, barra di ricerca, filtri (SearchInput, RadioButton, DatePicker), pulsanti azione (top controls, conferma, annulla) e freccia per comprimere.
2. **Mappa** – Area principale a tutta larghezza/altezza; il contenuto reagisce ai filtri selezionati nel floating panel.
3. **Accordion di dettaglio** – Pannello (es. in basso a destra) con header (Title text, Badge), body espandibile contenente CustomTable, grafici o altri output e pulsanti (es. "Label text" con icona).

### Struttura tipica

- **Header / Nome CU** + testo (Lorem ipsum…).
- **Search** – SearchInput con PlaceholderIcon.
- **Seleziona tematica** – SearchInput con label e options.
- **Selezione area d'interesse** – Label in primary-active, RadioButton (Bacino / Sottobacino), SearchInput per area (es. "Bacino del SELE").
- **Seleziona periodo temporale** – Label, DatePicker data inizio e data fine (con min/max e disabilitazione coerente).
- **Pulsanti** – Top controls (Home, Operation 1, Operation 2), Conferma, Annulla.
- **Accordion** – AccordionHeader con badge (es. "Label Text" success), AccordionBody con CustomTable e Button con icona.

### Componenti coinvolti

- **FloatingPanel** – `title`, `headerText`, `topControls`, `confirmButton`, `cancelButton`, `position`, `onDrag`, `bounds`, `arrowPosition`, `arrowPlacement`, `onArrowClick`; variante compressa con `thumbFixedVariant`, `dragIcon={false}`.
- **SearchInput** – placeholder, label, options, value, onChange, showArrow, isSearchable, isClearable.
- **DatePicker** – label, placeholder, value, onChange, min, max, disabled, onCustomClear.
- **RadioButton** – label, color, value, name, checkedValue, onChange.
- **Accordion / AccordionItem / AccordionHeader / AccordionBody** – toggle, open, badgeConfig, scrollable body con CustomTable e Button.
- **CustomTable** – columns, rows, color (es. light).
- **Box** – layout container (flex, backgroundColor gray-100, position relative).

Per un esempio di implementazione completo (stato, drag, collapsed, date, options) fare riferimento alla documentazione ufficiale o agli storybook del design system.

---

## Utilizzo

- **Floating Panel:** usala per gli input di filtraggio, dando all'utente libertà di interagire con la mappa e di spostare il pannello sulla schermata.
- **Mappa:** usa questo tipo di mappa per una visualizzazione costante degli output: il contenuto cambia in base alle selezioni nel floating panel e l'utente può interagirvi direttamente.
- **Accordion di dettaglio:** usa il body per output personalizzati (grafici, tabelle, informazioni dinamiche) che si aggiornano in base agli input dell'utente.

---

## Do's and Don'ts

| ✅ DO | ⛔ DON'T |
|-------|----------|
| Se ci sono più output da mostrare, usa uno **switcher** all'interno dell'accordion di dettaglio per non sovraccaricare la schermata e migliorare l'esperienza utente. | Non usare il **pannello delle informazioni** (info panel) per visualizzare gli output richiesti: non è progettato per questo tipo di contenuti. |

---

Componenti correlati: [FloatingPanel](27-floating-panel.md), [Accordion](10-accordion.md), [SearchInput](43-search-input.md), [DatePicker](23-date-picker.md), [Table](49-table.md).
