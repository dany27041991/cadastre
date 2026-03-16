# Grid

Sistema di griglia basato su Bootstrap: **Row** e **Col** per disporre gli elementi in righe e colonne. Prop tipate per alignment, justification e dimensioni responsive. Non è necessario specificare le larghezze alle singole colonne (si possono definire nella Row).

---

## Panoramica

Questo sistema di griglia personalizzato si basa su quello di Bootstrap. Offre due componenti: **Row** e **Col**, usati per disporre gli elementi in righe e colonne. Il vantaggio rispetto ad usare le grid native è che non bisogna specificare le larghezze alle singole colonne (si possono specificare nella Row), e inoltre sono esposte prop tipate per controllare alignment, justification e dimensioni in base al viewport.

### Esempio base

```tsx
import { Box, Row, Col } from "dxc-webkit";

<Box>
  <Row>
    <Col xs="4">4 cols</Col>
    <Col xs="4">4 cols</Col>
    <Col xs="4">4 cols</Col>
  </Row>
  <Row>
    <Col xs="8">8 cols</Col>
    <Col xs="2">2 cols</Col>
    <Col xs="2">2 cols</Col>
  </Row>
</Box>
```

---

## Proprietà (Row)

| Name | Description | Default |
|------|-------------|---------|
| **justify** | Allineamento orizzontale della flexbox. | — |
| | Tipo: `JustifyValues` \| `ResponsiveObject<JustifyValues>` | |
| **padding** | Spaziatura del padding del Row. Tipo: `Spacing`. | — |
| **margin** | Spaziatura del margine del Row. Tipo: `Spacing`. | `{ vertical: 's' }` |
| **align** | Allineamento verticale della flexbox. | — |
| | Tipo: `AlignValues` \| `ResponsiveObject<AlignValues>` | |

---

## Utilizzo

- **Flessibilità:** grazie ai componenti React preconfigurati, puoi creare layout flessibili che si adattano alle esigenze del progetto.
- **Controllo preciso:** i componenti offrono controllo granulare sul layout, consentendo di definire con precisione la disposizione dei contenuti.
- **Responsività:** supportano un design responsivo, garantendo che il layout si adatti a diverse dimensioni di schermo (breakpoint `xs`, `sm`, `md`, `lg`, `xl`).

---

## Varianti

### Align property

Valori: `start`, `end`, `center`, `stretch`, `baseline`. Controllano l'allineamento verticale degli elementi nella riga.

```tsx
<Text font="f1-label-lg">Start</Text>
<Row align="start" style={{ backgroundColor: "rgb(223, 231, 243)", height: "8rem" }}>
  <Col xs="2">2 cols</Col>
  <Col xs="2">2 cols</Col>
  <Col xs="2">2 cols</Col>
</Row>

<Text font="f1-label-lg">End</Text>
<Row align="end" style={{ backgroundColor: "rgb(223, 231, 243)", height: "8rem" }}>
  <Col xs="2">2 cols</Col>
  <Col xs="2">2 cols</Col>
  <Col xs="2">2 cols</Col>
</Row>

<Text font="f1-label-lg">Stretch</Text>
<Row align="stretch" style={{ backgroundColor: "rgb(223, 231, 243)", height: "8rem" }}>
  <Col xs="2">2 cols</Col>
  <Col xs="2">2 cols</Col>
  <Col xs="2">2 cols</Col>
</Row>

<Text font="f1-label-lg">Center</Text>
<Row align="center" style={{ backgroundColor: "rgb(223, 231, 243)", height: "8rem" }}>
  <Col xs="2">2 cols</Col>
  <Col xs="2">2 cols</Col>
  <Col xs="2">2 cols</Col>
</Row>

<Text font="f1-label-lg">Baseline</Text>
<Row align="baseline" style={{ backgroundColor: "rgb(223, 231, 243)", height: "8rem" }}>
  <Col xs="2">2 cols</Col>
  <Col xs="2">2 cols</Col>
  <Col xs="2">2 cols</Col>
</Row>
```

### Justify property

Valori: `start`, `end`, `center`, `around`, `between`. Controllano l'allineamento orizzontale.

```tsx
<Text font="f1-label-lg">Start</Text>
<Row justify="start" style={{ backgroundColor: "rgb(223, 231, 243)" }}>
  <Col xs="2">2 cols</Col>
  <Col xs="2">2 cols</Col>
  <Col xs="2">2 cols</Col>
</Row>

<Text font="f1-label-lg">End</Text>
<Row justify="end" style={{ backgroundColor: "rgb(223, 231, 243)" }}>
  <Col xs="2">2 cols</Col>
  <Col xs="2">2 cols</Col>
  <Col xs="2">2 cols</Col>
</Row>

<Text font="f1-label-lg">Center</Text>
<Row justify="center" style={{ backgroundColor: "rgb(223, 231, 243)" }}>
  <Col xs="2">2 cols</Col>
  <Col xs="2">2 cols</Col>
  <Col xs="2">2 cols</Col>
</Row>

<Text font="f1-label-lg">Around</Text>
<Row justify="around" style={{ backgroundColor: "rgb(223, 231, 243)" }}>
  <Col xs="2">2 cols</Col>
  <Col xs="2">2 cols</Col>
  <Col xs="2">2 cols</Col>
</Row>

<Text font="f1-label-lg">Between</Text>
<Row justify="between" style={{ backgroundColor: "rgb(223, 231, 243)" }}>
  <Col xs="2">2 cols</Col>
  <Col xs="2">2 cols</Col>
  <Col xs="2">2 cols</Col>
</Row>
```

### Auto size (colonne dinamiche)

Si può definire il numero di colonne per breakpoint sulla **Row** (`xs`, `sm`, `md`, `lg`, `xl`); le **Col** senza size si ripartiscono automaticamente.

```tsx
<Row md="4" sm="2" xs="1">
  <Col>Dynamic</Col>
  <Col>Dynamic</Col>
  <Col>Dynamic</Col>
  <Col>Dynamic</Col>
</Row>
```

---

## Componenti collegati

| Componente | Descrizione |
|------------|-------------|
| [Text](02-text.md) | Componente per la visualizzazione di testo. |
| [Layout](34-layout.md) | **Box**, **Container**, **Row**, **Col** – dettaglio props e tipi. |

Vedi anche **Box**: contenitore flessibile che può contenere altri elementi e gestire padding, margin, flex (justify, align, gap).
