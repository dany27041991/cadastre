# TabNavigation

Navigazione a schede con **TabNavigation** (contenitore) e **Tab** (singola scheda con label e icona).

---

## Overview

**TabNavigation** estende **Nav** di reactstrap: contenitore per schede orizzontali. Supporta `white` (sfondo bianco), `simple` e `style`. Ogni scheda è un **Tab** con `label`, `Icon`, `showIcon`, `active`, `disabled`, `border`, `simpletab`.

---

## Import

```tsx
import { TabNavigation, Tab } from "dxc-webkit";
```

---

## TabNavigation – TabNavigationProps

Estende `NavProps` di reactstrap.

| Prop | Tipo | Default | Descrizione |
|------|------|---------|-------------|
| `white` | `boolean` | — | Sfondo bianco. |
| `simple` | `boolean` | — | Stile semplificato. |
| `style` | `CSSProperties` | — | Stili. |
| `className` | `string` | — | Classi CSS. |

(Altre props Nav: `tabs`, `pills`, `vertical`, ecc.)

---

## Tab – TabProps

Estende `HTMLAttributes<HTMLElement>`.

| Prop | Tipo | Default | Descrizione |
|------|------|---------|-------------|
| `label` | `string \| ReactNode` | — | Etichetta scheda. |
| `Icon` | `FC<SVGRProps>` | — | Icona (obbligatorio). |
| `showIcon` | `boolean` | — | Mostra icona (obbligatorio). |
| `active` | `boolean` | — | Scheda attiva. |
| `disabled` | `boolean` | — | Scheda disabilitata. |
| `border` | `boolean` | — | Contorno. |
| `simpletab` | `boolean` | — | Stile semplice. |

---

## Esempio

```tsx
<TabNavigation white>
  <Tab label="Scheda 1" Icon={icons.Home} showIcon active />
  <Tab label="Scheda 2" Icon={icons.Settings} showIcon />
  <Tab label="Scheda 3" Icon={icons.User} showIcon disabled />
</TabNavigation>
```
