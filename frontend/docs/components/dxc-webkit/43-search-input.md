# SearchInput

Select/autocomplete con ricerca (sync o async); supporta selezione singola o multipla, precarico opzioni e debounce.

---

## Overview

**SearchInput** è basato su **react-select** (e **react-select/async**). Supporta opzioni sincrone o caricamento async (`loadOptions`), precarico (`preloadOptions`, `preloadOptionsByIds`), selezione singola o multipla (`IsMulti`), label, helper text, placeholder, icona, dimensione e colore. **FormSearchInput** e **FoldableSearchInput** sono varianti per form e layout comprimibile.

---

## Import

```tsx
import { SearchInput, FormSearchInput, FoldableSearchInput } from "dxc-webkit";
```

---

## Tipi

- **SearchInputOption:** `{ value: string; label: string | ReactNode }`
- **SearchInputSizes:** `'sm' | 'md' | 'auto'`
- **SearchInputColor:** `'primary' | 'success' | 'danger'`
- **SearchInputSingleOrMultiOptionValue:** `string | undefined` (single) o `string[]` (multi)

---

## API – SearchInputProps

Estende props di react-select e AsyncProps; omette/ridefinisce `loadOptions`, `value`, `onChange`.

| Prop | Tipo | Default | Descrizione |
|------|------|---------|-------------|
| `value` | `string \| string[] \| undefined` | — | Valore selezionato (single o multi). |
| `onChange` | `(value, name?) => void` | — | Cambio selezione. |
| `label` | `string` | — | Etichetta. |
| `helperText` | `string` | — | Testo di aiuto. |
| `isHelperTesxtError` | `boolean` | — | Helper come messaggio di errore. |
| `placeholderText` | `string` | — | Placeholder. |
| `PlaceholderIcon` | `FC<SVGRProps>` | — | Icona nel placeholder. |
| `size` | `SearchInputSizes` | — | Dimensione. |
| `color` | `SearchInputColor` | — | Colore. |
| `showArrow` | `boolean` | — | Mostra freccia nel dropdown. |
| `thick` | `boolean` | — | Altezza maggiore. |
| `disabled` | `boolean` | — | Disabilitato. |
| `loadOptions` | `(input: string) => Promise<SearchInputOption[]>` | — | Caricamento opzioni async. |
| `preloadOptions` | `() => Promise<SearchInputOption[]>` | — | Precarga opzioni. |
| `preloadOptionsByIds` | `(id) => Promise<SearchInputOption[]>` | — | Precarga per id selezionati. |
| `preloadOptionsArgs` | `[]` | — | Argomenti che forzano riesecuzione di preloadOptions. |
| `debounceTimeMillis` | `number` | — | Debounce sulla ricerca. |
| `DropdownIndicator` | `FC<SVGRProps>` | — | Icona dropdown personalizzata. |
| `innerRef` | `(instance: unknown) => void` | — | Ref. |
| `getOptionValue` | `(option: SearchInputOption) => string` | — | Valore testuale per il match di ricerca. |
| `id` | `string` | — | ID dell’input. |

(Supporta anche le props standard di react-select: `options`, `isMulti`, `isClearable`, `isSearchable`, `noOptionsMessage`, `isLoading`, ecc.)

---

## Esempio

```tsx
<SearchInput
  label="Cerca"
  placeholderText="Digita per cercare..."
  value={selected}
  onChange={(val) => setSelected(val)}
  loadOptions={async (input) => fetchOptions(input)}
  debounceTimeMillis={300}
  showArrow
/>
```

---

Vedi anche [Input e SearchInput](05-input-searchinput.md) per Input e una panoramica condivisa.
