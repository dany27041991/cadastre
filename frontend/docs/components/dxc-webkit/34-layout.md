# Layout

Griglia e box per layout responsive: **Container**, **Row**, **Col** (reactstrap) e **Box** polimorfico con padding, margin, flex e stili.

---

## Overview

I componenti **Layout** forniscono una griglia (Container, Row, Col, basati su reactstrap) e un **Box** generico per composizione: spacing, flex (justify, align, gap, flexDirection), colori, bordi, ombre e font. Box può renderizzare un tag diverso tramite `as`.

---

## Import

```tsx
import { Box, Container, Row, Col } from "dxc-webkit";
```

---

## Box

**Box** è un componente polimorfico (`as?: T`): accetta tutte le props HTML dell’elemento scelto più le props di layout.

### BoxProps

| Prop | Tipo | Default | Descrizione |
|------|------|---------|-------------|
| `as` | `ElementType` | `"div"` | Tag da renderizzare (es. `"section"`, `"main"`). |
| `justify` | `JustifyValues \| ResponsiveObject<JustifyValues>` | — | Allineamento orizzontale (flex). Valori: `start`, `end`, `center`, `between`, `around`. |
| `align` | `AlignValues \| ResponsiveObject<AlignValues>` | — | Allineamento verticale (flex). Valori: `start`, `end`, `center`, `baseline`, `stretch`. |
| `padding` | `Spacing` | — | Padding. Valori: `0`, `xxs`, `xs`, `s`, `m`, `l`, `xl`, `xxl`. |
| `margin` | `Spacing` | — | Margine. |
| `color` | `Colors` | — | Colore del testo. |
| `backgroundColor` | `Colors` | — | Colore di sfondo. |
| `borderColor` | `Colors` | — | Colore bordo. |
| `border` | `Border` | — | `border`, `border-top`, `border-right`, `border-bottom`, `border-left`. |
| `borderThickness` | `number` | — | Spessore bordo (px). |
| `font` | `Fonts` | — | Font (da constants). |
| `radius` | `Radius` | — | Bordi arrotondati (es. `radius-1`, `radius-2-top`). |
| `shadow` | `Shadow` | — | `shadow-xs`, `shadow-sm`, `shadow-md`, `shadow-lg`. |
| `display` | `Display` | — | `none`, `inline`, `block`, `flex`, `inline-flex`, ecc. |
| `flexDirection` | `FlexDirection` | — | `row`, `row-reverse`, `column`, `column-reverse`. |
| `gap` | `number` | — | Spazio tra elementi (rem); con `display: flex` o `grid`. |

---

## Row

Estende **Row** di reactstrap. Allineamento e spacing.

| Prop | Tipo | Default | Descrizione |
|------|------|---------|-------------|
| `justify` | `JustifyValues \| ResponsiveObject<JustifyValues>` | — | Allineamento orizzontale. |
| `align` | `AlignValues \| ResponsiveObject<AlignValues>` | — | Allineamento verticale. |
| `padding` | `Spacing` | — | Padding del row. |
| `margin` | `Spacing` | — | Margine del row. |

(Le altre props sono quelle di reactstrap: `xs`, `sm`, `md`, `lg`, `xl`, `className`, ecc.)

---

## Col

Estende **Col** di reactstrap. Colonne della griglia con opzioni flex.

| Prop | Tipo | Default | Descrizione |
|------|------|---------|-------------|
| `padding` | `Spacing` | — | Padding. |
| `margin` | `Spacing` | — | Margine. |
| `align` | `AlignValues \| ResponsiveObject<AlignValues>` | — | Allineamento verticale (se flex). |
| `justify` | `JustifyValues \| ResponsiveObject<JustifyValues>` | — | Allineamento orizzontale (se flex). |
| `display` | `Display` | — | Display della colonna. |
| `flexDirection` | `FlexDirection` | — | Direzione flex. |
| `gap` | `number` | — | Gap (rem). |

---

## Container

Wrapper **Container** di reactstrap (nessuna prop aggiuntiva dxc-webkit). Usato per centrare e contenere il layout.

```tsx
<Container>
  <Row>
    <Col md={6}>Colonna 1</Col>
    <Col md={6}>Colonna 2</Col>
  </Row>
</Container>
```

---

## Esempio Box

```tsx
<Box
  as="section"
  display="flex"
  flexDirection="row"
  justify="between"
  align="center"
  padding="m"
  gap={1}
  border="border"
  radius="radius-2"
>
  <Text>Contenuto 1</Text>
  <Text>Contenuto 2</Text>
</Box>
```
