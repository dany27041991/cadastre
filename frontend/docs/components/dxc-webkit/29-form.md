# Form

Form generico basato su **react-hook-form**: gestione validazione, submit, reset e valori controllati. Il callback `onValid` riceve i dati solo se la validazione è superata.

---

## Esempio

```tsx
import { Form } from "dxc-webkit";

type MyFormValues = { email: string; password: string };

<Form<MyFormValues>
  onValid={(data) => {
    console.log("Invio:", data);
  }}
  onReset={() => console.log("Form resettato")}
>
  <input name="email" />
  <input name="password" type="password" />
  <button type="submit">Invia</button>
  <button type="button" onClick={() => reset()}>Reset</button>
</Form>

// Con valori iniziali (update entity)
<Form<MyFormValues>
  values={{ email: "user@example.com", password: "" }}
  onValid={handleUpdate}
/>

// Esporre i metodi del form (reset, setValue, getValues, ecc.)
<Form<MyFormValues>
  onValid={handleSubmit}
  exposeMethods={(methods) => {
    formMethodsRef.current = methods;
  }}
/>

// Watch: callback ad ogni modifica
<Form<MyFormValues>
  onValid={handleSubmit}
  watch={(data) => setLiveData(data)}
/>
```

---

## API

Generico: `Form<T extends FieldValues>`. Estende `FormHTMLAttributes<HTMLFormElement>`.

| Nome            | Tipo                    | Default | Descrizione |
|-----------------|-------------------------|---------|-------------|
| `onValid`       | `SubmitHandler<T>`      | **obbligatorio** | Chiamato al submit solo se la validazione passa; riceve l’oggetto con i valori dei campi. |
| `watch`         | `(data: T) => void`     | —       | Chiamato ad ogni modifica dei valori del form. |
| `values`        | `T`                     | —       | Valori iniziali (utile per form in edit). |
| `onReset`       | `() => void`            | —       | Chiamato quando il form viene resettato. |
| `formRef`       | `Ref<HTMLFormElement>`  | —       | Ref al nodo DOM del form. |
| `exposeMethods` | `(methods: UseFormReturn<T>) => void` | — | Espone i metodi di react-hook-form (getValues, setValue, reset, trigger, ecc.). |

I **children** sono i campi del form (input, FormGroup, componenti controllati con `Controller` o `register`). Per validazione usare le regole di react-hook-form sui singoli campi o sui componenti Form* della libreria.
