# Upload

Caricamento file con due varianti (card o form-based), callback di progresso e cancellazione.

---

## Overview

**Upload** gestisce il caricamento di file. **type** `card`: interfaccia semplice, un file alla volta, area per i file caricati. **type** `form-based`: più file, flusso articolato. `onUpload(file, onProgress, signal)` esegue il caricamento (Promise); `onProgress` riceve eventi di avanzamento; `signal` permette l’aborto. Opzionali: `accept`, `onDelete`, etichette per pulsante e stati (caricamento/completato).

---

## Import

```tsx
import { Upload } from "dxc-webkit";
```

---

## Tipi

- **UploadType:** `'card' | 'form-based'`

---

## API – UploadProps

Estende `HTMLAttributes<HTMLElement>`.

| Prop | Tipo | Default | Descrizione |
|------|------|---------|-------------|
| `onUpload` | `(file: File, onProgress: (e: AxiosProgressEvent) => void, signal: AbortSignal) => Promise<void>` | — | Funzione di caricamento (obbligatoria per upload effettivo). |
| `type` | `UploadType` | — | `'card'` (singolo file) o `'form-based'` (multipli). |
| `accept` | `string` | — | Tipi file accettati (es. `"image/*"`, `".pdf"`, `".png, .jpg"`). |
| `onDelete` | `(file: File) => void` | — | Chiamato al click sul pulsante cestino. |
| `disabled` | `boolean` | — | Upload disabilitato. |
| `labelText` | `string` | — | Testo etichetta. |
| `labelButtonUpload` | `string` | — | Etichetta pulsante caricamento. |
| `labelDocumentsLoading` | `string` | — | Testo durante il caricamento. |
| `labelDocumentsLoaded` | `string` | — | Testo a caricamento completato. |
| `style` | `CSSProperties` | — | Stili contenitore. |

---

## Esempio

```tsx
<Upload
  type="card"
  accept=".pdf,.doc"
  labelButtonUpload="Carica documento"
  labelDocumentsLoading="Caricamento in corso..."
  labelDocumentsLoaded="Documenti caricati"
  onUpload={async (file, onProgress, signal) => {
    await uploadFile(file, { onUploadProgress: onProgress, signal });
  }}
  onDelete={(file) => removeFile(file)}
/>
```
