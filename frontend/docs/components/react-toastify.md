# react-toastify

**Uso:** notifiche toast (successo, errore, info).

## Setup globale

Nel root dell’app (es. `App.tsx` o layout principale):

```tsx
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

// nel JSX
<ToastContainer position="top-right" autoClose={3000} />
```

## Uso nei componenti

```tsx
import { toast } from "react-toastify";

toast.success("Operazione completata");
toast.error("Si è verificato un errore");
toast.info("Informazione");
toast("Messaggio neutro");
```

Con opzioni:

```tsx
toast.success("Salvato", { autoClose: 2000 });
toast.error("Errore", { toastId: "my-error" });
```

## Documentazione ufficiale

- [react-toastify – GitHub](https://github.com/fkhadra/react-toastify)
- [API e opzioni](https://fkhadra.github.io/react-toastify/introduction)
