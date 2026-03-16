# Popover

Contenuto contestuale (tooltip/popover) con titolo, descrizione e pulsante; tema chiaro o scuro.

---

## Overview

**Popover** estende il Popover di **reactstrap** (senza prop `trigger`). Mostra un contenitore flottante con titolo, descrizione opzionale e pulsante; supporta `closeOnBlur`, `onClickButton` e `onCloseClicked`. Il colore (`dark` | `light`) imposta il tema.

---

## Import

```tsx
import { Popover } from "dxc-webkit";
```

---

## Tipi

- **PopoverColorsType:** `'dark' | 'light'`

---

## API – PopoverProps

Estende `PopoverProps` di reactstrap (eccetto `trigger`).

| Prop | Tipo | Default | Descrizione |
|------|------|---------|-------------|
| `color` | `PopoverColorsType` | — | Tema: `'dark'` o `'light'`. |
| `title` | `string` | — | Titolo del popover. |
| `description` | `string` | — | Testo descrittivo. |
| `closeOnBlur` | `boolean` | — | Chiude al click fuori. |
| `labelButton` | `string` | — | Etichetta del pulsante. |
| `onClickButton` | `MouseEventHandler<HTMLButtonElement>` | — | Click sul pulsante. |
| `onCloseClicked` | `MouseEventHandler<Element>` | — | Click sul pulsante di chiusura. |

(Le altre props sono quelle di reactstrap: `isOpen`, `target`, `toggle`, `placement`, `className`, ecc.)

---

## Esempio

```tsx
<Popover
  target="popover-target-id"
  isOpen={isOpen}
  toggle={toggle}
  title="Titolo"
  description="Testo del popover."
  color="dark"
  closeOnBlur
  labelButton="Ok"
  onClickButton={handleOk}
  onCloseClicked={handleClose}
/>
```
