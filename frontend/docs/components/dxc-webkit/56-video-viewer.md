# VideoViewer

Visualizzatore video con sorgente configurabile, stile (filled/bare/outlined) e overlay/container opzionali.

---

## Overview

**VideoViewer** mostra un player video. Richiede `src` (URL del video). Opzionali: `kind` per lo stile del pulsante/controlli, `buttonTitle`, `disabled`, `renderInto` (selector per render in un altro nodo), `overlayStyle`, `containerStyle`, `videoStyle` per personalizzare layout e aspetto.

---

## Import

```tsx
import { VideoViewer } from "dxc-webkit";
```

---

## API – VideoViewerProps

| Prop | Tipo | Default | Descrizione |
|------|------|---------|-------------|
| `src` | `string` | — | URL del video (obbligatorio). |
| `kind` | `'filled' \| 'bare' \| 'outlined'` | — | Stile del bottone/controlli. |
| `buttonTitle` | `string` | — | Titolo/etichetta del pulsante. |
| `disabled` | `boolean` | — | Disabilita il viewer. |
| `renderInto` | `string` | — | Selettore DOM per renderizzare in un altro elemento. |
| `overlayStyle` | `CSSProperties` | — | Stili overlay. |
| `containerStyle` | `CSSProperties` | — | Stili contenitore. |
| `videoStyle` | `CSSProperties` | — | Stili elemento video. |

---

## Esempio

```tsx
<VideoViewer
  src="https://example.com/video.mp4"
  kind="outlined"
  buttonTitle="Riproduci"
/>
```
