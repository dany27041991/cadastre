# DatePicker

Selezione data (e opzionalmente ora). Basato su **react-datepicker**; supporta intervallo min/max, cancellazione, localizzazione e formato custom. **FormDatePicker** per integrazione con react-hook-form.

---

## Esempio

```tsx
import { DatePicker, FormDatePicker } from "dxc-webkit";

// DatePicker controllato
<DatePicker
  name="dataScadenza"
  label="Data scadenza"
  value={date}
  onChange={(date, name) => setDate(date)}
  min={new Date()}
  locale="it"
  isClearable
/>

// Solo data (placeholder, helper, disabilitato)
<DatePicker
  name="dataNascita"
  label="Data di nascita"
  placeholder="Seleziona data"
  helperText="Formato gg/mm/aaaa"
  disabled={false}
/>

// Con selezione ora
<DatePicker
  name="dataOra"
  label="Data e ora"
  showTimeSelect
  timeIntervals={15}
  customDateTimeFormat="dd/MM/yyyy HH:mm"
/>

// FormDatePicker (con react-hook-form)
<FormDatePicker name="dataConsegna" label="Data consegna" required />
```

---

## API

### DatePickerProps

| Nome                   | Tipo                    | Default | Descrizione |
|------------------------|-------------------------|---------|-------------|
| `name`                 | `string`                | **obbligatorio** | Nome del campo. |
| `value`                | `Date \| null`          | —       | Data selezionata. |
| `onChange`             | `(date, name, event?) => void` | — | Callback al cambio data. |
| `min`                  | `Date \| number`        | —       | Data minima selezionabile. |
| `max`                  | `Date \| number`        | —       | Data massima selezionabile. |
| `label`                | `string`                | —       | Etichetta. |
| `helperText`           | `string`                | —       | Testo di aiuto sotto il campo. |
| `isHelperTesxtError`   | `boolean`               | —       | Stile errore per helper text. |
| `placeholder`          | `string`                | —       | Placeholder. |
| `color`                | `InputColors`           | —       | Colore (primary, danger, success, secondary). |
| `disabled`             | `boolean`               | —       | Disabilitato. |
| `isClearable`          | `boolean`               | —       | Pulsante per cancellare la data. |
| `onCustomClear`        | `(event?) => void`      | —       | Callback al click su Clear (versione DXC). |
| `locale`               | `'it' \| 'en' \| 'es'`  | —       | Localizzazione. |
| `innerRef`             | `(instance: unknown) => void` | —  | Ref all’elemento. |
| `showTimeSelect`       | `boolean`               | —       | Mostra anche selezione ora. |
| `showTimeSelectOnly`   | `boolean`               | —       | Solo selezione ora. |
| `timeIntervals`        | `number`                | —       | Intervallo minuti (es. 15). |
| `customDateFormat`     | `string`                | —       | Formato data (es. dd/MM/yyyy). |
| `customTimeFormat`     | `string`                | —       | Formato ora. |
| `customDateTimeFormat` | `string`                | —       | Formato data+ora. |
| `id`                   | `string`                | —       | ID univoco. |
| `className`            | `string`                | —       | Classi CSS. |
| `popperContainer`      | `(props) => ReactNode`  | —       | Container per il popper (render). |

### FormDatePickerProps

Eredita da DatePicker; aggiunge: `name` (obbligatorio), `defaultValue`, `min`/`max` come regole di validazione (`DateValidationRule`), `validate` (react-hook-form), `onChange` opzionale. Per `required` e altre validazioni usare le props di Validations.
