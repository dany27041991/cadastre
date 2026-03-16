# Avatar

Rappresentazione dell’utente: iniziali, immagine o icona. Può essere rotondo o quadrato, con diverse dimensioni.

---

## Esempio

```tsx
import { Avatar, icons } from "dxc-webkit";

// Avatar con iniziali
<Avatar initials="MZ" size="md" />

// Avatar con immagine
<Avatar img="/path/to/photo.jpg" alt="Mario Rossi" size="lg" />

// Avatar con icona
<Avatar Icon={icons.UserIcon} size="sm" />

// Avatar quadrato con sfondo
<Avatar initials="AB" size="md" square background />

// Avatar come link
<Avatar href="/profilo" initials="LR" size="md" />

// In un gruppo (numero overflow)
<Avatar initials="+3" numberOfAvatar="3" size="sm" />
```

---

## API

Estende `HTMLAttributes<HTMLElement>`.

| Nome             | Tipo           | Default | Descrizione |
|------------------|----------------|---------|-------------|
| `className`      | `string`       | —       | Classi CSS aggiuntive. |
| `size`           | `AvatarSizes`  | —       | Dimensione: `'xs' \| 'sm' \| 'md' \| 'lg' \| 'xl' \| 'auto'`. |
| `initials`       | `string`       | —       | Iniziali da mostrare (es. `"MZ"`). |
| `square`         | `boolean`      | `false` | Se `true` forma quadrata, altrimenti rotonda. |
| `disabled`       | `boolean`      | `false` | Stato disabilitato. |
| `background`     | `boolean`      | `false` | Abilita sfondo. |
| `img`            | `string`       | —       | URL immagine avatar. |
| `alt`            | `string`       | —       | Testo alternativo per l’immagine. |
| `href`           | `string`       | —       | Se impostato, l’avatar viene reso come link. |
| `Icon`           | `FC<SVGRProps>`| —       | Icona da mostrare al posto di iniziali/immagine. |
| `numberOfAvatar` | `string`       | —       | Usato nei gruppi per indicare il numero di avatar in overflow (es. `"+3"`). |

**Nota:** fornisci uno tra `initials`, `img` o `Icon` (e `alt` se usi `img`).
