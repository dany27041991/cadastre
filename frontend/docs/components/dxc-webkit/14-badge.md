# Badge

Etichetta per stati o conteggi (es. “Nuovo”, “3”). Supporta varianti di colore e dimensione, stile pieno o solo bordo.

---

## Esempio

```tsx
import { Badge } from "dxc-webkit";

// Badge pieno
<Badge color="primary">Nuovo</Badge>
<Badge color="success">Completato</Badge>
<Badge color="warning">In attesa</Badge>
<Badge color="danger">Errore</Badge>

// Badge solo bordo
<Badge color="primary" isOutlined>Outlined</Badge>

// Dimensioni
<Badge color="primary" size="sm">Piccolo</Badge>
<Badge color="primary" size="lg">Grande</Badge>

// Disabilitato
<Badge color="primary" disabled>Disabilitato</Badge>
```

---

## API

Estende `BadgeProps` di reactstrap (incl. `color` per compatibilità HTML).

| Nome         | Tipo          | Default | Descrizione |
|--------------|---------------|---------|-------------|
| `color`      | `BadgeColor`  | —       | Variante: `'primary' \| 'success' \| 'warning' \| 'danger' \| 'white'`. |
| `size`       | `BadgeSize`   | —       | Dimensione: `'auto' \| 'sm' \| 'md' \| 'lg'`. |
| `isOutlined` | `boolean`     | `false` | Se `true` solo bordo, altrimenti pieno. |
| `disabled`   | `boolean`     | `false` | Stato disabilitato. |

Il testo o il contenuto del badge va passato come **children**.  
Per uso in tabelle o header (es. accordion) vedi anche `badgeConfig` nei componenti che lo supportano.
