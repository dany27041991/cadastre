# Componenti condivisi locali (`@/shared/ui-components`)

Il modulo `@/shared/ui-components` espone wrapper comuni su dxc-webkit per riuso e stile uniforme.

## Componenti

| Componente   | Descrizione |
|--------------|-------------|
| **Button**   | Pulsante con icona da `icons` (titolo, iconName, onClick, danger, disabled). |
| **ButtonInv**| Pulsante in stile “invertito” (titolo, iconName, onClick, danger, style). |
| **Line**     | Separatore orizzontale (hr con stile tema). |
| **Spinner**  | Indicatore di caricamento (markup/CSS). |
| **DummyIcon**| Icona placeholder (SVG grigio). |

## Import

```tsx
import { Button, Line, Spinner } from "@/shared/ui-components";
// oppure dal barrel shared/ui
import { Button, ButtonInv, Line } from "@/shared/ui";
```

## Esempio

```tsx
import { Button, Line } from "@/shared/ui-components";

<Button title="Salva" iconName="SaveIcon" onClick={handleSave} />
<Line />
```

Così si mantiene un unico punto di utilizzo delle icone e degli stili comuni tra le pagine.
