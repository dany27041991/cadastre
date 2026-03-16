# Spinner

Indicatore di caricamento circolare (stile reactstrap); dimensione e stato disabilitato configurabili.

---

## Overview

**Spinner** è l’indicatore di caricamento circolare della libreria. Estende **Spinner** di reactstrap: accetta `size` (predefiniti o valore numerico/stringa in px, rem), `disabled` e le altre props standard (es. `type`, `color` da reactstrap).

---

## Import

```tsx
import { Spinner } from "dxc-webkit";
```

---

## Tipi

- **SpinnerSize:** `'auto' | 'sm' | 'md' | 'lg'` (o `number` / `string` per dimensioni custom)

---

## API – SpinnerProps

Estende `SpinnerProps` di reactstrap.

| Prop | Tipo | Default | Descrizione |
|------|------|---------|-------------|
| `size` | `SpinnerSize \| number \| string` | — | Dimensione (enum, px, rem, ecc.). |
| `disabled` | `boolean` | — | Spinner disabilitato. |

(Altre props reactstrap: `className`, `type`, `color`, ecc.)

---

## Esempio

```tsx
<Spinner size="md" />

<Spinner size={24} />
```
