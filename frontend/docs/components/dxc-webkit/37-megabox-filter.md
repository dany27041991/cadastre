# MegaboxFilter

Pannello filtri con tab, pulsanti e box filtri: layout orizzontale o verticale, ricerca e reset configurabili.

---

## Overview

**MegaboxFilter** è un contenitore per filtri avanzati: tab per sezioni (`listTabs`), pulsanti tab (`listBtnTab`), eventuale box filtri (`listFilters`) e pulsanti di ricerca/reset. Supporta layout `horizontal` o `vertical`, stato `expanded` e stile pulsanti (`btnKind`: `filled`, `outlined`, `bare`).

---

## Import

```tsx
import { MegaboxFilter } from "dxc-webkit";
```

---

## Tipi

- **ListTabInterface:** `{ value: number; component: JSX.Element }`
- **ListFiltersInterface:** `{ value: number; component: JSX.Element }`
- **ListBtnTabInterface:** `{ label: string; icon: FC<SVGRProps> }`
- **Kinds:** `'filled' | 'outlined' | 'bare'`

---

## API – MegaboxFilter

Estende `HTMLAttributes<HTMLElement>`.

| Prop | Tipo | Default | Descrizione |
|------|------|---------|-------------|
| `listBtnTab` | `ListBtnTabInterface[]` | — | Pulsanti tab (label + icona) (obbligatorio). |
| `expanded` | `boolean` | — | Pannello aperto/chiuso (obbligatorio). |
| `buttons` | `boolean` | — | Mostra/nasconde i pulsanti (obbligatorio). |
| `btnKind` | `Kinds` | — | Stile pulsanti: `filled`, `outlined`, `bare`. |
| `listTabs` | `ListTabInterface[]` | — | Contenuti tab (value + component). |
| `listFilters` | `ListFiltersInterface[]` | — | Componenti filtri (value + component). |
| `filterBox` | `boolean` | — | Abilita box filtri. |
| `horizontal` | `boolean` | — | Layout orizzontale. |
| `vertical` | `boolean` | — | Layout verticale. |
| `labelButton` | `string` | — | Etichetta pulsante generica. |
| `labelResetSearch` | `string` | — | Etichetta pulsante reset. |
| `handleReset` | `() => void` | — | Callback reset. |
| `labelStartSearch` | `string` | — | Etichetta pulsante ricerca. |
| `handleSearch` | `() => void` | — | Callback ricerca. |
| `className` | `string` | — | Classi CSS. |
| `disabled` | `boolean` | — | Disabilita il componente. |

---

## Esempio

```tsx
<MegaboxFilter
  listBtnTab={[
    { label: "Filtri", icon: icons.IconFilter },
    { label: "Avanzati", icon: icons.IconCog },
  ]}
  listTabs={[
    { value: 0, component: <FilterFormA /> },
    { value: 1, component: <FilterFormB /> },
  ]}
  listFilters={[{ value: 0, component: <QuickFilters /> }]}
  filterBox
  expanded={isExpanded}
  buttons
  btnKind="outlined"
  labelResetSearch="Azzera"
  handleReset={resetFilters}
  labelStartSearch="Cerca"
  handleSearch={applyFilters}
/>
```
