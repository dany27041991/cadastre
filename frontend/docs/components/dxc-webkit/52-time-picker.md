# TimePicker

Selettore ora (e opzionalmente minuti/secondi) con formato 12h/24h e step configurabili; **FormTimePicker** per form.

---

## Overview

**TimePicker** permette di scegliere l’ora tramite dropdown. Il formato è definito da `type` (HH:MM:SS, HH:MM, HH, MM, SS). Si possono impostare `hoursStep`, `minutesStep`, `secondsStep`, formato `24h` o `12h` (con meridian AM/PM). Callback: `onItemClick(TimeParts, meridian?)` e `onLabelChange(label)`. **FormTimePicker** aggiunge `name`, `onChange(value, name)` e validazioni (es. `required`).

---

## Import

```tsx
import { TimePicker, FormTimePicker } from "dxc-webkit";
```

---

## Tipi

- **TimeParts:** `Partial<{ HH: string; MM: string; SS: string }>`
- **type:** `'HH:MM:SS' | 'HH:MM' | 'HH' | 'MM' | 'SS'`
- **format:** `'24h' | '12h'`
- **secondsStep / minutesStep:** `'1' | '2' | '5' | '10' | '15' | '30'`
- **hoursStep:** `'1' | '2' | '6' | '12'`

---

## TimePicker – TimePickerProps

| Prop | Tipo | Default | Descrizione |
|------|------|---------|-------------|
| `type` | `'HH:MM:SS' \| 'HH:MM' \| 'HH' \| 'MM' \| 'SS'` | — | Struttura del selettore. |
| `format` | `'24h' \| '12h'` | — | Formato ora. |
| `hoursStep` | `string` | — | Step ore (1, 2, 6, 12). |
| `minutesStep` | `string` | — | Step minuti (1, 2, 5, 10, 15, 30). |
| `secondsStep` | `string` | — | Step secondi (1, 2, 5, 10, 15, 30). |
| `color` | `'base' \| 'danger' \| 'success'` | — | Colore. |
| `disabled` | `boolean` | — | Disabilitato. |
| `backdrop` | `boolean` | — | Backdrop del dropdown. |
| `onItemClick` | `(item: TimeParts, meridian?: 'AM' \| 'PM') => void` | — | Click su un valore ora. |
| `onLabelChange` | `(label: string) => void` | — | Cambio etichetta visualizzata. |
| `className` | `string` | — | Classi CSS. |

---

## FormTimePicker – FormTimePickerProps

Estende `TimePickerProps`; richiede `name`. Aggiunge validazioni (es. `required`) e `onChange(value, name)`.

| Prop | Tipo | Default | Descrizione |
|------|------|---------|-------------|
| `name` | `string` | — | Nome campo (obbligatorio). |
| `onChange` | `(value: string, name: string) => void` | — | Cambio valore. |
| `validate` | `Validate` | — | Validazione custom. |

---

## Esempio

```tsx
<TimePicker
  type="HH:MM"
  format="24h"
  onItemClick={(item) => setTime(item)}
  onLabelChange={setTimeLabel}
  color="base"
/>
```
