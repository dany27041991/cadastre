# Template Mappa secondaria

Template con **mappa secondaria** nel corpo principale della pagina, **Info Panel** laterale per filtri e input, **Sidebar** per la navigazione. Il body mostra mappa, informazioni, grafici e tabelle generati in base a input, filtri e selezioni inseriti nell'Info Panel.

---

## Panoramica

Questo template include una **mappa secondaria** all'interno del corpo principale della pagina. Si utilizza quando la mappa non ha un ruolo primario nell'interazione ma offre informazioni visive di supporto. Oltre alla mappa, il body consente di visualizzare informazioni, grafici e tabelle generati in base agli input, ai filtri e alle selezioni inseriti dall'utente nell'**Info Panel** laterale.

---

## Anatomia del template

1. **InfoPanel** – Pannello laterale compatto con titolo/sottotitolo (es. "Nome CU"), testo introduttivo, search bar, filtri (SearchInput, RadioButton, DatePicker) e pulsanti; **non** va usato per visualizzare gli output.
2. **Sidebar Navigation** – Sezione verticale (solitamente a sinistra) per esplorare e navigare tra sezioni, pagine o funzionalità dell'applicativo.
3. **Accordion di dettaglio** – Componente che permette di espandere e comprimere sezioni di contenuto, organizzando le informazioni in modo compatto e mostrando solo ciò che è rilevante per l'utente.

### Variante Sidebar open

Layout con sidebar espansa (stato "open"); la disposizione Sidebar | InfoPanel | Body resta invariata.

### Struttura tipica

- **Sidebar** – Header con label (es. "Progetto IDIA"), logo (`headerConfig`, `logoConfig1`), `SidebarItem` con Icon e label.
- **InfoPanel** – `boxSubTitleTitle` / `boxSubTitleSub`, `textBtnNew` / `textBtnPre`, contenuto scrollabile con:
  - Search (SearchInput con PlaceholderIcon)
  - Seleziona tematica (SearchInput con label e options)
  - Selezione area d'interesse (label in primary-active, RadioButton Bacino/Sottobacino, SearchInput area)
  - Seleziona periodo temporale (DatePicker data inizio/fine)
- **Body** – Accordion con AccordionHeader ("Title"), AccordionBody con CustomTable e Button con icona; eventuale mappa in layout flessibile.

### Componenti coinvolti

- **Sidebar** – `headerConfig` (label, logoConfig1), `hideFooter`, `height`, `width`; figli `SidebarItem` (Icon, label, onClick).
- **InfoPanel** – `boxSubTitleTitle`, `boxSubTitleSub`, `textBtnNew`, `textBtnPre`, `optionSearchBar`, `searchText`, `hideSearch`; figli: SearchInput, RadioButton, DatePicker in contenitore scrollabile (`scrollable-container-sm`, maxHeight).
- **Accordion / AccordionItem / AccordionHeader / AccordionBody** – `toggle`, `open`, `labelShowMore` / `labelShowLess`; body con CustomTable e Button.
- **CustomTable** – columns, rows, color (es. light).
- **SearchInput, DatePicker, RadioButton** – come nel template mappa primaria.
- **Box** – layout flex row (Sidebar | InfoPanel | Body), `backgroundColor` gray-100.

Per un esempio di implementazione completo (stato, options, columns, tableData) fare riferimento alla documentazione ufficiale o agli storybook del design system.

---

## Utilizzo

- **Sidebar:** usala per navigare tra le sezioni dell'applicativo e, se necessario, esplorare le sottosezioni, migliorando accessibilità e navigazione nell'interfaccia.
- **InfoPanel:** usalo per applicare filtri, selezioni multiple e parametri, generando output all'interno della mappa e dell'accordion di dettaglio.
- **Mappa:** usala per interagire con la selezione di aree o punti specifici, che si integrano con gli input inseriti e gli output visualizzati, offrendo una navigazione dinamica e contestualizzata.
- **Accordion di dettaglio:** usalo per visualizzare output visivi di contesto, anche in relazione alla mappa sottostante e agli input inseriti.

---

## Do's and Don'ts

| ✅ DO | ⛔ DON'T |
|-------|----------|
| Chiudi l'accordion di dettaglio quando devi interagire con la mappa o visualizzare i dati al suo interno, utilizzando il pulsante apposito, per evitare che copra aree importanti. | Non usare l'**Info Panel** per visualizzare gli output richiesti: non è progettato per questo tipo di contenuti. |

---

Componenti correlati: [Sidebar](44-sidebar.md), [InfoPanel](04-info-panel.md), [Accordion](10-accordion.md), [SearchInput](05-input-searchinput.md), [DatePicker](23-date-picker.md), [Table](06-table.md).
