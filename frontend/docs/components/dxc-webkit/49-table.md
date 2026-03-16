# Table

Tabelle: **Table** (reactstrap), **CustomTable** (colonne, azioni, paginazione, sort), **PaginatedTable** (caricamento righe e azioni); tipi **TableColumn**, **TableRow**, **TableAction**.

---

## Overview

**Table** è la tabella base (reactstrap) con `color` (light/primary). **CustomTable** è la tabella dati: `columns` (id, label, icon, component, isSortable), `rows` (Record), `actions` per riga, paginazione integrata e `handleSort`. **PaginatedTable** è una class component con `loadRows`, `columns` (TableFieldColumn), `actions`, paginazione e ordinamento. Vedi anche [06-table.md](06-table.md) per sintesi CustomTable.

---

## Import

```tsx
import {
  Table,
  CustomTable,
  PaginatedTable,
  TableColumn,
  TableRow,
  TableAction,
  Th,
  TableCell,
  RefTable,
} from "dxc-webkit";
```

---

## Table – TableProps

Estende `TableProps` di reactstrap.

| Prop | Tipo | Default | Descrizione |
|------|------|---------|-------------|
| `color` | `TableColors` | — | `'light' \| 'primary'`. |

---

## CustomTable – CustomTableProps

| Prop | Tipo | Default | Descrizione |
|------|------|---------|-------------|
| `columns` | `TableColumn[]` | — | Definizione colonne. |
| `rows` | `TableRow[]` | — | Dati righe. |
| `color` | `TableColors` | — | `'light' \| 'primary' \| 'primary-alternate'`. |
| `pagination` | `boolean` | — | Abilita paginazione. |
| `paginationOptions` | `number[]` | — | Opzioni paginazione. |
| `handlePaginationChange` | `(newPage, pageSize) => void` | — | Cambio pagina/size. |
| `pageSizeOptions` | `number[]` | — | Scelte "elementi per pagina". |
| `renderDistance` | `number` | — | Distanza rendering paginazione. |
| `actions` | `TableAction[]` | — | Azioni per riga. |
| `actionsColumnName` | `string` | — | Label colonna azioni. |
| `handleSort` | `(args: [id, 'asc' \| 'desc'] \| null) => void` | — | Ordinamento. |
| `wrapperClassName` | `string` | — | Classi wrapper. |
| `wrapperStyle` | `CSSProperties` | — | Stili wrapper. |
| `tableWrapperClassname` | `string` | — | Classi wrapper tabella. |
| `tableWrapperStyle` | `CSSProperties` | — | Stili wrapper tabella. |
| `className` | `string` | — | Classi tabella. |
| `style` | `CSSProperties` | — | Stili tabella. |
| `headerClassName` | `string` | — | Classi header. |
| `headerStyle` | `CSSProperties` | — | Stili header. |
| `headerCellClassName` | `string` | — | Classi celle header. |
| `bodyClassName` | `string` | — | Classi body. |
| `bodyStyle` | `CSSProperties` | — | Stili body. |
| `cellClassName` | `string` | — | Classi celle. |
| `hidePageItemsDropdown` | `boolean` | — | Nasconde dropdown "Risultati per pagina". |
| `hideGoToDropdown` | `boolean` | — | Nasconde dropdown "Vai a". |
| `dropdownLabel` | `string` | — | Label dropdown paginazione. |
| `openTop` | `boolean` | — | Dropdown paginazione verso l'alto. |

---

## TableColumn

| Prop | Tipo | Default | Descrizione |
|------|------|---------|-------------|
| `id` | `string \| number` | — | ID colonna. |
| `label` | `string` | — | Intestazione. |
| `icon` | `FC<SVGRProps>` | — | Icona header. |
| `component` | `(row: TableRow, i: number) => ReactNode` | — | Render custom cella. |
| `isSortable` | `boolean` | — | Ordinabile. |

---

## TableRow

`Record<string, string | number>` – chiavi allineate agli `id` delle colonne.

---

## TableAction

| Prop | Tipo | Default | Descrizione |
|------|------|---------|-------------|
| `id` | `string \| number` | — | ID azione. |
| `label` | `string` | — | Etichetta. |
| `icon` | `FC<SVGRProps>` | — | Icona. |
| `onClick` | `(row: TableRow, index: number) => void` | — | Callback. |
| `isVisible` | `(row, index) => boolean` | — | Visibilità. |

---

## PaginatedTable

Class component. Props principali: `columns` (TableFieldColumn&lt;T&gt;), `loadRows(page, limit, sort)`, `pageSize`, `pageSizeOptions`, `actions` (ActionProps&lt;T&gt;), `defaultSort`, `noPagination`, `dropDownLabel`, `paginationRenderDistance`, `paginationLabel`, `labelHeaderActions`, `onLoad`, `className`.

---

## Esempio CustomTable

```tsx
<CustomTable
  columns={[
    { id: "name", label: "Nome", isSortable: true },
    { id: "age", label: "Età" },
  ]}
  rows={[{ name: "Mario", age: 30 }]}
  color="primary"
  pagination
  pageSizeOptions={[10, 25, 50]}
  handlePaginationChange={(page, size) => {}}
  actions={[{ id: 1, label: "Modifica", onClick: (row) => {} }]}
  actionsColumnName="Azioni"
  handleSort={(args) => {}}
/>
```
