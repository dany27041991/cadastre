# Footer

Footer di pagina in due varianti: **FooterExpanded** (logo, gruppi di link, social) e **FooterCompressed** (solo logo). **FooterLogos** per layout con più loghi e etichette. Usa i tipi e i partials (FooterLogo, FooterLabel).

---

## Esempio

```tsx
import {
  FooterExpanded,
  FooterCompressed,
  FooterLogos,
  FooterLogo,
  FooterLabel,
  icons,
} from "dxc-webkit";

// Footer compresso (solo logo)
<FooterCompressed
  color="dark"
  logo={{ label: "MASE", Icon: icons.LogoIcon, href: "/" }}
/>

// Footer espanso (logo + link + social)
<FooterExpanded
  color="dark"
  logo={{ label: "Gov.it", href: "https://gov.it" }}
  labelsGroups={[
    {
      heading: "Link utili",
      labels: [
        { label: "Privacy", href: "/privacy" },
        { label: "Note legali", href: "/note-legali" },
      ],
    },
  ]}
  labelKey="Chiave"
  labelValue="Valore"
  facebookHref="https://facebook.com/..."
  twitterHref="https://twitter.com/..."
/>

// Footer con più loghi ed etichette
<FooterLogos
  color="blue"
  logos={[
    { label: "Logo 1", href: "/" },
    { label: "Logo 2", Icon: icons.PartnerIcon },
  ]}
  labels={[
    { label: "Contatti", address: "Via Roma 1", phone: "+39 ...", email: "info@..." },
    { label: "Link", href: "/link", target: "_blank" },
  ]}
/>
```

---

## API

### FooterProps (comune)

| Nome        | Tipo          | Default | Descrizione |
|-------------|---------------|---------|-------------|
| `color`     | `FooterColor` | —       | `'dark' \| 'light' \| 'blue'`. |
| `className` | `string`      | —       | Classi CSS. |

### FooterCompressed

| Nome   | Tipo              | Default | Descrizione |
|--------|-------------------|---------|-------------|
| `logo` | `FooterLogoProps` | **obbligatorio** | Config logo (label, Icon, href). |

### FooterExpanded

| Nome            | Tipo              | Default | Descrizione |
|-----------------|-------------------|---------|-------------|
| `logo`          | `FooterLogoProps` | **obbligatorio** | Config logo. |
| `labelsGroups`  | `LabelsGroup[]`   | —       | Gruppi di link: `{ heading?, labels: LabelEntry[] }`. |
| `labelKey`      | `string`          | —       | Etichetta chiave. |
| `labelValue`    | `string`          | —       | Valore associato. |
| `facebookHref`  | `string`          | —       | URL Facebook. |
| `twitterHref`   | `string`          | —       | URL Twitter. |
| `youtubeHref`   | `string`          | —       | URL YouTube. |
| `instagramHref` | `string`          | —       | URL Instagram. |
| `linkedinHref`  | `string`          | —       | URL LinkedIn. |

### LabelEntry / LabelsGroup

- **LabelEntry:** `{ label: string; href: string }`.
- **LabelsGroup:** `{ heading?: string; labels: LabelEntry[] }`.

### FooterLogos

| Nome     | Tipo                | Default | Descrizione |
|----------|---------------------|---------|-------------|
| `logos`  | `FooterLogoProps[]` | —       | Array di loghi. |
| `labels` | `FooterLabelProps[]`| **obbligatorio** | Array di etichette (contatti, link). |

### FooterLogoProps

| Nome   | Tipo           | Descrizione |
|--------|----------------|-------------|
| `label`| `string`       | Testo del logo. |
| `Icon` | `FC<SVGRProps>`| Icona/logo SVG. |
| `href` | `string`       | Link. |

### FooterLabelProps

| Nome     | Tipo     | Descrizione |
|----------|----------|-------------|
| `label`  | `string` | Etichetta. |
| `address`| `string` | Indirizzo. |
| `phone`  | `string` | Telefono. |
| `email`  | `string` | Email. |
| `href`   | `string` | URL (se è un link). |
| `target` | `string` | Target dell’href (es. `"_blank"`). |
