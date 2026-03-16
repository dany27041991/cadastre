# Header

Intestazione di pagina con barra superiore (topBar) e barra centrale (middleBar): titolo, navigazione, ricerca, utente, notifiche, megamenu. Configurabile con varianti (small, regular, complete) e colori (dark, primary, blue).

---

## Esempio

```tsx
import { Header } from "dxc-webkit";

const navigation = [
  { title: "Home", path: "/" },
  {
    title: "Servizi",
    elements: [
      { title: "Servizio A", link: "/servizi/a" },
      { title: "Servizio B", link: "/servizi/b" },
    ],
  },
];

<Header
  color="dark"
  topBar={{
    variant: "small",
    color: "dark",
    titleConfig: { title: "Portale" },
    userData: { name: "Mario", surname: "Rossi", pic: "/avatar.jpg" },
    handleProfileClick: () => {},
    handleLogin: () => {},
  }}
  middleBar={{
    variant: "regular",
    color: "dark",
    titleBar: "Nome applicazione",
    categories: navigation,
  }}
  navigation={navigation}
/>
```

---

## API

### HeaderProps

Estende `HtmlHTMLAttributes<HTMLElement>`.

| Nome         | Tipo                  | Default | Descrizione |
|--------------|-----------------------|---------|-------------|
| `color`      | `HeaderColorsType`    | —       | Colore generale: `'dark' \| 'primary' \| 'blue'`. |
| `navigation` | `NavigationElement[]`| —       | Elementi di navigazione. |
| `topBar`     | `TopHeaderProps`      | —       | Configurazione barra superiore. |
| `middleBar`  | `TopHeaderProps`      | —       | Configurazione barra centrale. |

### TopHeaderProps (topBar / middleBar)

| Nome                | Tipo                    | Descrizione |
|---------------------|-------------------------|-------------|
| `variant`           | `HeaderVariantSize`     | **obbligatorio** – `'small' \| 'regular' \| 'complete'`. |
| `color`             | `HeaderColorsType`      | **obbligatorio** – Colore della barra. |
| `titleConfig`       | `HeaderTitleProps`     | Titolo principale. |
| `secondTitleConfig` | `HeaderTitleProps`     | Secondo titolo. |
| `titleBar`          | `string`                | Testo barra (es. nome app). |
| `userData`          | `{ name, surname, pic }`| Dati utente (avatar, nome). |
| `handleNotification`| `() => void`            | Callback notifiche. |
| `handleProfileClick` | `() => void`            | Callback click su profilo. |
| `handleLogin`       | `() => void`            | Callback login. |
| `searchConfig`      | `SearchInputProps`      | Configurazione barra di ricerca. |
| `userMenuItems`     | `DropdownItemProps[]`   | Voci menu utente. |
| `loginHeading`      | `string`                | Titolo area login. |
| `languagePicker`    | `ReactNode`             | Componente selezione lingua. |
| `mobile`            | `boolean`               | Variante mobile. |
| `categories`        | `NavigationElement[]`   | Categorie / voci di navigazione. |
| `auxButton`         | `ButtonProps`           | Pulsante aggiuntivo. |

### NavigationElement

Estende le props del `Dropdown`; usato per voci e sottomenu.

| Nome              | Tipo                    | Descrizione |
|-------------------|-------------------------|-------------|
| `title`           | `string`                | **obbligatorio** – Testo della voce. |
| `path`            | `string`                | URL (link diretto). |
| `target`          | `string`                | Target del link (es. `_blank`). |
| `elements`        | `NavigationSubElement[]`| Sottovoci (dropdown). |
| `onClick`         | `() => void`            | Click sulla voce. |
| `megamenu`        | `boolean`               | Abilita megamenu. |
| `mostElements`    | `MostUsedElement[]`     | Elementi “più usati”. |
| `titleMostElements`| `string`                | Titolo sezione “più usati”. |
| `colorTooltip`    | `TooltipColorsType`     | Colore tooltip. |
| `ariaTargetBlank` | `boolean`               | Link apre in nuova scheda. |
| `ariaTitleLink`   | `string`                | Aria-label del link. |

### NavigationSubElement

| Nome     | Tipo           | Descrizione |
|----------|----------------|-------------|
| `title`  | `string`       | Testo della sottovoce. |
| `link`   | `string`       | URL. |
| `Icon`   | `FC<SVGRProps>`| Icona. |
| `Icon2`  | `FC<SVGRProps>`| Seconda icona. |
| `onClick`| `() => void`   | Click. |

### Sottocomponenti esportati

- **HeaderVariant**, **HeaderTitle**, **HeaderNavigation**, **HeaderNavigationMobile**, **HeaderMegamenu**, **HeaderAutenthication** – per composizione custom dell’header.
