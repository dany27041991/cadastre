# BottomBar

Barra fissa in basso con navigazione a step/pagine: pulsanti numerati, pulsante “indietro” e variante chiara/scura.

---

## Esempio

```tsx
import { BottomBar } from "dxc-webkit";

const [currentPage, setCurrentPage] = useState(1);

<BottomBar
  variant="light"
  currentPage={currentPage}
  setCurrentPage={setCurrentPage}
  arrBottoni={[
    { value: 1, buttonConfig: { label: "Step 1" } },
    { value: 2, buttonConfig: { label: "Step 2" } },
    { value: 3, buttonConfig: { label: "Step 3" } },
  ]}
  labelDanger="Annulla"
  tooltip_text="Torna indietro"
  handlerBack={() => setCurrentPage((p) => Math.max(1, p - 1))}
/>
```

---

## API

| Nome           | Tipo                     | Default | Descrizione |
|----------------|--------------------------|---------|-------------|
| `variant`      | `BottomBarColorsType`    | **obbligatorio** | Tema: `'light' \| 'dark'`. |
| `currentPage`  | `number`                 | **obbligatorio** | Indice/numero della pagina o step corrente. |
| `setCurrentPage` | `(data: number) => void` | **obbligatorio** | Callback per cambiare pagina/step (es. al click su uno step). |
| `arrBottoni`   | `ArrBottoniData[]`       | **obbligatorio** | Configurazione dei pulsanti: `{ value: number; buttonConfig: any }[]`. |
| `labelDanger`  | `string`                 | **obbligatorio** | Etichetta del pulsante “pericolo” (es. Annulla). |
| `tooltip_text` | `string`                 | **obbligatorio** | Testo tooltip per il pulsante “indietro”. |
| `handlerBack`  | `() => void`             | **obbligatorio** | Callback del pulsante “indietro”. |

### ArrBottoniData

| Campo           | Tipo    | Descrizione |
|-----------------|---------|-------------|
| `value`         | `number`| Valore (es. numero pagina) passato a `setCurrentPage` al click. |
| `buttonConfig`  | `any`   | Configurazione del pulsante (label, eventuali altre props del componente bottone usato internamente). |

**Nota:** la struttura esatta di `buttonConfig` dipende dall’implementazione interna della libreria; in caso di dubbi verificare l’uso in `cu1.5-fe-MVP3-local` o nei sorgenti dxc-webkit.
