# dxc-webkit – Documentazione dettagliata componenti

Libreria **dxc-webkit** v1.6.0 – design system MASE/DXC (React, Bootstrap Italia).  
Export principale: `dist/main.js` → `export * from './components'` e `export * from './functions'`.

**Documentazione ufficiale:** [https://dxc-webkit-develdxap-portali.apps.dxap-svil.ocp.mase.priv](https://dxc-webkit-develdxap-portali.apps.dxap-svil.ocp.mase.priv)

## Indice documentazione

| Documento | Componenti |
|-----------|------------|
| [Colors](00-colors.md) | Sistema colori: globali, semantica, utilizzo |
| [Typography](00-typography.md) | Font (Titillium Web, Lora, Roboto Mono), stili testo, utilizzo |
| [Grid](00-grid.md) | Row, Col: griglia Bootstrap, align, justify, varianti |
| [Shadows](00-shadows.md) | Livelli ombra (xs, sm, md, lg), utilizzo |
| [Border Radius](00-border-radius.md) | Radius 1–4 (4px, 8px, 16px, 24px), classi e variabili |
| [Spacing](00-spacing.md) | Scale xxl–xxs, margin/padding, assi verticale/orizzontale, utilizzo |
| [Icone (design)](00-icons.md) | Icona: proprietà, elenco, varianti (primary, dimensioni, dark) |
| [Template Mappa](00-template-map.md) | Mappa + Floating Panel + Accordion dettaglio, utilizzo, do's and don'ts |
| [Template Mappa secondaria](00-template-map-secondary.md) | Mappa secondaria + Sidebar + Info Panel + Body, utilizzo, do's and don'ts |
| [Template Repository documentale](00-template-documenti.md) | Ricerca/filtri, vista tabellare e a griglia (card), paginazione, do's and don'ts |
| [Button](01-button.md) | `Button` |
| [Text](02-text.md) | `Text` (tipografia + BoxProps) |
| [Modal](03-modal.md) | `Modal`, `ModalHeader`, `ModalBody`, `ModalFooter` |
| [InfoPanel](04-info-panel.md) | `InfoPanel` |
| [Input e SearchInput](05-input-searchinput.md) | `Input`, `SearchInput`, `FormSearchInput`, `FoldableSearchInput` |
| [Table](06-table.md) | `CustomTable`, `TableColumn`, `TableRow`, `TableAction`, paginazione |
| [Badge, Spinner, Upload](07-badge-spinner-upload.md) | `Badge`, `Spinner`, `Upload` |
| [Icone](08-icons.md) | `icons` (elenco e uso con `SVGRProps`) |
| [Accordion](10-accordion.md) | `Accordion`, `AccordionItem`, `AccordionHeader`, `AccordionBody` |
| [Alert](11-alert.md) | `Alert` |
| [Avatar](12-avatar.md) | `Avatar` |
| [AvatarGroup](13-avatar-group.md) | `AvatarGroup` |
| [Badge](14-badge.md) | `Badge` (guida uso) |
| [BottomBar](15-bottom-bar.md) | `BottomBar` |
| [Breadcrumb](16-breadcrumb.md) | `Breadcrumb`, `BreadcrumbItem`, `BreadcrumbIcon` |
| [ButtonGroup](17-button-group.md) | `ButtonGroup` |
| [Card](18-card.md) | `Card`, sottocomponenti (CardHeader, CardBody, CardFooter, …) |
| [Carousel](19-carousel.md) | `Carousel`, `CustomCarouselIndicators` |
| [Checkbox](20-checkbox.md) | `Checkbox`, `FormCheckbox`, `SemiCheckbox` |
| [Chip](21-chip.md) | `Chip` |
| [DataTile](22-data-tile.md) | `DataTile` |
| [DatePicker](23-date-picker.md) | `DatePicker`, `FormDatePicker` |
| [DefaultPage](24-default-page.md) | `DefaultPage` |
| [Dropdown](25-dropdown.md) | `Dropdown`, `DropdownItem`, `DropdownLink`, `DropdownDivider`, `CustomDropdown` |
| [EmptyIcon](26-empty-icon.md) | `EmptyIcon` |
| [FloatingPanel](27-floating-panel.md) | `FloatingPanel` |
| [Footer](28-footer.md) | `FooterExpanded`, `FooterCompressed`, `FooterLogos`, partials |
| [Form](29-form.md) | `Form` (react-hook-form) |
| [FormGroup](30-form-group.md) | `FormGroup`, `useFormGroupIds` |
| [Header](31-header.md) | `Header`, topBar, middleBar, navigazione |
| [HeroBanner](32-hero-banner.md) | `HeroBanner` |
| [Language](33-language.md) | `Language` (selettore lingua) |
| [Layout](34-layout.md) | `Box`, `Container`, `Row`, `Col` |
| [List](35-list.md) | `List`, `ListItem`, `CustomListItem` |
| [Loader](36-loader.md) | `Loader` (lineare e circolare) |
| [MegaboxFilter](37-megabox-filter.md) | `MegaboxFilter` |
| [Navscroll](38-navscroll.md) | `Navscroll`, `NavscrollItem`, `NavscrollSubItem` |
| [Pagination](39-pagination.md) | `Pagination`, `getPageItems`, `getDropDownItems` |
| [Popover](40-popover.md) | `Popover` |
| [RadioButton](41-radio-button.md) | `RadioButton`, `FormRadio` |
| [Scrollbar](42-scrollbar.md) | `Scrollbar` |
| [SearchInput](43-search-input.md) | `SearchInput`, `FormSearchInput`, `FoldableSearchInput` (dettaglio) |
| [Sidebar](44-sidebar.md) | `Sidebar`, `SidebarItem`, `SidebarGroupItem`, `SidebarHeader`, `SidebarFooter`, … |
| [Slider](45-slider.md) | `Slider` (rc-slider) |
| [Spinner](46-spinner.md) | `Spinner` |
| [Stepper](47-stepper.md) | `Stepper`, `CustomStepper`, `CustomStepperHeader`, `CustomStepperFooter` |
| [Switcher](48-switcher.md) | `Switcher` |
| [Table](49-table.md) | `Table`, `CustomTable`, `PaginatedTable`, `TableColumn`, `TableAction` (dettaglio) |
| [TabNavigation](50-tab-navigation.md) | `TabNavigation`, `Tab` |
| [TextArea](51-text-area.md) | `TextArea`, `FormTextArea` |
| [TimePicker](52-time-picker.md) | `TimePicker`, `FormTimePicker` |
| [Toggle](53-toggle.md) | `Toggle`, `FormToggle` |
| [Tooltip](54-tooltip.md) | `Tooltip` |
| [Upload](55-upload.md) | `Upload` |
| [VideoViewer](56-video-viewer.md) | `VideoViewer` |
| [Altri componenti](09-altri-componenti.md) | Altri export e riferimenti |

## Import generale

```tsx
import {
  Button,
  Text,
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
  InfoPanel,
  Input,
  SearchInput,
  CustomTable,
  Badge,
  Spinner,
  Upload,
  icons,
} from "dxc-webkit";

// Stili (sideEffects)
import "dxc-webkit/dist/assets/style.css";
```

## Funzioni utility

```tsx
import { convertClickToKeyDown, debounce } from "dxc-webkit";
```

## Definizioni condivise

- **Colori:** `ColorsType` / `ColorsEnum` (primary, success, danger, white, blue-*, yellow-*, …).
- **Dimensioni:** `SizesType` / `SizesEnum` (`xs`, `sm`, `md`, `lg`, `xl`, `auto`).
- **Font:** `FontType` / `FontEnum` (es. `f1-style-h1-bold`, `f1-body-md`, …).

Tipi da `definitions` e `constants` sono usati nei componenti (es. `ButtonColor`, `ButtonSize`, `ModalSize`).
