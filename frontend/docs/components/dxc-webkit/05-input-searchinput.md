# Input e SearchInput

## Input

Campo di testo con label, helper text, icona e opzione "clear".

---

### Overview

**Input** estende gli attributi nativi dell'`<input>` (tranne `size` e `onChange`). Supporta label, helper text, colore (`InputColors`), icona, pulsante clear (`isClearable`/`onClear`) e prefisso; `onChange` ha signature `(value, name, e)`.

---

### Import

```tsx
import { Input, FormInput, PhoneInput } from "dxc-webkit";
```

### Props (`InputProps`)

Omette `size` e `onChange` da `InputHTMLAttributes`; signature `onChange` dedicata.

| Prop | Tipo | Default | Descrizione |
|------|------|---------|-------------|
| `label` | `string` | — | Etichetta. |
| `helperText` | `string` | — | Testo di aiuto sotto il campo. |
| `color` | `InputColors` | — | `'primary' \| 'danger' \| 'success' \| 'secondary'`. |
| `Icon` | `FC<SVGRProps>` | — | Icona nell’input. |
| `isClearable` | `boolean` | — | Pulsante per cancellare il valore. |
| `ariaLabelClearable` | `string` | — | Aria-label per il pulsante clear. |
| `onChange` | `(value: string, name: string, e: ChangeEvent<HTMLInputElement>) => void` | — | Cambio valore. |
| `onClear` | `() => void` | — | Chiamato quando il campo viene svuotato. |
| `innerRef` | `(instance: unknown) => void` | — | Ref interno. |
| `defPrefix` | `string` | — | Prefisso visuale. |

---

## SearchInput

Select/autocomplete con ricerca (anche async), basato su **react-select**.

### Import

```tsx
import { SearchInput, FoldableSearchInput, FormSearchInput } from "dxc-webkit";
```

### Tipi

- **SearchInputOption:** `{ value: string; label: string | ReactNode }`
- **SearchInputSizes:** `'sm' \| 'md' \| 'auto'`
- **SearchInputColor:** `'primary' \| 'success' \| 'danger'`

### Props principali (`SearchInputProps`)

Omette/estende props di react-select; supporta `IsMulti` e `Group`.

| Prop | Tipo | Descrizione |
|------|------|-------------|
| `value` | `string \| string[]` | Valore selezionato (single o multi). |
| `onChange` | `(value, name?) => void` | Cambio selezione. |
| `label` | `string` | Etichetta. |
| `helperText` | `string` | Testo di aiuto. |
| `placeholderText` | `string` | Placeholder. |
| `PlaceholderIcon` | `FC<SVGRProps>` | Icona nel placeholder. |
| `size` | `SearchInputSizes` | Dimensione. |
| `color` | `SearchInputColor` | Colore. |
| `showArrow` | `boolean` | Icona freccia. |
| `thick` | `boolean` | Altezza maggiore. |
| `disabled` | `boolean` | Disabilitato. |
| `loadOptions` | `(input: string) => Promise<SearchInputOption[]>` | Opzioni async. |
| `preloadOptions` | `() => Promise<SearchInputOption[]>` | Precarga opzioni. |
| `preloadOptionsByIds` | `(id) => Promise<SearchInputOption[]>` | Precarga per id. |
| `debounceTimeMillis` | `number` | Debounce ricerca. |
| `DropdownIndicator` | `FC<SVGRProps>` | Icona dropdown personalizzata. |
| `innerRef` | `(instance: unknown) => void` | Ref. |
| `getOptionValue` | `(option) => string` | Valore testuale per il match di ricerca. |

### Esempio

```tsx
<SearchInput
  label="Cerca"
  placeholderText="Digita per cercare..."
  value={selected}
  onChange={(val) => setSelected(val)}
  loadOptions={async (input) => fetchOptions(input)}
  debounceTimeMillis={300}
/>
```
