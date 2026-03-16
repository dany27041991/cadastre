# dxc-webkit (design system MASE/DXC)

**Versione:** `1.6.0`  
**Uso:** componenti base (testo, pulsanti, pannelli, modali, tabelle, icone).

Per **documentazione dettagliata** di ogni componente (props, tipi, esempi) vedi la cartella **[dxc-webkit/](dxc-webkit/README.md)**.

## Import rapido

```tsx
import { Text, Button, InfoPanel, Modal, Spinner, icons } from "dxc-webkit";
import { CustomTable, TableColumn, Badge, Input, SearchInput, Upload } from "dxc-webkit";
```

## Esempio (stile CU 1.5)

```tsx
import { InfoPanel, Text, Button } from "dxc-webkit";
import { Line } from "@/shared/ui-components";

export function MyPage() {
  return (
    <InfoPanel hideSearch hideFooter>
      <Text as="p">Contenuto del pannello.</Text>
      <Line />
      <Button color="primary" onClick={() => {}}>Azione</Button>
    </InfoPanel>
  );
}
```

## Documentazione ufficiale

- **dxc-webkit** è una libreria interna MASE; non esiste documentazione pubblica online.
- Riferimento visivo (design system DXC): [Halstack Design System](https://developer.dxc.com/halstack/).
