# Shadows

Sistema di ombre (shadow) del design system DXC: livelli da extra-small a large per profondità, gerarchia e separazione degli elementi nell'interfaccia.

---

## Panoramica

La shadow (ombreggiatura) è una tecnica utilizzata per aggiungere profondità e dimensione agli elementi dell'interfaccia utente, migliorando la percezione di profondità, gerarchia e separazione degli elementi.

---

## Livelli di ombra

Si riferiscono all'aggiunta di ombre agli elementi dell'interfaccia utente per creare profondità e gerarchia. Aiutano a migliorare la leggibilità, la comprensione della disposizione degli elementi e la navigazione dell'utente.

| Livello | X | Y | Blur | Spread | Color | Opacity | CSS class | SCSS variable |
|---------|---|---|------|--------|-------|---------|------------|----------------|
| **Extra-Small** | 0 | 0 | 4px | 0 | $gray-cool-150 | 30% | `.shadow-xs` | `$shadow-xs` |
| **Small** | 0 | 0 | 8px | 0 | $gray-cool-150 | 30% | `.shadow-sm` | `$shadow-sm` |
| **Medium** | 0 | 0 | 24px | 0 | $gray-cool-150 | 20% | `.shadow-md` | `$shadow-md` |
| **Large** | 0 | 0 | 32px | 0 | $gray-cool-150 | 20% | `.shadow-lg` | `$shadow-lg` |

### Dettaglio per livello

**Extra-Small**  
- X: 0, Y: 0, Blur: 4px, Spread: 0  
- Color: $gray-cool-150, Opacity: 30%  
- CSS class: `.shadow-xs` | SCSS variable: `$shadow-xs`

**Small**  
- X: 0, Y: 0, Blur: 8px, Spread: 0  
- Color: $gray-cool-150, Opacity: 30%  
- CSS class: `.shadow-sm` | SCSS variable: `$shadow-sm`

**Medium**  
- X: 0, Y: 0, Blur: 24px, Spread: 0  
- Color: $gray-cool-150, Opacity: 20%  
- CSS class: `.shadow-md` | SCSS variable: `$shadow-md`

**Large**  
- X: 0, Y: 0, Blur: 32px, Spread: 0  
- Color: $gray-cool-150, Opacity: 20%  
- CSS class: `.shadow-lg` | SCSS variable: `$shadow-lg`

---

## Utilizzo

- **Separazione:** usa le shadow per separare gli elementi dall'ambiente circostante.
- **Interattività:** si utilizzano per indicare elementi interattivi (es. pulsanti).
- **Profondità:** creano un effetto tridimensionale di profondità fra gli elementi.

Nei componenti dxc-webkit l'ombra si applica tramite la prop **`shadow`** sui componenti che accettano **BoxProps** (es. `Box`, `Text`), oppure assegnando la classe CSS corrispondente (`.shadow-xs`, `.shadow-sm`, `.shadow-md`, `.shadow-lg`) all'elemento. Vedi [Layout](34-layout.md) per le BoxProps.
