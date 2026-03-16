# Breadcrumb

Navigazione a briciole di pane: elenco di link gerarchici (es. Home > Sezione > Pagina). Supporta icona iniziale e troncamento con ellissi oltre un numero massimo di elementi.

---

## Esempio

```tsx
import { Breadcrumb, BreadcrumbItem, BreadcrumbIcon, icons } from "dxc-webkit";

// Breadcrumb con icona home e voci
<Breadcrumb>
  <BreadcrumbIcon Icon={icons.HomeIcon} />
  <BreadcrumbItem key="cat" href="/categoria">Categoria</BreadcrumbItem>
  <BreadcrumbItem key="page" href="/categoria/pagina">Pagina corrente</BreadcrumbItem>
</Breadcrumb>

// Con numero massimo di voci (le altre in "...")
<Breadcrumb maxItems={3} activeKey="page">
  <BreadcrumbItem key="home" href="/">Home</BreadcrumbItem>
  <BreadcrumbItem key="a" href="/a">A</BreadcrumbItem>
  <BreadcrumbItem key="b" href="/a/b">B</BreadcrumbItem>
  <BreadcrumbItem key="page" href="/a/b/page">Pagina</BreadcrumbItem>
</Breadcrumb>
```

---

## API

### Breadcrumb

| Nome       | Tipo | Default | Descrizione |
|------------|------|---------|-------------|
| `className` | `string` | — | Classi CSS aggiuntive. |
| `activeKey` | `string` | — | Chiave dell’elemento attivo (pagina corrente). |
| `maxItems`  | `number` | — | Numero massimo di elementi visibili; i restanti sono nascosti con ellissi (...). |
| `children`  | `ReactElement<BreadcrumbItem> \| ReactElement<BreadcrumbItem>[]` | — | Lista di `BreadcrumbItem` (e opzionalmente `BreadcrumbIcon`). |

---

### BreadcrumbItem

| Nome       | Tipo | Default | Descrizione |
|------------|------|---------|-------------|
| `className` | `string` | — | Classi CSS aggiuntive. |
| `key`       | `string` | **obbligatorio** | Chiave univoca (React e per `activeKey`). |
| `href`      | `string` | **obbligatorio** | URL del link. |

Contenuto del link (testo o nodi) va passato come **children**.

---

### BreadcrumbIcon

| Nome     | Tipo           | Default | Descrizione |
|----------|----------------|---------|-------------|
| `Icon`   | `FC<SVGRProps>` | **obbligatorio** | Componente icona (es. `icons.HomeIcon`). |

Supporta anche le props di `SVGRProps` (size, title, fill, ecc.).
