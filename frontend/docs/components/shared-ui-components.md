# Componenti condivisi locali (`@/shared/ui` / `@/shared/ui-components`)

Il modulo espone wrapper comuni su **dxc-webkit** per riuso e stile uniforme. Preferire questi wrapper invece di ripetere `Loader` / `Chip` inline.

## Componenti

| Componente | Descrizione |
|------------|-------------|
| **Button** | Pulsante con icona da `icons` (titolo, iconName, onClick, danger, disabled). |
| **ButtonInv** | Pulsante in stile “invertito” (titolo, iconName, onClick, danger, style). |
| **Line** | Separatore orizzontale (hr con stile tema). |
| **Spinner** | `Loader` circle dxc-webkit (verde). Props: `size`, `ariaLabel`. |
| **LoadingState** | Spinner + label opzionale (blocco caricamento riusabile). |
| **BackNavHeader** | Chip outlined a destra + titolo/hint (navigazione indietro). Props: `titleLabel` (es. «Nome area gestita»). |
| **DummyIcon** | Icona placeholder (SVG grigio). |

## Import

```tsx
import { Button, Line, Spinner, LoadingState, BackNavHeader } from '@/shared/ui'
```

## Esempi

```tsx
import { Button, Line, LoadingState, BackNavHeader } from '@/shared/ui'

<Button title="Salva" iconName="SaveIcon" onClick={handleSave} />
<Line />

<LoadingState size="l" label={t('territory.loading')} />

<BackNavHeader
  backLabel={t('territory.table.backToAreas')}
  onBack={goBack}
  title={areaName}
  hint={t('territory.table.drillAreaAssetsHint')}
/>
```

Unico punto di utilizzo di loader e pattern di navigazione indietro tra le pagine.
