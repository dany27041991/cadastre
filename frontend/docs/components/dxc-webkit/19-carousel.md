# Carousel

Slideshow di contenuti (slide) con navigazione. Estende **reactstrap** `Carousel`; supporta titolo e indicatori personalizzati.

---

## Esempio

```tsx
import { Carousel, CustomCarouselIndicators } from "dxc-webkit";

const [activeIndex, setActiveIndex] = useState(0);

<Carousel
  title="Galleria"
  activeIndex={activeIndex}
  next={() => setActiveIndex((i) => Math.min(i + 1, 2))}
  previous={() => setActiveIndex((i) => Math.max(i - 1, 0))}
>
  <div>Contenuto slide 1</div>
  <div>Contenuto slide 2</div>
  <div>Contenuto slide 3</div>
</Carousel>

// Indicatori custom
<CustomCarouselIndicators
  items={[
    { key: 0, altText: "Slide 1" },
    { key: 1, altText: "Slide 2" },
  ]}
  activeIndex={activeIndex}
  onClickHandler={setActiveIndex}
/>
```

---

## API

### Carousel

Estende `CarouselProps` di reactstrap (eccetto `next`/`previous` se sovrascritti dalla libreria).

| Nome     | Tipo       | Default | Descrizione |
|----------|------------|---------|-------------|
| `title`  | `string`   | —       | Titolo del carousel. |
| `children` | `ReactNode` | **obbligatorio** | Contenuti delle slide (nodi React; per struttura tipo reactstrap usare `CarouselItem` da reactstrap se necessario). |

Per gestione slide usare le props standard di reactstrap: `activeIndex`, `next`, `previous`, `interval`, `keyboard`, ecc.

---

### CustomCarouselIndicators

| Nome          | Tipo                    | Default | Descrizione |
|---------------|-------------------------|---------|-------------|
| `items`       | `{ altText?: string; key?: any }[]` | **obbligatorio** | Elenco voci (una per slide). |
| `activeIndex` | `number`                | **obbligatorio** | Indice della slide attiva. |
| `onClickHandler` | `(idx: number) => void` | **obbligatorio** | Callback al click su un indicatore. |
| `className`   | `string`                | —       | Classi CSS aggiuntive. |

Consente di sostituire gli indicatori predefiniti del Carousel con punti (o altro) personalizzati.
