# Checkbox

Casella di controllo con etichetta e testo di aiuto. Supporta variante “danger” e uso controllato; **FormCheckbox** per integrazione con react-hook-form; **SemiCheckbox** per stato indefinito (tri-state).

---

## Esempio

```tsx
import { Checkbox, FormCheckbox, SemiCheckbox } from "dxc-webkit";

// Checkbox base
<Checkbox
  label="Accetto i termini e condizioni"
  name="terms"
  checked={checked}
  onChange={(value, name, e) => setChecked(value)}
/>

// Con helper text e variante danger
<Checkbox
  label="Conferma eliminazione"
  helperText="Questa azione non è reversibile."
  danger
  checked={dangerChecked}
  onChange={(value) => setDangerChecked(value)}
/>

// FormCheckbox (con react-hook-form)
<FormCheckbox name="newsletter" label="Iscrivimi alla newsletter" />

// SemiCheckbox (tri-state: true | false | neither)
<SemiCheckbox
  label="Seleziona tutti"
  value={triState}
  onChange={(value) => setTriState(value)}
/>
```

---

## API

### Checkbox

Estende `InputHTMLAttributes<HTMLInputElement>` (eccetto `onChange`).

| Nome        | Tipo     | Default | Descrizione |
|-------------|----------|---------|-------------|
| `className` | `string` | —       | Classi CSS aggiuntive. |
| `label`     | `string` | **obbligatorio** | Etichetta visibile. |
| `helperText`| `string` | —       | Testo di aiuto sotto la checkbox. |
| `danger`    | `boolean`| —       | Variante visiva “danger”. |
| `innerRef`  | `(instance: unknown) => void` | — | Ref all’input. |
| `onChange`  | `(value: boolean, name: string, e: ChangeEvent<HTMLInputElement>) => void` | — | Valore (checked), name e evento. |

---

### FormCheckbox

Per uso con **react-hook-form**: espone `name` e validazioni; gestisce `checked`/`value` in modo controllato.

| Nome      | Tipo     | Descrizione |
|-----------|----------|-------------|
| `name`    | `string` | **obbligatorio** – Nome del campo nel form. |
| `label`   | `string` | Etichetta (come in Checkbox). |
| `validate`| `Validate<boolean, unknown>` o record | Validazione custom. |

Eredita le altre props di **Checkbox** (eccetto quelle controllate e quelle di validazione non applicabili). Vedere i tipi `FormCheckboxProps` e `CheckboxValidations` in libreria.

---

### SemiCheckbox (tri-state)

| Nome     | Tipo    | Default | Descrizione |
|----------|---------|---------|-------------|
| `value`  | `TriState` | —    | `'true' \| 'false' \| 'neither'` (selezionato, non selezionato, indefinito). |
| `onChange` | come Checkbox | —  | Riceve il nuovo stato (tri-state). |
| `label`  | `string` | **obbligatorio** | Etichetta. |

Utile per “Seleziona tutti” quando solo una parte degli elementi è selezionata.
