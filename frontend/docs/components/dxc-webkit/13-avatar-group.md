# AvatarGroup

Gruppo di avatar affiancati; può mostrare solo un numero massimo di avatar e un indicatore “+N” per gli altri.

---

## Esempio

```tsx
import { AvatarGroup, Avatar } from "dxc-webkit";

const avatars = [
  { initials: "AR", size: "sm" as const },
  { initials: "BS", size: "sm" as const },
  { img: "/user3.jpg", alt: "Terzo", size: "sm" as const },
];

// Gruppo con massimo 2 visibili + “+1”
<AvatarGroup
  avatars={avatars}
  size="sm"
  maxAvatarVisible={2}
  showMoreLabel="Altri 1 utente"
/>

// Con totale maggiore del numero di oggetti in avatars
<AvatarGroup
  avatars={[{ initials: "A", size: "sm" as const }]}
  size="sm"
  maxAvatarVisible={1}
  totalCount={5}
  showMoreLabel="Altri 4 utenti"
/>
```

---

## API

Estende `HTMLAttributes<HTMLUListElement>` (eccetto `children`).

| Nome              | Tipo            | Default       | Descrizione |
|-------------------|-----------------|---------------|-------------|
| `className`       | `string`        | —             | Classi CSS aggiuntive. |
| `size`            | `AvatarSizes`   | —             | Dimensione applicata a ogni avatar: `'xs' \| 'sm' \| 'md' \| 'lg' \| 'xl' \| 'auto'`. |
| `avatars`         | `AvatarProps[]` | **obbligatorio** | Array di props per ogni avatar (stesse props del componente `Avatar`). |
| `maxAvatarVisible`| `number`        | —             | Numero massimo di avatar visibili; gli altri sono rappresentati da “+N”. |
| `totalCount`      | `number`        | `avatars.length` | Numero totale di utenti/avatar (utile se `avatars` contiene pochi elementi ma il totale è maggiore). |
| `showMoreLabel`   | `string`        | —             | Descrizione per lo stato “altri” (es. “Altri 3 utenti”), usata per accessibilità. |

Ogni elemento di `avatars` accetta le stesse proprietà di **Avatar** (initials, img, Icon, size, square, ecc.); `size` su `AvatarGroup` ha precedenza se non specificato sul singolo avatar.
