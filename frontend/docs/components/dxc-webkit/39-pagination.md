# Pagination

Paginazione con pulsanti pagina e opzionale menu a discesa; supporta href o callback al click.

---

## Overview

**Pagination** mostra la pagina corrente e un set di link/pulsanti per le pagine vicine. Si può usare `pageHref(page)` per link reali o `onPageClick(page)` per gestione via stato. `renderDistance` controlla quante pagine mostrare intorno alla corrente; `smallVariant` riduce le dimensioni. Le helper `getPageItems` e `getDropDownItems` generano gli elementi per layout custom.

---

## Import

```tsx
import { Pagination, getPageItems, getDropDownItems } from "dxc-webkit";
```

---

## Tipi

- **PaginationSize:** `'sm' | 'md' | 'lg'`

---

## API – PaginationProps

Estende `HTMLAttributes<HTMLDivElement>`.

| Prop | Tipo | Default | Descrizione |
|------|------|---------|-------------|
| `currentPage` | `number` | — | Pagina corrente (obbligatorio). |
| `totalPages` | `number` | — | Numero totale di pagine (obbligatorio). |
| `pageHref` | `(page: number) => string` | — | Genera l’href per ogni pagina. |
| `onPageClick` | `(page: number) => void` | — | Chiamato al click su una pagina (alternativa a href). |
| `pageLabel` | `string` | — | Etichetta per le pagine. |
| `dropDownLabel` | `string` | — | Etichetta per il menu a discesa. |
| `hideDropDown` | `boolean` | — | Nasconde il dropdown. |
| `renderDistance` | `number` | — | Numero di pulsanti a sinistra/destra della pagina attiva. |
| `smallVariant` | `boolean` | — | Variante compatta. |
| `pageIndexRole` | `string` | — | Ruolo ARIA per l’indice di pagina. |

---

## Helper

| Funzione | Descrizione |
|---------|-------------|
| `getPageItems(currentPage, totalPages, renderDistance?, pageHref?, onPageClick?, breakpoint?, smallVariant?, pageIndexRole?)` | Restituisce array di elementi React per i pulsanti pagina. |
| `getDropDownItems(currentPage, totalPages, pageLabel, pageHref?, onPageClick?)` | Restituisce elementi per il dropdown delle pagine. |

---

## Esempio

```tsx
<Pagination
  currentPage={page}
  totalPages={totalPages}
  onPageClick={(p) => setPage(p)}
  pageLabel="Pagina"
  dropDownLabel="Vai a pagina"
  renderDistance={2}
  smallVariant
/>
```
