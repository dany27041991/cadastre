# FloatingPanel

Pannello flottante trascinabile (e opzionalmente ridimensionabile): titolo, header, controlli in alto, pulsanti conferma/annulla e variante “thumb” compatta. Basato su **react-draggable** e **re-resizable**.

---

## Esempio

```tsx
import { FloatingPanel, Button } from "dxc-webkit";

<FloatingPanel
  title="Pannello"
  headerText="Sottotitolo o istruzioni"
  dragIcon
  cancelButton={<Button kind="outlined">Annulla</Button>}
  confirmButton={<Button color="primary">Conferma</Button>}
  topControls={[<Button close key="x" />]}
>
  Contenuto del pannello.
</FloatingPanel>

// Ridimensionabile
<FloatingPanel
  title="Mappa legenda"
  isResizable="all"
  resizableDefaultSize={[320, 200]}
  resizableMinSize={[200, 150]}
  resizableMaxSize={[500, 400]}
  onResizeStop={(e, direction, ref, delta) => {}}
>
  Contenuto ridimensionabile.
</FloatingPanel>

// Variante thumb (collassata, trascinabile)
<FloatingPanel title="Mini" thumbVariant>
  Contenuto in thumb.
</FloatingPanel>
```

---

## API

Estende `Partial<DraggableProps>` (react-draggable).

| Nome                   | Tipo                    | Default | Descrizione |
|------------------------|-------------------------|---------|-------------|
| `children`             | `ReactNode`             | —       | Contenuto principale. |
| `title`                | `string`                | —       | Titolo del pannello. |
| `headerText`           | `string`                | —       | Testo in header. |
| `wrapperStyle`         | `CSSProperties`         | —       | Stili wrapper. |
| `childrenWrapperStyle` | `CSSProperties`         | —       | Stili wrapper del contenuto. |
| `wrapperClassName`     | `string`                | —       | Classi wrapper. |
| `dragIcon`             | `boolean`               | —       | Mostra icona/area per il drag. |
| `topControls`          | `ReactNode[]`           | —       | Controlli in alto a destra (es. pulsante chiudi). |
| `cancelButton`         | `ReactNode`             | —       | Pulsante Annulla. |
| `confirmButton`        | `ReactNode`             | —       | Pulsante Conferma. |
| `thumbVariant`         | `boolean`               | —       | Variante compatta trascinabile. |
| `thumbFixedVariant`    | `boolean`               | —       | Variante compatta fissa. |
| `arrowPosition`        | `"up" \| "down" \| "left" \| "right"` | — | Posizione/direzione freccia. |
| `arrowPlacement`       | `"start" \| "center" \| "end"` | — | Allineamento freccia sul bordo. |
| `onArrowClick`         | `() => void`            | —       | Click sulla freccia. |
| `arrowThickness`       | `string \| number`      | —       | Spessore freccia. |
| `arrowAriaLabel`       | `string`                | —       | Aria-label per l’handle di drag. |
| `isResizable`          | `"horizontally" \| "vertically" \| "all"` | — | Direzioni di resize. |
| `resizableDefaultSize` | `[number \| string, number \| string]` | — | [width, height] iniziale. |
| `resizableMinSize`     | `[number \| string, number \| string]` | — | Dimensioni minime. |
| `resizableMaxSize`     | `[number \| string, number \| string]` | — | Dimensioni massime. |
| `resizableStyle`       | `CSSProperties`         | —       | Stili area ridimensionabile. |
| `onResizeStop`         | `(event, direction, ref, delta) => void` | — | Callback al termine del resize. |
