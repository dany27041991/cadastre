# Dropdown

Menu a tendina: pulsante che apre una lista di voci (DropdownItem, DropdownLink) o divisori (DropdownDivider). Supporta icona, dimensione, colore, search e bottone “Mostra tutti”. **CustomDropdown** per variante con label/secondLabel e comportamento custom.

---

## Esempio

```tsx
import { Dropdown, DropdownItem, DropdownLink, DropdownDivider, icons } from "dxc-webkit";

// Dropdown con voci e link
<Dropdown
  title="Azioni"
  Icon={icons.CaretDownIcon}
  size="md"
  dropdownColor="primary"
>
  <DropdownItem label="Modifica" Icon={icons.PenIcon} onClick={() => {}} />
  <DropdownDivider />
  <DropdownLink label="Apri link" url="/documento" />
</Dropdown>

// Con search e “Mostra tutti”
<Dropdown
  title="Cerca"
  searchInput={<SearchInput placeholderText="Filtra..." />}
  showMore
  showMoreButtonConfig={{ children: "Tutti i risultati" }}
>
  <DropdownItem label="Voce 1" />
  <DropdownItem label="Voce 2" />
</Dropdown>

// CustomDropdown (label, secondLabel, children come opzioni)
<CustomDropdown
  title="Seleziona"
  label="Opzione corrente"
  secondLabel={<Badge>3</Badge>}
  children={[<span key="1">A</span>, <span key="2">B</span>]}
  onItemClick={(item, index) => {}}
/>
```

---

## API

### Dropdown

Estende le props di reactstrap `Dropdown` (e `HTMLAttributes<HTMLElement>`).

| Nome                    | Tipo                    | Default | Descrizione |
|-------------------------|-------------------------|---------|-------------|
| `title`                 | `string`                | —       | Etichetta del pulsante. |
| `size`                  | `DropdownSizes`         | —       | `'sm' \| 'md' \| 'auto'`. |
| `alignItems`            | `"center" \| "start" \| "end" \| "between" \| "around" \| "evenly"` | — | Allineamento voci. |
| `Icon`                  | `FC<SVGRProps>`        | —       | Icona nel pulsante. |
| `onCloseClicked`        | `MouseEventHandler`    | —       | Callback alla chiusura. |
| `searchInput`           | `ReactNode`            | —       | Nodo per la ricerca (es. SearchInput). |
| `showMore`              | `boolean`              | —       | Mostra bottone “Tutti i risultati” in fondo. |
| `showMoreButtonConfig`  | `ButtonProps`           | —       | Config del bottone “Mostra tutti”. |
| `withDropdownButton`    | `boolean`              | —       | Usa un bottone dedicato per aprire. |
| `DropdownButton`        | `FC<HTMLAttributes<HTMLElement>>` | — | Componente bottone custom. |
| `DropdownButtonIcon`    | `FC<SVGRProps>`        | —       | Icona del bottone. |
| `dropdownButtonLabel`   | `string`               | —       | Label del bottone. |
| `dropdownColor`         | `DropdownColors`       | —       | `'primary' \| 'danger' \| 'success'`. |

I **children** sono in genere `DropdownItem`, `DropdownLink`, `DropdownDivider`.

### DropdownItem

Estende `DropdownItemProps` di reactstrap.

| Nome       | Tipo                    | Descrizione |
|------------|-------------------------|-------------|
| `label`    | `string`                | Testo della voce. |
| `title`    | `string`                | Titolo/tooltip. |
| `Icon`     | `FC<SVGRProps> \| ElementType` | Icona a sinistra. |
| `Icon2`    | `FC<SVGRProps>`         | Seconda icona. |
| `textAlign`| `"center" \| "left" \| "right"` | Allineamento testo. |
| `disabled` | `boolean`               | Voce disabilitata. |
| `checkbox` | `ReactNode`             | Nodo checkbox. |
| `tooltip`  | `TooltipProps`          | Config tooltip. |
| `isActive` | `boolean`               | Stato attivo. |

### DropdownLink

Voce che si comporta come link: `url`, `onClick`, `tooltip` (oltre alle props di DropdownItem base).

### DropdownDivider

Divisore tra voci; nessuna prop richiesta.

### CustomDropdown (CustomDropDown)

| Nome                        | Tipo     | Descrizione |
|-----------------------------|----------|-------------|
| `title`                     | `string` | Etichetta. |
| `helper`                    | `string` | Testo di aiuto. |
| `label` / `secondLabel`     | `string \| ReactNode` | Primo e secondo label (es. valore selezionato). |
| `Icon`                      | `FC<SVGRProps>` | Icona. |
| `iconSize`                  | `Sizes`  | Dimensione icona. |
| `children`                  | `ReactNode[]` | **obbligatorio** – Opzioni del menu. |
| `onItemClick`               | `(item, index) => void` | Click su una voce. |
| `isDropdownOpen`            | `boolean` | Stato aperto/chiuso (controllato). |
| `disabled`                  | `boolean` | Disabilitato. |
| `backdrop`                  | `boolean` | Click su backdrop per chiudere. |
| `openTop`                   | `boolean` | Apre il menu verso l’alto. |
| `displayButtonAppearance`  | `"base" \| "danger" \| "success"` | Aspetto pulsante. |
| `defaultText`               | `string` | Testo quando label vuoto. |
| `wrapperClassName`          | `string` | Classi container. |
| `displayButtonClassName`    | `string` | Classi pulsante. |
| `menuClassName` / `innerMenuClassname` / `menuItemClassname` | `string` | Classi menu. |
| `hideArrow`                 | `boolean` | Nasconde le frecce. |
| `ArrowUpOverride` / `ArrowDownOverride` | `FC<SVGRProps>` | Icone frecce custom. |
