# react-select

**Uso:** select, dropdown, ricerca con autocomplete.

## Installazione

Già in `package.json`: `react-select@^5.10.2`.

## Esempio base

```tsx
import Select from "react-select";

const options = [
  { value: "a", label: "Opzione A" },
  { value: "b", label: "Opzione B" },
];

<Select
  options={options}
  value={selected}
  onChange={(opt) => setSelected(opt)}
  placeholder="Seleziona..."
  isClearable
  isSearchable
/>
```

Per stile allineato al tema (es. dxc-webkit) si può usare `styles` e `components` di react-select (customizzazione).

## Documentazione ufficiale

- [react-select – documentazione](https://react-select.com/home)
- [Props ed esempi](https://react-select.com/props)
