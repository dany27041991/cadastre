# Slider

Slider numerico (singolo o range) basato su **rc-slider**; label, icone, tooltip e input opzionali.

---

## Overview

**Slider** estende le props di **rc-slider**. Supporta valore singolo o intervallo (`ranged`), `step`, `label`, due icone (`Icon`, `Icon2`), `showPercentage`, `showInputField` per campi numerici, `tooltipConfig` e `onChange(value)`. Colori: `primary`, `success`, `danger`.

---

## Import

```tsx
import { Slider } from "dxc-webkit";
```

---

## Tipi

- **SliderColorType:** `'primary' | 'success' | 'danger'`

---

## API – SliderProps

Estende `SliderProps` di rc-slider.

| Prop | Tipo | Default | Descrizione |
|------|------|---------|-------------|
| `value` | `number \| number[]` | — | Valore corrente (singolo o range). |
| `onChange` | `(value: number \| number[]) => void` | — | Cambio valore. |
| `ranged` | `boolean` | — | Intervallo (due thumb). |
| `step` | `number` | — | Incremento. |
| `color` | `SliderColorType` | — | Colore. |
| `disabled` | `boolean` | — | Disabilitato. |
| `label` | `string` | — | Etichetta sopra lo slider. |
| `Icon` | `FC<SVGRProps>` | — | Icona inizio. |
| `Icon2` | `FC<SVGRProps>` | — | Icona fine. |
| `showPercentage` | `boolean` | — | Mostra percentuale. |
| `showInputField` | `boolean` | — | Mostra campi input per i valori. |
| `tooltipConfig` | `TooltipProps` | — | Configurazione tooltip. |
| `className` | `string` | — | Classi CSS. |

(min, max e altre props da rc-slider sono supportate.)

---

## Esempio

```tsx
<Slider
  label="Valore"
  value={value}
  onChange={setValue}
  min={0}
  max={100}
  step={5}
  color="primary"
  showPercentage
/>
```

Range:

```tsx
<Slider ranged value={[20, 80]} onChange={setRange} min={0} max={100} />
```
