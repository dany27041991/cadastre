# HeroBanner

Banner hero a tutta larghezza: immagine di sfondo, titolo, testo, eventuale label e due pulsanti azione. Supporta variante small, overlay (tint) e posizione del testo.

---

## Esempio

```tsx
import { HeroBanner } from "dxc-webkit";

<HeroBanner
  srcImg="/hero.jpg"
  altImg="Descrizione immagine"
  title="Titolo principale"
  text="Testo introduttivo del portale o della sezione."
  label="Etichetta"
  color="primary"
/>

// Con pulsanti
<HeroBanner
  srcImg="/hero.jpg"
  title="Benvenuto"
  text="Scegli un’azione per continuare."
  labelButton1="Entra"
  labelButton2="Scopri di più"
  onClickButton1={() => navigate("/dashboard")}
  onClickButton2={() => scrollToSection("info")}
  color="dark"
  hasTint
/>

// Variante small e testo centrato
<HeroBanner
  srcImg="/banner-sm.jpg"
  title="Sezione"
  text="Contenuto breve."
  small
  textCentered
  titleColor="light"
/>

// Posizione testo
<HeroBanner
  srcImg="/hero.jpg"
  title="Titolo"
  text="Testo"
  textPosition="center"
/>
```

---

## API

### HeroBannerProps

| Nome             | Tipo                    | Default | Descrizione |
|------------------|-------------------------|---------|-------------|
| `srcImg`         | `string`                | **obbligatorio** | URL immagine di sfondo. |
| `titleImg`       | `string`                | —       | Titolo attributo dell’immagine. |
| `altImg`         | `string`                | —       | Testo alternativo per l’immagine. |
| `title`          | `string`                | —       | Titolo del banner. |
| `text`           | `ReactNode`             | **obbligatorio** | Testo principale (può essere JSX). |
| `label`          | `string`                | —       | Etichetta (sopra titolo o contestuale). |
| `className`      | `string`                | —       | Classi CSS aggiuntive. |
| `color`          | `HeroBannerColorsType`  | —       | Tema: `'primary' \| 'dark'`. |
| `small`          | `boolean`               | —       | Variante a altezza ridotta. |
| `hasTint`        | `boolean`               | —       | Overlay/scurimento sull’immagine. |
| `textCentered`   | `boolean`               | —       | Testo centrato. |
| `titleColor`     | `'primary' \| 'light' \| 'dark'` | — | Colore del titolo. |
| `textPosition`   | `'push-left' \| 'center'` | —     | Posizione del blocco testo. |
| `labelButton1`   | `string`                | —       | Etichetta primo pulsante. |
| `labelButton2`   | `string`                | —       | Etichetta secondo pulsante. |
| `onClickButton1` | `MouseEventHandler`      | —       | Click primo pulsante. |
| `onClickButton2` | `MouseEventHandler`      | —       | Click secondo pulsante. |
