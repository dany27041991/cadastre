# TextArea

Campo di testo multiriga con label, helper text e colore; **FormTextArea** per integrazione con form e validazioni.

---

## Overview

**TextArea** estende gli attributi nativi di `<textarea>` (tranne `size` e `onChange`). Supporta `label`, `helperText`, `color` (TextAreaColors) e `innerRef`. La signature di `onChange` è `(value, name, e)`. **FormTextArea** richiede `name` e supporta validazioni (react-hook-form) e `validate` custom.

---

## Import

```tsx
import { TextArea, FormTextArea } from "dxc-webkit";
```

---

## Tipi

- **TextAreaColors:** `'primary' | 'danger' | 'success'`

---

## TextArea – TextAreaProps

| Prop | Tipo | Default | Descrizione |
|------|------|---------|-------------|
| `label` | `string` | — | Etichetta. |
| `helperText` | `string` | — | Testo di aiuto sotto il campo. |
| `color` | `TextAreaColors` | — | Colore stato (primary, danger, success). |
| `onChange` | `(value: string, name: string, e: ChangeEvent<HTMLTextAreaElement>) => void` | — | Cambio valore. |
| `innerRef` | `(instance: unknown) => void` | — | Ref al textarea. |

(Supporta anche le props HTML di `<textarea>`: `placeholder`, `rows`, `disabled`, `name`, ecc.)

---

## FormTextArea – FormTextAreaProps

Estende `TextAreaProps` con validazioni; richiede `name`. Omette `name`, `innerRef` e alcune props controllate.

| Prop | Tipo | Default | Descrizione |
|------|------|---------|-------------|
| `name` | `string` | — | Nome campo (obbligatorio in form). |
| `validate` | `Validate \| Record<string, Validate>` | — | Validazione custom (react-hook-form). |

---

## Esempio

```tsx
<TextArea
  label="Descrizione"
  helperText="Inserisci un testo."
  color="primary"
  value={value}
  onChange={(val, name, e) => setValue(val)}
  rows={4}
/>
```
