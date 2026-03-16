# Modal

Finestra modale con header, body e footer; supporta titolo, descrizione, icona e due pulsanti azione.

---

## Overview

**Modal** estende la modale di **reactstrap**: header con titolo (e opzionale descrizione, icona, badge), body e footer con due pulsanti configurabili. Si controlla con `isOpen`/`toggle`; `size` determina la larghezza (`auto`, `sm`, `md`, `lg`).

---

## Import

```tsx
import { Modal, ModalHeader, ModalBody, ModalFooter } from "dxc-webkit";
```

## Modal – Props (`ModalProps`)

Estende `ModalProps` di **reactstrap**.

| Prop | Tipo | Default | Descrizione |
|------|------|---------|-------------|
| `title` | `string \| undefined` | — | Titolo della modale (obbligatorio per il layout standard). |
| `description` | `string` | — | Sottotitolo/descrizione. |
| `size` | `ModalSize` | — | `'auto' \| 'sm' \| 'md' \| 'lg'`. |
| `showIcon` | `boolean` | Mostra icona nell’header. |
| `Icon` | `FC<SVGRProps>` | — | Componente icona nel titolo. |
| `labelButton1` | `string` | — | Etichetta pulsante primario. |
| `labelButton2` | `string` | — | Etichetta pulsante secondario. |
| `onClickButton1` | `MouseEventHandler` | — | Click pulsante primario. |
| `onClickButton2` | `MouseEventHandler` | — | Click pulsante secondario. |
| `toggle` | `MouseEventHandler` | — | Chiamato all’apertura/chiusura. |
| `badgeConfig` | `BadgeProps` | — | Configurazione badge (es. in header). |
| `className` | `string` | — | Classi wrapper. |
| `headerClassName` | `string` | — | Classi header. |
| `bodyWrapperClassName` | `string` | — | Classi wrapper del body. |
| `bodyContentClassName` | `string` | — | Classi contenuto body. |
| `footerClassName` | `string` | — | Classi footer. |

## ModalHeader / ModalBody / ModalFooter

- **ModalHeader:** `className` opzionale; per layout custom.
- **ModalBody:** contenuto centrale.
- **ModalFooter:** area pulsanti.

## Esempio

```tsx
<Modal
  isOpen={isOpen}
  toggle={toggle}
  title="Conferma operazione"
  description="Questa azione non è reversibile."
  size="md"
  labelButton1="Conferma"
  labelButton2="Annulla"
  onClickButton1={handleConfirm}
  onClickButton2={toggle}
>
  <ModalBody>Contenuto aggiuntivo</ModalBody>
</Modal>
```
