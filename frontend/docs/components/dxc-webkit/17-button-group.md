# ButtonGroup

Raggruppa più pulsanti in un unico blocco (toolbar, azioni affiancate). Estende **reactstrap** `ButtonGroup`; supporta dimensione comune e larghezza piena.

---

## Esempio

```tsx
import { ButtonGroup, Button } from "dxc-webkit";

// Gruppo orizzontale
<ButtonGroup>
  <Button color="primary" size="sm">Salva</Button>
  <Button color="light" kind="outlined" size="sm">Annulla</Button>
  <Button color="danger" kind="outlined" size="sm">Elimina</Button>
</ButtonGroup>

// Dimensione e spazio tra i pulsanti
<ButtonGroup size="md" gap="0.5rem">
  <Button color="primary">Primo</Button>
  <Button kind="outlined">Secondo</Button>
</ButtonGroup>

// Larghezza piena
<ButtonGroup fullWidth>
  <Button color="primary">Azione 1</Button>
  <Button kind="outlined">Azione 2</Button>
</ButtonGroup>
```

---

## API

Estende `ButtonGroupProps` di reactstrap.

| Nome        | Tipo              | Default | Descrizione |
|-------------|-------------------|---------|-------------|
| `className` | `string`          | —       | Classi CSS aggiuntive. |
| `gap`       | `string`          | —       | Spazio tra i pulsanti (es. `"0.5rem"`, `"8px"`). |
| `size`      | `ButtonGroupSize` | —       | Dimensione comune: `'sm' \| 'md' \| 'lg'`. |
| `fullWidth` | `boolean`         | —       | Se `true` il gruppo occupa tutta la larghezza del contenitore. |

Per orientamento verticale e altre opzioni ereditare le props di [reactstrap ButtonGroup](https://reactstrap.github.io/components/button-group/) (es. `vertical`).

I **children** sono in genere uno o più componenti **Button** (o pulsanti compatibili).
