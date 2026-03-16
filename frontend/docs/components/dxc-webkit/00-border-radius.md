# Border Radius

Sistema di arrotondamento degli angoli (border-radius) del design system DXC: quattro livelli (radius 1–4) per un aspetto moderno e un'interazione più agevole, soprattutto su touchscreen.

---

## Panoramica

Il **border-radius** è una proprietà che consente di arrotondare gli angoli degli elementi dell'interfaccia utente. Questa caratteristica contribuisce a rendere l'aspetto visivo più moderno, accattivante e gradevole agli utenti, migliorando l'estetica complessiva dell'interfaccia. L'uso del border-radius può anche migliorare l'ergonomia dell'interfaccia rendendo più agevole l'interazione, soprattutto su dispositivi touchscreen, e può essere utilizzato per dirigere l'attenzione degli utenti verso elementi chiave.

---

## Livelli

| Livello | CSS class | SCSS variable | Value |
|---------|-----------|---------------|-------|
| **Radius 1** | `.radius-1` | `$radius-1` | 4px |
| **Radius 2** | `.radius-2` | `$radius-2` | 8px |
| **Radius 3** | `.radius-3` | `$radius-3` | 16px |
| **Radius 4** | `.radius-4` | `$radius-4` | 24px |

Nei componenti dxc-webkit il border-radius si applica tramite la prop **`radius`** sui componenti che accettano **BoxProps** (es. `Box`, `Text`), oppure assegnando la classe CSS corrispondente (`.radius-1`, `.radius-2`, `.radius-3`, `.radius-4`) all'elemento. Sono disponibili anche varianti per singolo lato (es. `radius-2-top`). Vedi [Layout](34-layout.md) per le BoxProps.
