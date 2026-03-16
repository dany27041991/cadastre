# Toggle

Interruttore on/off con label, helper text e posizione (sinistra/destra); **FormToggle** per form con validazioni.

---

## Overview

**Toggle** è un input tipo checkbox stilizzato come switch. Omette `onChange` da `InputHTMLAttributes`; la signature è `onChange(value: boolean, name, e)`. Supporta `label`, `helperText`, `right` (toggle a destra), `danger` (stato pericolo) e `innerRef`. **FormToggle** richiede `name` e supporta validazioni (react-hook-form), senza `defaultValue` in modalità controllata.

---

## Import

```tsx
import { Toggle, FormToggle } from "dxc-webkit";
```

---

## Toggle – ToggleProps

Omette `onChange` da `InputHTMLAttributes<HTMLInputElement>`.

| Prop | Tipo | Default | Descrizione |
|------|------|---------|-------------|
| `label` | `string` | — | Etichetta. |
| `helperText` | `string` | — | Testo di aiuto sotto il toggle. |
| `right` | `boolean` | — | Se `true`, toggle a destra; altrimenti a sinistra. |
| `danger` | `boolean` | — | Stile "danger" (rosso). |
| `onChange` | `(value: boolean, name: string, e: ChangeEvent<HTMLInputElement>) => void` | — | Cambio stato. |
| `innerRef` | `(instance: unknown) => void` | — | Ref all’input. |

(Supporta anche `checked`, `disabled`, `name`, ecc. da input.)

---

## FormToggle – FormToggleProps

Estende `ToggleProps` con validazioni; richiede `name`. Omette `defaultValue`, `name`, `innerRef` e alcune props controllate.

| Prop | Tipo | Default | Descrizione |
|------|------|---------|-------------|
| `name` | `string` | — | Nome campo (obbligatorio). |
| `validate` | `Validate<boolean> \| Record<string, Validate<boolean>>` | — | Validazione custom. |

---

## Esempio

```tsx
<Toggle
  label="Abilita opzione"
  helperText="Attiva o disattiva."
  checked={enabled}
  onChange={(val) => setEnabled(val)}
  right
/>
```
