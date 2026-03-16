# Switcher

Toggle a due stati con etichette e/o icone; colore e stato controllato da `active`/`setActive`.

---

## Overview

**Switcher** è un interruttore a due posizioni. Richiede `active` (boolean) e `setActive` (setter). Opzionali: `label1`/`label2`, `Icon1`/`Icon2`, `color` (primary/success/warning/danger), `disabled`, `wrapperStyle`, `buttonStyle`, `ariaLabelActive`.

---

## Import

```tsx
import { Switcher } from "dxc-webkit";
```

---

## Tipi

- **SwitchColor:** `'primary' | 'success' | 'warning' | 'danger'`

---

## API – SwitcherProps

Omette `children` da `HTMLAttributes<HTMLElement>`.

| Prop | Tipo | Default | Descrizione |
|------|------|---------|-------------|
| `active` | `boolean` | — | Stato attivo (obbligatorio). |
| `setActive` | `Dispatch<SetStateAction<boolean>>` | — | Setter stato (obbligatorio). |
| `label1` | `string` | — | Etichetta prima metà. |
| `label2` | `string` | — | Etichetta seconda metà. |
| `Icon1` | `FC<SVGRProps>` | — | Icona prima metà. |
| `Icon2` | `FC<SVGRProps>` | — | Icona seconda metà. |
| `color` | `SwitchColor` | — | Colore. |
| `disabled` | `boolean` | — | Disabilitato. |
| `wrapperStyle` | `CSSProperties` | — | Stili wrapper. |
| `buttonStyle` | `CSSProperties` | — | Stili pulsanti. |
| `ariaLabelActive` | `string` | — | Aria-label per accessibilità. |

---

## Esempio

```tsx
const [on, setOn] = useState(false);

<Switcher
  active={on}
  setActive={setOn}
  label1="Off"
  label2="On"
  color="primary"
/>
```
