# Stepper

Wizard a step: **Stepper** (completo con lista step e modale) e **CustomStepper** con header/footer e controlli configurabili.

---

## Overview

**Stepper** gestisce un flusso a step con `listStep`, `changeData`/`setChangeData`, pulsanti prev/next, submit e modale. **CustomStepper** è la variante componibile: **CustomStepperHeader** (step in orizzontale), **CustomStepperFooter** (pulsanti), `steps` (array **StepConfig** con `id`, `title`, `subtitle`, `state`: active/completed/error/disabled), `currentStep`/`setCurrentStep` e `buttonConfigPrev`/`buttonConfigNext`/`buttonConfigAux`.

---

## Import

```tsx
import {
  Stepper,
  CustomStepper,
  CustomStepperHeader,
  CustomStepperFooter,
} from "dxc-webkit";
```

---

## Stepper – StepperProps

| Prop | Tipo | Default | Descrizione |
|------|------|---------|-------------|
| `listStep` | `ListStepInterface[]` | — | Lista step (value, title, description, state, open). |
| `emptyPage` | `boolean` | — | Pagina vuota. |
| `changeData` | `DataChangeData \| null` | — | Dati modifica. |
| `setChangeData` | `(data: DataChangeData \| null) => void` | — | Setter changeData. |
| `currentPage` | `number` | — | Step corrente. |
| `setCurrentPage` | `(data: number) => void` | — | Setter step. |
| `actualPage` | `JSX.Element` | — | Contenuto della pagina corrente. |
| `handlerSave` | `() => void` | — | Salvataggio. |
| `submitBtn` | `string` | — | Etichetta pulsante submit. |
| `textBtnNew` | `string` | — | Etichetta pulsante nuovo. |
| `textBtnPre` | `string` | — | Etichetta pulsante indietro. |
| `textLeftBtn` | `string` | — | Etichetta pulsante sinistro. |
| `onClickLeftBtn` | `MouseEventHandler` | — | Click pulsante sinistro. |
| `textLeftBtnRed` | `string` | — | Etichetta pulsante sinistro (rosso). |
| `onClickLeftBtnRed` | `MouseEventHandler` | — | Click pulsante sinistro rosso. |
| `titlePage` | `string` | — | Titolo pagina. |
| `subTitle` | `string` | — | Sottotitolo. |
| `titleModal` | `string` | — | Titolo modale. |
| `textInfoModal` | `string` | — | Testo modale. |
| `labelBadge` | `string` | — | Label badge. |
| `iconList` | `JSX.Element` | — | Icona lista. |
| `mobileContainer` | `boolean` | — | Layout mobile. |
| `showPercentageLoader` | `boolean` | — | Mostra loader percentuale. |
| `initialSelectedValue` | `number` | — | Valore iniziale selezionato. |
| `onUserChangePagePlus` | `() => Promise<void>` | — | Callback cambio pagina. |

---

## CustomStepper – CustomStepperProps

| Prop | Tipo | Default | Descrizione |
|------|------|---------|-------------|
| `steps` | `StepConfig[]` | — | Configurazione step (id, title, subtitle, state, tooltipConfig). |
| `currentStep` | `number` | — | Indice step attivo. |
| `setCurrentStep` | `(prev: number) => void` | — | Setter step. |
| `buttonConfigPrev` | `ButtonProps` | — | Pulsante indietro. |
| `buttonConfigNext` | `ButtonProps` | — | Pulsante avanti. |
| `buttonConfigAux` | `ButtonProps` | — | Pulsante ausiliario. |
| `controls` | `StepperHeaderControls` | — | hidePrev, hideNext, disabledPrev, disabledNext. |
| `displayedStepsNumber` | `number` | — | Numero step visibili in header. |
| `children` | `ReactNode` | — | Contenuto corpo stepper. |
| `wrapperClassName` | `string` | — | Classi wrapper esterno. |
| `innerWrapperClassName` | `string` | — | Classi wrapper interno. |
| `headerClassName` | `string` | — | Classi header. |
| `footerWrapperClassName` | `string` | — | Classi footer. |

---

## StepConfig

| Prop | Tipo | Descrizione |
|------|------|-------------|
| `id` | `string \| number` | ID step. |
| `title` | `string` | Titolo. |
| `subtitle` | `string` | Sottotitolo. |
| `state` | `'active' \| 'completed' \| 'error' \| 'disabled'` | Stato step. |
| `tooltipConfig` | `TooltipProps` | Tooltip. |

---

## CustomStepperHeader / CustomStepperFooter

- **CustomStepperHeader:** `headerSteps`, `currentStep`, `setCurrentStep`, `displayedStepsNumber`, `controls`, `className`.
- **CustomStepperFooter:** `buttonConfigPrev`, `buttonConfigNext`, `buttonConfigAux`, `currentStep`, `setCurrentStep`, `lenghtListSteps`, `className`.

---

## Esempio CustomStepper

```tsx
const [step, setStep] = useState(0);
const steps = [
  { id: 1, title: "Step 1", state: "completed" },
  { id: 2, title: "Step 2", state: "active" },
  { id: 3, title: "Step 3", state: "disabled" },
];

<CustomStepper
  steps={steps}
  currentStep={step}
  setCurrentStep={setStep}
  buttonConfigPrev={{ label: "Indietro" }}
  buttonConfigNext={{ label: "Avanti" }}
>
  <div>Contenuto step {step}</div>
</CustomStepper>
```
