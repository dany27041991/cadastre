# Card

Contenitore per titolo, sottotitolo, immagine, corpo, footer e badge. Supporta varianti (icona, portrait, normal, dati) e dimensioni.

---

## Esempio

```tsx
import { Card } from "dxc-webkit";

// Card base
<Card
  title="Titolo card"
  subtitle="Sottotitolo"
  paragraph="Testo del corpo della card."
  containerOptions={{ size: "md", variant: "normal" }}
/>

// Con immagine e footer
<Card
  title="Card con immagine"
  subtitle="Sottotitolo"
  containerOptions={{ size: "lg", variant: "portrait" }}
  imageOptions={{ img: "/path/to/image.jpg" }}
  footerConfig={{
    buttonConfig: { color: "primary", children: "Azione" },
    secondButtonConfig: { kind: "outlined", children: "Secondaria" },
}}
/>

// Con icona e categoria (badge)
<Card
  title="Card con icona"
  subtitle="Sottotitolo"
  containerOptions={{ size: "md", variant: "cardicon" }}
  icon={icons.DocumentIcon}
  category={{ color: "primary", children: "Categoria" }}
  hideFooter
/>
```

---

## API

### Card

| Nome              | Tipo                  | Default | Descrizione |
|-------------------|-----------------------|---------|-------------|
| `containerOptions`| `CardContainerProps`  | **obbligatorio** | Opzioni contenitore: `size`, `variant`. |
| `title`           | `string`              | **obbligatorio** | Titolo della card. |
| `subtitle`        | `string`              | **obbligatorio** | Sottotitolo. |
| `paragraph`       | `string`              | —       | Testo del corpo. |
| `bodyClassName`   | `string`              | —       | Classi per il body. |
| `bodyStyle`       | `CSSProperties`       | —       | Stili per il body. |
| `imageOptions`    | `CardImageProps`      | —       | Immagine: `img`, `imgX`, `imgY`, `variant`. |
| `date`            | `string`              | —       | Data mostrata in header. |
| `icon` / `icon2`  | `ElementType \| string \| ReactElement` | — | Icona in header. |
| `chipLabel`       | `string`              | —       | Label della chip. |
| `category`        | `string \| BadgeProps`| —       | Categoria (testo o config badge). |
| `footerConfig`    | `CardFooterProps`     | —       | Pulsanti e opzioni footer. |
| `hideHeader`      | `boolean`             | —       | Nasconde l’header. |
| `hideTitle`       | `boolean`             | —       | Nasconde il titolo. |
| `hideFooter`      | `boolean`             | —       | Nasconde il footer. |
| `cardDati`        | `boolean`             | —       | Variante “card dati”. |
| `cardDatiHeader`   | `boolean`             | —       | Header in stile dati. |
| `cardIconConfig`  | `CardIconProps`       | —       | Config icona (Icon, bold, img, text). |
| `onClickArrowButton` | `MouseEventHandler` | —    | Click su pulsante freccia. |
| `storybook`       | `boolean`             | —       | Altezza fissa (solo sviluppo/Storybook). |

### CardContainerProps (containerOptions)

| Nome       | Tipo     | Default | Descrizione |
|------------|----------|---------|-------------|
| `size`     | `CardSize` | —     | `'sm' \| 'md' \| 'lg' \| 'auto'`. |
| `variant`  | `Variants` | —     | `'cardicon' \| 'portrait' \| 'normal' \| 'dati'`. |

### CardFooterProps (footerConfig)

| Nome                 | Tipo          | Descrizione |
|----------------------|---------------|-------------|
| `buttonConfig`       | `ButtonProps` | Primo pulsante. |
| `secondButtonConfig` | `ButtonProps` | Secondo pulsante. |
| `size`               | `CardSize`    | Dimensione. |
| `leftButtonSmallVariant` | `boolean` | Variante piccola per pulsante sinistro. |
| `auxComponent`       | `ReactNode`   | Componente aggiuntivo nel footer. |

### Sottocomponenti (composizione manuale)

- **CardContainer**, **CardHeader**, **CardBody**, **CardFooter**, **CardImage**, **CardIcon**, **CardContent**, **CardTitleSection** – esportati da `dxc-webkit` per layout custom.
