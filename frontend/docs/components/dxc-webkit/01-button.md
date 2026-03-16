# Button

Pulsante con varianti di colore, dimensione e stile (filled, outlined, bare). Può fungere da link o da bottone di chiusura in altri componenti.

---

## Esempio

```tsx
import { Button } from "dxc-webkit";

// Primario
<Button color="primary" kind="filled" onClick={() => {}}>
  Salva
</Button>

// Outlined e danger
<Button color="danger" kind="outlined" size="sm">
  Elimina
</Button>

// Bare (solo testo/icona)
<Button kind="bare" color="primary">Annulla</Button>

// Pulsante chiusura (Chip, Modal, ecc.)
<Button close onClick={onClose} ariaLabelTitle="Chiudi" />

// Larghezza piena
<Button color="primary" fullWidth>Continua</Button>

// Come link
<Button tag="a" href="/pagina" ariaTargetBlack>
  Vai alla pagina
</Button>
```

---

## API

Estende `ButtonHTMLAttributes<HTMLButtonElement>`.

| Nome            | Tipo                    | Default | Descrizione |
|-----------------|-------------------------|---------|-------------|
| `tag`           | `ElementType`           | —       | Tag HTML alternativo (es. `"a"` per link). |
| `className`     | `string`                | —       | Classi CSS aggiuntive. |
| `icon`          | `boolean`               | —       | Riserva spazio/stile per icona nel contenuto. |
| `size`          | `ButtonSize`            | —       | Dimensione: `'auto' \| 'sm' \| 'md' \| 'lg'`. |
| `close`         | `boolean`               | —       | Stile pulsante di chiusura (Chips, Modal, ecc.). |
| `color`         | `ButtonColor`           | —       | Colore: `'primary' \| 'warning' \| 'success' \| 'danger' \| 'light' \| 'white'`. |
| `kind`          | `'filled' \| 'outlined' \| 'bare'` | — | Variante visiva. |
| `active`        | `boolean`               | —       | Stato visivo “active”. |
| `fullWidth`     | `boolean`               | —       | Larghezza 100% del contenitore. |
| `innerRef`      | `Ref<HTMLButtonElement>`| —       | Ref all’elemento DOM. |
| `href`          | `string`                | —       | URL se usato con `tag="a"`. |
| `ariaTargetBlack` | `boolean`             | —       | Se il link si apre in nuova scheda (accessibilità). |
| `ariaLabelTitle`  | `string`             | —       | Customizzazione `aria-label`. |

Il testo o il contenuto del pulsante va passato come **children**.
