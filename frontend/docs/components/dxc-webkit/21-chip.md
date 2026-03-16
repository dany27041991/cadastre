# Chip

Etichetta compatta rimovibile (tag, filtro, selezione). Supporta icona a sinistra, varianti di colore/dimensione e pulsante di chiusura.

---

## Esempio

```tsx
import { Chip, icons } from "dxc-webkit";

// Chip base
<Chip color="primary">Etichetta</Chip>

// Con icona e chiusura
<Chip
  color="primary"
  IconLeft={icons.TagIcon}
  onCloseClicked={() => {}}
>
  Filtro attivo
</Chip>

// Outlined e dimensioni
<Chip color="success" isOutlined size="sm">Piccolo</Chip>
<Chip color="warning" size="lg">Grande</Chip>

// Disabilitato
<Chip color="primary" disabled>Non rimovibile</Chip>
```

---

## API

Estende `HTMLAttributes<HTMLElement>`.

| Nome            | Tipo                    | Default | Descrizione |
|-----------------|-------------------------|---------|-------------|
| `className`     | `string`                | —       | Classi CSS aggiuntive. |
| `disabled`      | `boolean`               | —       | Stato disabilitato. |
| `size`          | `ChipSizes`             | —       | Dimensione: `'auto' \| 'sm' \| 'md' \| 'lg'`. |
| `color`         | `ChipColors`            | —       | Colore: `'primary' \| 'success' \| 'warning' \| 'danger' \| 'white'`. |
| `isOutlined`    | `boolean`               | —       | Se `true` solo bordo, altrimenti pieno. |
| `IconLeft`      | `FC<SVGRProps>`         | —       | Icona a sinistra. |
| `onCloseClicked`| `MouseEventHandler`     | —       | Callback al click sul pulsante di chiusura (X). |

Il testo del chip va passato come **children**.
