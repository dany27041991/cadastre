# Spacing

Sistema di spaziatura del design system DXC: margini, padding e scale (xxs–xxl) per distribuzione e posizionamento degli elementi. Formato classi `{property}{sides}-{size}` con supporto responsive.

---

## Panoramica

Gli **spacing** si riferiscono alla distribuzione e al posizionamento degli elementi all'interno di un'interfaccia utente. Questo include la gestione degli spazi tra gli elementi, come margini, padding e interlinea, al fine di garantire una presentazione equilibrata, leggibile e gradevole. In sostanza, gli spacing sono essenziali per creare una buona leggibilità, organizzazione e accessibilità all'interno di un'interfaccia, facilitando l'esperienza dell'utente durante l'interazione con il prodotto o il servizio.

---

## Legenda

Le classi sono create seguendo il formato **`{property}{sides}-{size}`** per `xs` e **`{property}{sides}-{breakpoint}-{size}`** per `sm`, `md`, `lg`, `xl`.

**Property**
- **m** – classi che impostano il margin
- **p** – classi che impostano il padding

**Sides**
- **t** – margin-top / padding-top
- **b** – margin-bottom / padding-bottom
- **l** – margin-left / padding-left
- **r** – margin-right / padding-right
- **x** – left e right (*-left e *-right)
- **y** – top e bottom (*-top e *-bottom)
- **Blank** – margin o padding su tutti i lati

---

## Scale di spazio

| Name | SCSS variable | Size (rem) |
|------|---------------|------------|
| xxs | `$spacing-xxs` | 0.25 rem |
| xs | `$spacing-xs` | 0.50 rem |
| s | `$spacing-s` | 1.0 rem |
| m | `$spacing-m` | 1.5 rem |
| l | `$spacing-l` | 2 rem |
| xl | `$spacing-xl` | 2.5 rem |
| xxl | `$spacing-xxl` | 3.0 rem |

**Suggerimento:** gli elementi circondati da una spaziatura maggiore vengono percepiti come più importanti perché occupano più spazio sulla pagina; una spaziatura ridotta mantiene i componenti vicini e meno in evidenza.

---

## Asse verticale

Classi per top/bottom: **pt**, **pb**, **py** (padding) | **mt**, **mb**, **my** (margin).

| Name | SCSS class (esempio) | Size |
|------|----------------------|------|
| xxs | `pt-xxs` \| `pb-xxs` \| `py-xxs` \| `mt-xxs` \| `mb-xxs` \| `my-xxs` | 0.25 rem |
| xs | `pt-xs` \| `pb-xs` \| `py-xs` \| `mt-xs` \| `mb-xs` \| `my-xs` | 0.50 rem |
| s | `pt-s` \| `pb-s` \| `py-s` \| `mt-s` \| `mb-s` \| `my-s` | 1.0 rem |
| m | `pt-m` \| `pb-m` \| `py-m` \| `mt-m` \| `mb-m` \| `my-m` | 1.5 rem |
| l | `pt-l` \| `pb-l` \| `py-l` \| `mt-l` \| `mb-l` \| `my-l` | 2 rem |
| xl | `pt-xl` \| `pb-xl` \| `py-xl` \| `mt-xl` \| `mb-xl` \| `my-xl` | 2.5 rem |
| xxl | `pt-xxl` \| `pb-xxl` \| `py-xxl` \| `mt-xxl` \| `mb-xxl` \| `my-xxl` | 3.0 rem |

---

## Asse orizzontale

Classi per left/right: **pl**, **pr**, **px** (padding) | **ml**, **mr**, **mx** (margin).

| Name | SCSS class (esempio) | Size |
|------|----------------------|------|
| xxs | `pl-xxs` \| `pr-xxs` \| `px-xxs` \| `ml-xxs` \| `mr-xxs` \| `mx-xxs` | 0.25 rem |
| xs | `pl-xs` \| `pr-xs` \| `px-xs` \| `ml-xs` \| `mr-xs` \| `mx-xs` | 0.50 rem |
| s | `pl-s` \| `pr-s` \| `px-s` \| `ml-s` \| `mr-s` \| `mx-s` | 1.0 rem |
| m | `pl-m` \| `pr-m` \| `px-m` \| `ml-m` \| `mr-m` \| `mx-m` | 1.5 rem |
| l | `pl-l` \| `pr-l` \| `px-l` \| `ml-l` \| `mr-l` \| `mx-l` | 2 rem |
| xl | `pl-xl` \| `pr-xl` \| `px-xl` \| `ml-xl` \| `mr-xl` \| `mx-xl` | 2.5 rem |
| xxl | `pl-xxl` \| `pr-xxl` \| `px-xxl` \| `ml-xxl` \| `mr-xxl` \| `mx-xxl` | 3.0 rem |

---

## Margine interno (tutti i lati)

Classi **p-{size}** (padding) e **m-{size}** (margin) su tutti i lati.

| Name | SCSS class | Size |
|------|------------|------|
| xxs | `p-xxs` \| `m-xxs` | 0.25 rem |
| xs | `p-xs` \| `m-xs` | 0.50 rem |
| s | `p-s` \| `m-s` | 1.0 rem |
| m | `p-m` \| `m-m` | 1.5 rem |
| l | `p-l` \| `m-l` | 2 rem |
| xl | `p-xl` \| `m-xl` | 2.5 rem |
| xxl | `p-xxl` \| `m-xxl` | 3.0 rem |

---

## Utilizzo

- Per ottenere spazi maggiori, raddoppia le dimensioni (es. da `s` a `m`).
- Assicurati che le spaziature e le dimensioni siano uniformi tra i diversi componenti dell'interfaccia utente.
- Allinea tutti gli elementi utilizzando la stessa spaziatura all'interno dei componenti o delle pagine.

Nei componenti dxc-webkit le spaziature si applicano tramite le prop **`padding`** e **`margin`** (tipo **Spacing**) sui componenti che accettano **BoxProps** (es. `Box`, `Text`, `Row`). Valori: `0`, `xxs`, `xs`, `s`, `m`, `l`, `xl`, `xxl`. Vedi [Layout](34-layout.md) per le BoxProps.
