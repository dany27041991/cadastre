# InfoPanel

Pannello laterale/contenitore per wizard o opzioni: area principale, barra di ricerca opzionale e footer con pulsanti.

---

## Esempio

```tsx
import { InfoPanel, Text, Button } from "dxc-webkit";

// Solo contenuto (senza search e footer)
<InfoPanel hideSearch hideFooter>
  <Text>Contenuto del pannello.</Text>
  <Button color="primary" onClick={onSubmit}>Invia</Button>
</InfoPanel>

// Con footer a due pulsanti
<InfoPanel
  textBtnPre="Indietro"
  textBtnNew="Avanti"
  onClickBtnPre={() => setStep(s => s - 1)}
  onClickBtnNew={() => setStep(s => s + 1)}
  arrowBtnNew
/>
```

---

## API

| Nome | Tipo | Default | Descrizione |
|------|------|---------|-------------|
| `children` | `ReactNode` | — | Contenuto del pannello. |
| `optionSearchBar` | `SearchInputOption[]` | — | Opzioni per la searchbar. |
| `textBtnNew` | `string` | — | Label pulsante destro del footer. |
| `textBtnPre` | `string` | — | Label pulsante sinistro del footer. |
| `onClickBtnNew` | `() => void` | — | Click pulsante destro. |
| `onClickBtnPre` | `() => void` | — | Click pulsante sinistro. |
| `disableBtnNew` | `boolean` | — | Disabilita pulsante destro. |
| `disableBtnPre` | `boolean` | — | Disabilita pulsante sinistro. |
| `arrowBtnNew` | `boolean` | — | Freccia sul pulsante destro. |
| `arrowBtnPre` | `boolean` | — | Freccia sul pulsante sinistro. |
| `boxSubTitleTitle` | `string` | — | Titolo della descrizione. |
| `boxSubTitleSub` | `string` | — | Testo descrizione. |
| `subTitleMaxHeight` | `number \| string` | — | Altezza massima area descrizione (overflow). |
| `searchText` | `string` | — | Valore controllato della SearchInput. |
| `setSearchText` | `(value, name?) => void` | — | Setter del valore di ricerca. |
| `hideSearch` | `boolean` | — | Nasconde la SearchInput. |
| `hideFooter` | `boolean` | — | Nasconde il footer. |
| `className` | `string` | — | Classi container. |
| `buttonTextClass` | `string` | — | Classi per il testo dei pulsanti. |
