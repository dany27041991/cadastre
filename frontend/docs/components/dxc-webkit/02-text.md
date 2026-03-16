# Text

Componente di testo polimorfo: accetta le stesse props di **Box** (layout, font, colori) e permette di scegliere l’elemento HTML con `as`.

## Import

```tsx
import { Text } from "dxc-webkit";
```

## Uso

`Text` usa `PolymorphicComponentProp<T, BoxProps>`: puoi passare `as="p" | "span" | "h1" | "div"` ecc. e tutte le **BoxProps**.

## BoxProps (principali)

| Prop | Tipo | Descrizione |
|------|------|-------------|
| `font` | `Fonts` | Stile tipografico (es. `f1-style-h1-bold`, `f1-body-md`). |
| `color` | `Colors` | Colore del testo. |
| `backgroundColor` | `Colors` | Sfondo. |
| `padding` | `Spacing` | Padding (valori predefiniti o responsive). |
| `margin` | `Spacing` | Margine. |
| `display` | `Display` | `'flex' \| 'block' \| 'inline' \| ...` |
| `justify` | `JustifyValues` | Allineamento flex (se `display="flex"`). |
| `align` | `AlignValues` | Allineamento verticale flex. |
| `gap` | `number` | Spazio tra elementi (rem), con flex/grid. |
| `radius` | `Radius` | Bordi arrotondati. |
| `border` | `Border` | Bordo (es. `'border'`, `'border-top'`). |
| `shadow` | `Shadow` | Ombra. |

## Esempio

```tsx
<Text as="h1" font="f1-style-h1-bold">Titolo</Text>
<Text as="p" font="f1-body-md" color="primary">Paragrafo.</Text>
<Text as="span" font="f1-caption-regular-md">Didascalia</Text>
```
