# List

Liste con **List**, **ListItem** e **CustomListItem**: supporto per numero, label, icona, immagine, pulsante, checkbox, radio e stato attivo.

---

## Overview

**List** è un contenitore per voci di lista. **ListItem** rappresenta una singola riga con numero, label, icona/immagine, pulsante, checkbox o radio e stato attivo. **CustomListItem** offre titolo, sottotitolo, badge, doppia icona, header e metadata per layout più ricchi.

---

## Import

```tsx
import { List, ListItem, CustomListItem } from "dxc-webkit";
```

---

## List – ListProps

Estende `HTMLAttributes<HTMLElement>`.

| Prop | Tipo | Default | Descrizione |
|------|------|---------|-------------|
| `className` | `string` | — | Classi CSS aggiuntive. |
| `disabled` | `boolean` | — | Se `true`, disabilita gli item. |
| `label` | `string` | — | Valore/label della lista. |

---

## ListItem – ListItemProps

Estende `HTMLAttributes<HTMLElement>`.

| Prop | Tipo | Default | Descrizione |
|------|------|---------|-------------|
| `number` | `string \| number` | — | Numero visualizzato (es. indice). |
| `label` | `string` | — | Testo principale. |
| `button` | `ReactNode` | — | Nodo per pulsante/azione. |
| `Icon` | `FC<SVGRProps>` | — | Icona (da dxc-webkit/icons). |
| `Img` | `string` | — | URL immagine. |
| `disabled` | `boolean` | — | Voce disabilitata. |
| `checkbox` | `ReactNode` | — | Nodo checkbox. |
| `radioButton` | `ReactNode` | — | Nodo radio. |
| `isActive` | `boolean` | — | Evidenzia come voce attiva. |

---

## CustomListItem – CustomListItemProps

Estende `HTMLAttributes<HTMLElement>`.

| Prop | Tipo | Default | Descrizione |
|------|------|---------|-------------|
| `number` | `string` | — | Numero/identificativo. |
| `title` | `string` | — | Titolo della voce. |
| `subtitle` | `string` | — | Sottotitolo. |
| `badge` | `ReactNode` | — | Badge (es. stato). |
| `Icon` | `FC<SVGRProps>` | — | Icona principale. |
| `Icon2` | `FC<SVGRProps>` | — | Seconda icona. |
| `Img` | `string` | — | URL immagine. |
| `disabled` | `boolean` | — | Voce disabilitata. |
| `checkbox` | `ReactNode` | — | Checkbox. |
| `header` | `string` | — | Testo header. |
| `metadata` | `string` | — | Testo metadata. |
| `noContent` | `boolean` | — | Nasconde il blocco contenuto. |

---

## Esempi

### List + ListItem

```tsx
<List label="Elenco opzioni">
  <ListItem label="Voce 1" number={1} Icon={icons.IconName} />
  <ListItem label="Voce 2" number={2} button={<Button label="Azione" />} />
  <ListItem label="Voce attiva" isActive />
</List>
```

### CustomListItem

```tsx
<CustomListItem
  title="Titolo voce"
  subtitle="Sottotitolo"
  badge={<Badge label="Nuovo" />}
  Icon={icons.IconName}
  metadata="Info aggiuntiva"
/>
```
