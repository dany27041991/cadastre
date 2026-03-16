# Scrollbar

Area scrollabile con barra di scroll orizzontale e/o verticale; altezza e larghezza configurabili.

---

## Overview

**Scrollbar** wrappa il contenuto in un’area con scroll. Si può abilitare la barra orizzontale (`scrollbarHorizontal`), quella verticale (`scrollbarVertical`) e un pulsante di scroll (`showBtn`). `height` e `width` impostano le dimensioni dell’area visibile.

---

## Import

```tsx
import { Scrollbar } from "dxc-webkit";
```

---

## API – ScrollbarProps

| Prop | Tipo | Default | Descrizione |
|------|------|---------|-------------|
| `children` | `ReactNode` | — | Contenuto scrollabile. |
| `showBtn` | `boolean` | — | Mostra pulsante per lo scroll. |
| `height` | `number` | — | Altezza (es. px). |
| `width` | `number` | — | Larghezza (es. px). |
| `scrollbarHorizontal` | `boolean` | — | Abilita scroll orizzontale. |
| `scrollbarVertical` | `boolean` | — | Abilita scroll verticale. |

---

## Esempio

```tsx
<Scrollbar height={300} scrollbarVertical showBtn>
  <div>Contenuto lungo...</div>
</Scrollbar>
```
