# EmptyIcon

Icona SVG per stati vuoti (nessun risultato, lista vuota, errore senza contenuto). Accetta le props standard di SVG e titolo per accessibilità.

---

## Esempio

```tsx
import { EmptyIcon } from "dxc-webkit";

<EmptyIcon title="Nessun elemento" titleId="empty-state" />

// Con dimensioni e classi
<EmptyIcon
  title="Nessun risultato"
  className="empty-state-icon"
  width={64}
  height={64}
/>
```

---

## API

Estende `SVGProps<SVGSVGElement>` e espone:

| Nome      | Tipo     | Default | Descrizione |
|-----------|----------|---------|-------------|
| `title`   | `string` | —       | Testo per accessibilità / tooltip. |
| `titleId` | `string` | —       | Id associato al titolo. |

È un componente funzionale che renderizza un’icona SVG “vuota”; per stili e dimensioni usare `className`, `width`, `height` e le altre props SVG.
