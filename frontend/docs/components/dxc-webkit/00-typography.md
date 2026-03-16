# Typography

Sistema tipografico del design system DXC: font (Titillium Web, Lora, Roboto Mono), stili di testo (Display, Heading, Body, Label, Button, Link, Caption) e regole di utilizzo. Accessibilità prima dell'estetica.

---

## Panoramica

Benvenuto nella sezione Typography del nostro portale UX. Qui, la chiara filosofia è l'accessibilità prima dell'estetica. La nostra selezione di caratteri, con **Titillium Web** come principale, **Lora** per il corpo del testo e **Roboto Mono** per i numeri, è pensata per garantire una lettura agevole e una comprensione immediata della gerarchia di informazioni. I dettagli sulla dimensione e il contrasto dei caratteri sono curati con attenzione per garantire una chiara distinzione tra gli elementi, offrendo un'esperienza utente coinvolgente e informata.

---

## Fonts

| Font | Utilizzo |
|------|----------|
| **Titillium Web** | Tutti i testi nella pagina |
| **Lora** | Paragrafi lunghi |
| **Roboto Mono** | Numeri |

---

## Stili di testo

La scala tipografica del design di IDIA è composta da 15 stili, ognuno con un'applicazione e un significato specifici. Sono denominati in base all'utilizzo (come heading e titolo) e raggruppati in categorie basate sulle dimensioni (large, medium, small). La scala tipografica predefinita del Material Design utilizza Roboto per tutti i titoli, le etichette e il testo del corpo, creando un'esperienza tipografica coerente.

### Display

Tutte le informazioni e i componenti dell'interfaccia utente devono essere presentati in modi in cui possano percepirli.

| Name | CSS class | Caratteristiche |
|------|-----------|-----------------|
| Display 1 | `f1-display-h1-bold` | Weight: Bold \| Font size: 4 rem \| Line height: Auto |
| Display 2 | `f1-display-h2-bold` | Weight: Bold \| Font size: 3 rem \| Line height: Auto |

### Heading

| Name | CSS class | Caratteristiche |
|------|-----------|-----------------|
| Heading 1 | `f1-style-h1-bold` | Weight: Bold \| Font size: 2.5 rem \| Line height: 130% |
| Heading 2 | `f1-style-h2-bold` | Weight: Bold \| Font size: 2 rem \| Line height: 130% |
| Heading 3 | `f1-style-h3-semibold` | Weight: Semibold \| Font size: 1.75 rem \| Line height: 130% |
| Heading 4 | `f1-style-h4-semibold` | Weight: Semibold \| Font size: 1.5 rem \| Line height: 130% |
| Heading 5 | `f1-style-h5-semibold` | Weight: Semibold \| Font size: 1.25 rem \| Line height: 130% |
| Heading 6 | `f1-style-h6-semibold` | Weight: Semibold \| Font size: 1.125 rem \| Line height: 130% |

### Body

| Name | CSS class | Caratteristiche |
|------|-----------|-----------------|
| Large | `f1-body-lg` | Weight: Regular \| Font size: 1.125 rem \| Line height: 130% |
| Medium | `f1-body-md` | Weight: Regular \| Font size: 1 rem \| Line height: 130% |
| Small | `f1-body-sm` | Weight: Regular \| Font size: 0.875 rem \| Line height: 130% |

### Label

| Name | CSS class | Caratteristiche |
|------|-----------|-----------------|
| Large | `f1-label-lg` | Weight: Semibold \| Font size: 1.125 rem \| Line height: 130% |
| Medium | `f1-label-md` | Weight: Semibold \| Font size: 1 rem \| Line height: 130% |
| Small | `f1-label-sm` | Weight: Semibold \| Font size: 0.875 rem \| Line height: 130% |

### Button

| Name | CSS class | Caratteristiche |
|------|-----------|-----------------|
| Large | `f1-button-lg` | Weight: Semibold \| Font size: 1.125 rem \| Line height: 130% |
| Medium | `f1-button-md` | Weight: Semibold \| Font size: 1 rem \| Line height: 130% |
| Small | `f1-button-sm` | Weight: Semibold \| Font size: 0.875 rem \| Line height: 130% |

### Link

| Name | CSS class | Caratteristiche |
|------|-----------|-----------------|
| Large | `f1-link-semibold-lg` | Weight: Semibold \| Font size: 1.125 rem \| Line height: 130% |
| Medium | `f1-link-semibold-md` | Weight: Semibold \| Font size: 1 rem \| Line height: 130% |
| Small | `f1-link-semibold-sm` | Weight: Semibold \| Font size: 0.875 rem \| Line height: 130% |

### Caption

| Name | CSS class | Caratteristiche |
|------|-----------|-----------------|
| Standard | `f1-caption-regular-md` | Weight: Semibold \| Font size: 1.125 rem \| Line height: 130% |

---

## Utilizzo

- **Evita di utilizzare dimensioni del testo inferiori a 14px.**
- **Non sottolineare le parole:** per dare enfasi tipografica, è corretto l'uso del testo in grassetto.
- Lo stato predefinito dell'accordion è chiuso a meno che non venga utilizzato per la navigazione.
- **Non utilizzare due dimensioni di testo diverse nella stessa riga.**

Nei componenti dxc-webkit gli stili tipografici si applicano tramite la prop `font` sui componenti che accettano **BoxProps** (es. `Text`, `Button`), passando la classe CSS corrispondente (es. `f1-body-md`, `f1-style-h1-bold`). Vedi [Text](02-text.md) per esempi.
