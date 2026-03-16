# Alert

Messaggio contestuale (info, successo, avviso, errore). Può essere chiudibile, con timeout automatico e pulsanti azione.

---

## Esempio

```tsx
import { Alert } from "dxc-webkit";

// Alert base
<Alert color="success" title="Operazione completata">
  I dati sono stati salvati correttamente.
</Alert>

// Alert chiudibile
<Alert
  color="warning"
  title="Attenzione"
  isOpen={isOpen}
  onCloseClicked={() => setIsOpen(false)}
  closeAriaLabel="Chiudi messaggio"
>
  Controlla i campi obbligatori.
</Alert>

// Alert con chiusura automatica
<Alert
  color="primary"
  isOpen={isOpen}
  timeoutMillis={5000}
  onTimeout={() => setIsOpen(false)}
>
  Questo messaggio si chiude dopo 5 secondi.
</Alert>

// Alert con pulsanti azione
<Alert
  color="danger"
  title="Errore"
  labelButton1="Riprova"
  labelButton2="Annulla"
  onClickButton1={handleRetry}
  onClickButton2={handleCancel}
>
  Si è verificato un errore durante l'operazione.
</Alert>
```

---

## API

Estende `HTMLAttributes<HTMLElement>` (eccetto `color`).

| Nome              | Tipo                    | Default | Descrizione |
|-------------------|-------------------------|---------|-------------|
| `title`           | `string`                | —       | Titolo dell'alert. |
| `color`           | `AlertColor`            | —       | Variante: `'primary' \| 'success' \| 'warning' \| 'danger'`. |
| `closeAriaLabel`  | `string`                | —       | ARIA label per il pulsante di chiusura. |
| `fade`            | `boolean`               | `true`  | Animazione in entrata/uscita. |
| `tag`             | `ElementType`           | —       | Tag HTML alternativo al `div`. |
| `innerRef`        | `Ref<HTMLElement>`      | —       | Ref all'elemento DOM. |
| `isOpen`          | `boolean`               | —       | Se `true` l'alert è visibile. |
| `onCloseClicked`  | `MouseEventHandler`     | —       | Callback al click sul pulsante di chiusura. |
| `timeoutMillis`   | `number`                | —       | Millisecondi dopo i quali chiudere automaticamente l'alert. |
| `onTimeout`       | `() => void`            | —       | Callback quando l'alert si chiude per timeout. |
| `labelButton1`    | `string`                | —       | Etichetta primo pulsante. |
| `labelButton2`    | `string`                | —       | Etichetta secondo pulsante. |
| `onClickButton1`  | `MouseEventHandler`     | —       | Click primo pulsante. |
| `onClickButton2`  | `MouseEventHandler`     | —       | Click secondo pulsante. |
| `transition`      | `FadeProps`             | —       | Opzioni transizione (reactstrap). |

Il contenuto del messaggio va passato come **children**.
