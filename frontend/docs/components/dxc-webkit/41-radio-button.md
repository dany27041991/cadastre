# RadioButton

Radio button con label, helper text e colore; **FormRadio** per integrazione con form (validazioni).

---

## Overview

**RadioButton** è un input radio stilizzato: accetta `value`, `checkedValue` (valore del gruppo selezionato), `label`, `helperText` e `color`. La signature di `onChange` è `(value, name, e)`. **FormRadio** estende le props per uso in form con validazioni (`RadioValidations`) e richiede `name`.

---

## Import

```tsx
import { RadioButton, FormRadio } from "dxc-webkit";
```

---

## Tipi

- **RadioButtonColor:** `'primary' | 'danger'`

---

## RadioButton – RadioButtonProps

Omette `onChange` e `value` da `InputHTMLAttributes<HTMLInputElement>`; `value` e `onChange` hanno signature dedicata.

| Prop | Tipo | Default | Descrizione |
|------|------|---------|-------------|
| `label` | `string` | — | Etichetta (obbligatorio). |
| `value` | `string` | — | Valore dell’opzione (obbligatorio). |
| `checkedValue` | `string` | — | Valore attualmente selezionato nel gruppo. |
| `helperText` | `string` | — | Testo di aiuto sotto il radio. |
| `color` | `RadioButtonColor` | — | `'primary'` o `'danger'`. |
| `onChange` | `(value: string, name: string, e: ChangeEvent<HTMLInputElement>) => void` | — | Cambio selezione. |
| `toggleCheck` | `() => void` | — | Toggle programmatico. |
| `innerRef` | `(instance: unknown) => void` | — | Ref interno. |

---

## FormRadio – FormRadioProps

Estende `RadioButtonProps` con validazioni; richiede `name`. Omette `name`, `innerRef` e alcune props di validazione da `RadioButtonProps`.

| Prop | Tipo | Default | Descrizione |
|------|------|---------|-------------|
| `name` | `string` | — | Nome del campo (obbligatorio in form). |

(Supporta le stesse props di RadioButton più quelle di `RadioValidations`.)

---

## Esempio

```tsx
const [selected, setSelected] = useState("a");

<>
  <RadioButton
    name="choice"
    label="Opzione A"
    value="a"
    checkedValue={selected}
    onChange={(val) => setSelected(val)}
  />
  <RadioButton
    name="choice"
    label="Opzione B"
    value="b"
    checkedValue={selected}
    onChange={(val) => setSelected(val)}
  />
</>
```
