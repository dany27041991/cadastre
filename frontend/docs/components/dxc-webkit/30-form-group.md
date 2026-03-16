# FormGroup

Wrapper per un campo di form: label, helper text, stato errore e attributi di accessibilità (id label, id helper). Usare **useFormGroupIds** per generare `elementId`, `labelId`, `helperTextId` coerenti.

---

## Esempio

```tsx
import { FormGroup, useFormGroupIds, Input } from "dxc-webkit";

const ids = useFormGroupIds("email");

<FormGroup
  {...ids}
  label="Email"
  helperText="Inserisci la tua email istituzionale."
  size="md"
>
  <Input name="email" id={ids.elementId} aria-describedby={ids.helperTextId} />
</FormGroup>

// Con stato errore
<FormGroup
  {...useFormGroupIds("password")}
  label="Password"
  helperText="Minimo 8 caratteri."
  isHelperTesxtError
  color="danger"
>
  <input type="password" name="password" />
</FormGroup>

// Disabilitato
<FormGroup {...useFormGroupIds("field")} label="Campo" disabled size="lg">
  <Input name="field" disabled />
</FormGroup>
```

---

## API

### FormGroupProps

| Nome                 | Tipo               | Default | Descrizione |
|----------------------|--------------------|---------|-------------|
| `elementId`          | `string`           | **obbligatorio** | ID del componente (associato all’input con `id`). |
| `labelId`            | `string`           | **obbligatorio** | ID della label (per `aria-labelledby`). |
| `label`              | `string`           | —       | Testo della label. |
| `helperTextId`       | `string`           | **obbligatorio** | ID dell’helper text (per `aria-describedby`). |
| `helperText`         | `string`           | —       | Testo di aiuto sotto il campo. |
| `isHelperTesxtError` | `boolean`          | —       | Stile e ruolo messaggio di errore per l’helper text. |
| `className`          | `string`           | —       | Classi CSS aggiuntive. |
| `size`               | `FormGroupSize`    | —       | Dimensione: `'sm' \| 'md' \| 'lg' \| 'auto'`. |
| `color`              | `FormGroupColors`  | —       | Variante: `'primary' \| 'danger' \| 'success' \| 'secondary'`. |
| `disabled`           | `boolean`          | —       | Stato disabilitato (stile e comportamento). |
| `children`           | `ReactNode`        | **obbligatorio** | Campo o controlli del form. |

### useFormGroupIds

Hook che restituisce un oggetto con `elementId`, `labelId`, `helperTextId` (e eventualmente altri id) da passare a `FormGroup`. Parametro tipico: una stringa univoca per il campo (es. nome del campo).

```tsx
const ids = useFormGroupIds("myField");
// { elementId: "...", labelId: "...", helperTextId: "..." }
```

Assicura che label e helper text siano associati al controllo per l’accessibilità.
