# DefaultPage

Pagina predefinita per errori (es. 404) o stati vuoti: immagine, codice errore, titolo, descrizione e pulsante azione.

---

## Esempio

```tsx
import { DefaultPage } from "dxc-webkit";

<DefaultPage
  codeError="404"
  title="Pagina non trovata"
  description="L’URL richiesto non esiste o è stato spostato."
  buttonLabel="Torna alla home"
  onButtonClick={() => navigate("/")}
/>

// Con immagine custom
<DefaultPage
  codeError="500"
  imageSrc="/error-500.svg"
  title="Errore del server"
  description={<><strong>Si è verificato un errore.</strong> Riprova più tardi.</>}
  buttonLabel="Ricarica"
  onButtonClick={() => window.location.reload()}
  wrapperClassName="my-default-page"
/>
```

---

## API

Estende `HTMLAttributes<HTMLDivElement>`.

| Nome             | Tipo       | Default | Descrizione |
|------------------|------------|---------|-------------|
| `codeError`      | `string`   | **obbligatorio** | Codice da mostrare (es. `"404"`, `"500"`). |
| `title`          | `string`   | **obbligatorio** | Testo principale (headline). |
| `description`    | `ReactNode`| —       | Testo descrittivo (può essere JSX). |
| `imageSrc`       | `string`   | —       | URL immagine (es. illustrazione 404). |
| `buttonLabel`    | `string`   | —       | Etichetta del pulsante. |
| `onButtonClick`  | `() => void` | —     | Callback al click sul pulsante. |
| `wrapperClassName` | `string` | —       | Classi CSS per il wrapper. |
