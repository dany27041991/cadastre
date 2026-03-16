# Language

Selettore lingua per i18n: lista lingue con label, value e country; callback al cambio lingua.

---

## Overview

Il componente **Language** è un picker per la selezione della lingua dell’applicazione. Accetta una lista di opzioni (`label`, `value`, `country`) e un callback `onLanguageChange`; supporta lingua di default e label personalizzata per il select.

---

## Import

```tsx
import { Language } from "dxc-webkit";
```

---

## Tipi

- **LanguageOption:** `{ label: string; value: string; country: string }`

---

## API – LanguageProps

| Prop | Tipo | Default | Descrizione |
|------|------|---------|-------------|
| `languageList` | `LanguageOption[]` | — | Lista delle lingue disponibili (obbligatorio). |
| `onLanguageChange` | `(selectedLanguage: string) => void` | — | Chiamato quando l’utente cambia lingua. |
| `defaultLanguage` | `string` | — | Lingua selezionata di default. |
| `selectLabel` | `string` | — | Etichetta per il campo select. |
| `className` | `string` | — | Classi CSS aggiuntive. |

---

## Esempio

```tsx
const languages = [
  { label: "Italiano", value: "it", country: "IT" },
  { label: "English", value: "en", country: "GB" },
];

<Language
  languageList={languages}
  defaultLanguage="it"
  selectLabel="Lingua"
  onLanguageChange={(lang) => i18n.changeLanguage(lang)}
/>
```
