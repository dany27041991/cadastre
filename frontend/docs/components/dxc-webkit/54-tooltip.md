# Tooltip

Tooltip contestuale (estende reactstrap): titolo, descrizione e tema chiaro/scuro.

---

## Overview

**Tooltip** estende **Tooltip** di reactstrap. Aggiunge `color` (dark/light), `title` e `description` per il contenuto del tooltip. Si usa con `target` (id dell’elemento) e `isOpen`/`toggle` per la visibilità; supporta `placement`, `className` e le altre props reactstrap.

---

## Import

```tsx
import { Tooltip } from "dxc-webkit";
```

---

## Tipi

- **TooltipColorsType:** `'dark' | 'light'`

---

## API – TooltipProps

Estende `TooltipProps` di reactstrap.

| Prop | Tipo | Default | Descrizione |
|------|------|---------|-------------|
| `color` | `TooltipColorsType` | — | Tema: `'dark'` o `'light'`. |
| `title` | `string` | — | Titolo nel tooltip. |
| `description` | `string` | — | Descrizione/testo aggiuntivo. |

(Altre props reactstrap: `target`, `isOpen`, `toggle`, `placement`, `className`, `delay`, ecc.)

---

## Esempio

```tsx
<>
  <span id="tooltip-target">Hover qui</span>
  <Tooltip
    target="tooltip-target"
    isOpen={show}
    toggle={() => setShow(!show)}
    title="Titolo"
    description="Testo descrittivo."
    color="dark"
  />
</>
```
