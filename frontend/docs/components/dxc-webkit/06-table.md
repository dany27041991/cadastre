# Table (CustomTable)

Tabella con colonne configurabili, azioni per riga, paginazione e ordinamento.

## Import

```tsx
import { CustomTable, TableColumn, Th, TableCell, RefTable, PaginatedTable } from "dxc-webkit";
```

## Tipi

### TableColumn

| Prop | Tipo | Descrizione |
|------|------|-------------|
| `id` | `string \| number` | Identificativo colonna. |
| `label` | `string` | Intestazione. |
| `icon` | `FC<SVGRProps>` | Icona in header. |
| `component` | `(row: TableRow, i: number) => ReactNode` | Cella custom per riga. |
| `isSortable` | `boolean` | Abilita ordinamento. |

### TableRow

`Record<string, string | number>` – oggetto con chiavi che corrispondono agli `id` delle colonne.

### TableAction

| Prop | Tipo | Descrizione |
|------|------|-------------|
| `id` | `string \| number` | Id azione. |
| `label` | `string` | Etichetta. |
| `icon` | `FC<SVGRProps>` | Icona. |
| `onClick` | `(row: TableRow, index: number) => void` | Callback. |
| `isVisible` | `(row, index) => boolean` | Visibilità condizionale. |

## CustomTable – Props (`CustomTableProps`)

| Prop | Tipo | Descrizione |
|------|------|-------------|
| `columns` | `TableColumn[]` | Definizione colonne. |
| `rows` | `TableRow[]` | Dati righe. |
| `color` | `TableColors` | `'light' \| 'primary' \| 'primary-alternate'`. |
| `pagination` | `boolean` | Mostra paginazione. |
| `paginationOptions` | `number[]` | Opzioni paginazione. |
| `handlePaginationChange` | `(newPage, pageSize) => void` | Cambio pagina/size. |
| `pageSizeOptions` | `number[]` | Scelte “elementi per pagina”. |
| `actions` | `TableAction[]` | Azioni per riga. |
| `actionsColumnName` | `string` | Label colonna azioni. |
| `handleSort` | `(args: [id, 'asc' \| 'desc'] \| null) => void` | Ordinamento. |
| `wrapperClassName` / `wrapperStyle` | | Stili wrapper esterno. |
| `tableWrapperClassname` / `tableWrapperStyle` | | Stili wrapper tabella. |
| `className` / `style` | | Stili tabella. |
| `headerClassName` / `headerStyle` / `headerCellClassName` | | Stili header. |
| `bodyClassName` / `bodyStyle` / `cellClassName` | | Stili body. |
| `hidePageItemsDropdown` | `boolean` | Nasconde dropdown “Risultati per pagina”. |
| `hideGoToDropdown` | `boolean` | Nasconde “Vai a”. |
| `dropdownLabel` | `string` | Label dropdown paginazione. |
| `openTop` | `boolean` | Apre dropdown paginazione verso l’alto. |
| `renderDistance` | `number` | Distanza di rendering paginazione. |

## Esempio

```tsx
<CustomTable
  columns={[
    { id: "name", label: "Nome", isSortable: true },
    { id: "value", label: "Valore", component: (row) => <Badge>{row.value}</Badge> },
  ]}
  rows={[{ name: "A", value: 1 }, { name: "B", value: 2 }]}
  color="primary"
  pagination
  pageSizeOptions={[10, 25, 50]}
  handlePaginationChange={(page, size) => {}}
  actions={[{ id: "edit", label: "Modifica", onClick: (row) => {} }]}
/>
```
