# Accordion

Espande e comprime sezioni di contenuto. Basato su **reactstrap** (`Accordion`, `AccordionItem`, `AccordionHeader`, `AccordionBody`). Usa `targetId` / `accordionId` per associare header e body.

---

## Esempio

```tsx
import { Accordion, AccordionItem, AccordionHeader, AccordionBody } from "dxc-webkit";

<Accordion open="1" toggle={() => {}}>
  <AccordionItem>
    <AccordionHeader targetId="1" labelShowMore="Mostra" labelShowLess="Nascondi">
      Titolo sezione 1
    </AccordionHeader>
    <AccordionBody accordionId="1">
      Contenuto della sezione 1.
    </AccordionBody>
  </AccordionItem>
  <AccordionItem>
    <AccordionHeader targetId="2">Sezione 2</AccordionHeader>
    <AccordionBody accordionId="2">
      Contenuto della sezione 2.
    </AccordionBody>
  </AccordionItem>
</Accordion>
```

---

## API

### Accordion

Estende `AccordionProps` di reactstrap.

| Nome        | Tipo   | Default | Descrizione |
|------------|--------|---------|-------------|
| `className` | `string` | — | Classi CSS aggiuntive. |

Gestione stato: usa le props di reactstrap (es. `open`, `toggle`) per quale item è aperto.

---

### AccordionItem

Estende `AccordionItemProps` di reactstrap.

| Nome        | Tipo   | Default | Descrizione |
|------------|--------|---------|-------------|
| `className` | `string` | — | Classi CSS aggiuntive. |
| `targetId`  | `string` | — | Id usato per associare header/body (coerente con `AccordionHeader.targetId` e `AccordionBody.accordionId`). |

---

### AccordionHeader

Estende le props di reactstrap (eccetto `targetId`).

| Nome           | Tipo         | Default | Descrizione |
|----------------|--------------|---------|-------------|
| `className`    | `string`     | —       | Classi CSS aggiuntive. |
| `targetId`     | `string`     | —       | Id della sezione (deve coincidere con `AccordionBody.accordionId`). |
| `badgeConfig`  | `BadgeProps` | —       | Configurazione badge in header. |
| `labelShowMore`| `string`     | —       | Testo “Mostra” (accessibilità/aria). |
| `labelShowLess`| `string`     | —       | Testo “Nascondi” (accessibilità/aria). |

Il contenuto del pulsante (es. titolo) va passato come **children**.

---

### AccordionBody

Estende le props di reactstrap (eccetto `accordionId`).

| Nome          | Tipo     | Default | Descrizione |
|---------------|----------|---------|-------------|
| `className`   | `string` | —       | Classi CSS aggiuntive. |
| `accordionId` | `string` | —       | Id della sezione (deve coincidere con `AccordionHeader.targetId`). |

Il contenuto della sezione va passato come **children**.
