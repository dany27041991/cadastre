# DataTile

Tile per visualizzare un blocco di dati: titolo, sottotitolo, immagine di sfondo, badge, label e liste di input/azioni (componenti custom).

---

## Esempio

```tsx
import { DataTile, Button } from "dxc-webkit";

<DataTile
  title="Titolo tile"
  subtitle="Sottotitolo"
  img_bg="/path/to/bg.jpg"
  badge_label="Nuovo"
  label_key="Chiave"
  label_details="Dettaglio"
  listInputComponent={[
    { value: 1, component: <span>Input 1</span> },
  ]}
  listActionComponent={[
    { value: 1, component: <Button color="primary">Azione</Button> },
  ]}
/>
```

---

## API

### DataTileProps

| Nome                 | Tipo                     | Default | Descrizione |
|----------------------|--------------------------|---------|-------------|
| `img_bg`             | `string`                 | —       | URL immagine di sfondo. |
| `title`              | `string`                 | —       | Titolo principale. |
| `subtitle`           | `string`                 | —       | Sottotitolo. |
| `badge_label`        | `string`                 | —       | Testo del badge. |
| `label_key`          | `string`                 | —       | Etichetta chiave. |
| `label_details`      | `string`                 | —       | Testo dettaglio. |
| `listInputComponent` | `ListInputInterface[]`   | —       | Lista di elementi input (value + component). |
| `listActionComponent`| `ListButtonInterface[]`  | —       | Lista di pulsanti/azioni (value + component). |

### ListInputInterface / ListButtonInterface

| Campo       | Tipo          | Descrizione |
|-------------|---------------|-------------|
| `value`     | `number`      | Valore associato. |
| `component` | `JSX.Element` | Componente React da mostrare (input o bottone). |
