# Loader

Indicatore di avanzamento: **lineare** (con percentuale, trasferimento, tempo rimanente) o **circolare**; dimensioni e colori configurabili.

---

## Overview

Il componente **Loader** mostra un indicatore di caricamento. Supporta due tipi: **linear** (barra orizzontale, con label, percentuale, `transferred`, `remainingTime`, `finalMessage`) e **circle** (spinner con `size`). Estende le props di **Progress** di reactstrap; supporta tooltip e accessibilità (`ariaLabelProgressBar`).

---

## Import

```tsx
import { Loader } from "dxc-webkit";
```

---

## Tipi

- **LoaderSize:** `'auto' | 'sm' | 'md' | 'lg'`
- **LoaderType:** `'linear' | 'circle'`
- **LoaderColor:** `'primary' | 'success' | 'danger'`

---

## API – LoaderProps

Estende `ProgressProps` di reactstrap.

| Prop | Tipo | Default | Descrizione |
|------|------|---------|-------------|
| `type` | `LoaderType` | — | `'linear'` o `'circle'`. |
| `label` | `string` | — | Testo per il loader lineare. |
| `color` | `LoaderColor` | — | Colore (loader lineare). |
| `size` | `LoaderSize` | — | Dimensione (loader circolare). |
| `value` | `number` | — | Percentuale di completamento (0–100). |
| `disabled` | `boolean` | — | Loader disabilitato. |
| `transferred` | `string` | — | Testo tipo "n of m MB". |
| `remainingTime` | `string` | — | Tempo rimanente mostrato. |
| `finalMessage` | `string` | — | Messaggio a completamento. |
| `tooltipConfig` | `TooltipProps` | — | Configurazione tooltip. |
| `showPercentage` | `boolean` | — | Mostra la percentuale. |
| `ariaLabelProgressBar` | `string` | — | Label ARIA per accessibilità. |

---

## Esempi

### Loader lineare

```tsx
<Loader
  type="linear"
  label="Caricamento in corso..."
  color="primary"
  value={progress}
  showPercentage
  transferred="2 of 5 MB"
  remainingTime="~30 s"
  finalMessage="Completato"
/>
```

### Loader circolare

```tsx
<Loader type="circle" size="md" />
```
