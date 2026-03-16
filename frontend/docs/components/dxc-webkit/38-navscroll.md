# Navscroll

Navigazione con scroll: contenitore **Navscroll** con voci **NavscrollItem** e sotto-voci **NavscrollSubItem**; supporto multi-apertura e stato attivo.

---

## Overview

**Navscroll** è un componente di navigazione verticale espandibile. Ogni **NavscrollItem** può avere un’icona, titolo, stato attivo e sotto-voci (**NavscrollSubItem**). Con `allowMultiple` più voci possono restare aperte; `defaultIndex` imposta gli indici aperti all’avvio.

---

## Import

```tsx
import { Navscroll, NavscrollItem, NavscrollSubItem } from "dxc-webkit";
```

---

## Navscroll – NavscrollProps

Estende `HTMLAttributes<HTMLElement>`.

| Prop | Tipo | Default | Descrizione |
|------|------|---------|-------------|
| `allowMultiple` | `boolean` | — | Se `true`, più item possono essere aperti contemporaneamente. |
| `defaultIndex` | `number[]` | — | Indici degli item aperti di default. |
| `title` | `string` | — | Titolo del blocco nav. |
| `disabled` | `boolean` | — | Disabilita l’intera nav. |
| `className` | `string` | — | Classi CSS. |
| `children` | `ReactNode` | — | Contenuto (NavscrollItem). |

---

## NavscrollItem – NavscrollItemProps

Estende `NavscrollProps`. Gestisce voce di primo livello e sottomenu.

| Prop | Tipo | Default | Descrizione |
|------|------|---------|-------------|
| `Icon` | `FC<SVGRProps>` | — | Icona della voce. |
| `title` | `string` | — | Testo della voce. |
| `isActive` | `boolean` | — | Voce evidenziata come attiva. |
| `isSubActive` | `boolean` | — | Una sotto-voce è attiva. |
| `activeSubIndex` | `number` | — | Indice della sotto-voce attiva. |
| `activeIndex` | `number` | — | Indice attivo (contesto parent). |
| `mainIndex` | `number` | — | Indice della voce principale. |
| `disabled` | `boolean` | — | Voce disabilitata. |
| `onToggle` | `() => void` | — | Chiamato all’apertura/chiusura della voce. |
| `onSubTogglefromParent` | `(index: number) => void` | — | Callback dal parent per toggle sotto-voce. |
| `onClick` | `MouseEventHandler<HTMLElement>` | — | Click sulla voce. |
| `className` | `string` | — | Classi CSS. |

---

## NavscrollSubItem – NavscrollSubItemprops

Estende `NavscrollItemProps`. Sotto-voce del menu.

| Prop | Tipo | Default | Descrizione |
|------|------|---------|-------------|
| `isSubActive` | `boolean` | — | Sotto-voce attiva. |
| `onSubToggle` | `() => void` | — | Toggle della sotto-voce. |
| `onClick` | `MouseEventHandler<HTMLElement>` | — | Click sulla sotto-voce. |

---

## Esempio

```tsx
<Navscroll title="Menu" allowMultiple defaultIndex={[0]}>
  <NavscrollItem
    title="Sezione 1"
    Icon={icons.IconName}
    isActive={active === 1}
    onToggle={() => setOpen1(!open1)}
  >
    <NavscrollSubItem title="Sotto 1" onClick={() => setActive(1)} />
    <NavscrollSubItem title="Sotto 2" onClick={() => setActive(2)} />
  </NavscrollItem>
  <NavscrollItem title="Sezione 2" />
</Navscroll>
```
