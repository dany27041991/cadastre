# Badge, Spinner, Upload

## Badge

Etichetta/status con colore e dimensione.

### Import

```tsx
import { Badge } from "dxc-webkit";
```

### Props (`BadgeProps`)

Estende `BadgeProps` di reactstrap.

| Prop | Tipo | Descrizione |
|------|------|-------------|
| `color` | `BadgeColor` | `'primary' \| 'success' \| 'warning' \| 'danger' \| 'white'`. |
| `size` | `BadgeSize` | `'auto' \| 'sm' \| 'md' \| 'lg'`. |
| `isOutlined` | `boolean` | Solo bordo, non pieno. |
| `disabled` | `boolean` | Disabilitato. |

---

## Spinner

Indicatore di caricamento (stile reactstrap).

### Import

```tsx
import { Spinner } from "dxc-webkit";
```

### Props (`SpinnerProps`)

| Prop | Tipo | Descrizione |
|------|------|-------------|
| `size` | `SpinnerSize \| number \| string` | `'auto' \| 'sm' \| 'md' \| 'lg'` o valore CSS (px, rem). |
| `disabled` | `boolean` | Disabilitato. |

---

## Upload

Caricamento file: interfaccia “card” (un file) o “form-based” (più file).

### Import

```tsx
import { Upload } from "dxc-webkit";
```

### Props (`UploadProps`)

Estende `HTMLAttributes<HTMLElement>`.

| Prop | Tipo | Descrizione |
|------|------|-------------|
| `disabled` | `boolean` | Disabilita l’upload. |
| `onUpload` | `(file, onProgress, signal) => Promise<void>` | Logica di upload (con progress e AbortSignal). |
| `type` | `'card' \| 'form-based'` | Tipo interfaccia. |
| `accept` | `string` | Tipi file accettati (es. `"image/*"`, `".pdf"`). |
| `onDelete` | `(file: File) => void` | Callback al click su “cestino”. |
| `labelText` | `string` | Etichetta. |
| `labelButtonUpload` | `string` | Testo pulsante upload. |
| `labelDocumentsLoading` | `string` | Testo durante caricamento. |
| `labelDocumentsLoaded` | `string` | Testo a caricamento completato. |
| `style` | `CSSProperties` | Stile container. |

### Esempio

```tsx
<Upload
  type="card"
  accept=".pdf,.doc"
  onUpload={async (file, onProgress, signal) => {
    await uploadFile(file, { onUploadProgress: onProgress, signal });
  }}
  labelButtonUpload="Carica documento"
/>
```
