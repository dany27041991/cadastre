# Icone

Il componente **Icona** unifica i tipi di icone supportati (icone SVG personalizzate). Ogni icona è un componente React che accetta `stroke`, `fill`, `size`, `title` e si integra con il design system (colori, dimensioni).

---

## Panoramica

Il componente Icona è lo strumento per unificare i tipi di icone supportati (icone SVG personalizzate).

```tsx
import { icons } from "dxc-webkit";

const HomeIcon = icons.HomeIcon;

<div className="d-flex justify-content-center align-items-center">
  <HomeIcon
    fill="transparent"
    size="md"
    stroke="primary"
    title="SVG title"
  />
</div>
```

---

## Proprietà

Le icone espongono **SVGRProps** (vedi [Icone – API](08-icons.md) per i dettagli).

| Name | Description | Default |
|------|-------------|---------|
| **title** | Testo per accessibilità / tooltip. Tipo: `string`. | — |
| **titleId** | Id per l’elemento title. Tipo: `string`. | — |
| **stroke** | Colore del tratto. Valori: `"base"`, `"white"`, `"black"`, `"transparent"`, `"primary"`, `"blue-20"` … (tutti i colori del design system). | `"primary"` |
| **fill** | Colore di riempimento. Stessi valori di `stroke`. | `"transparent"` |
| **size** | Dimensione: `"xs"` \| `"sm"` \| `"md"` \| `"lg"` \| `"xl"` \| `"auto"`. | `"auto"` |

---

## Elenco delle icone

AccountBalanceIcon, AddCircleIcon, ArrowCircleDownIcon, ArrowCircleLeftIcon, ArrowCircleRightIcon, ArrowCircleUpIcon, ArrowDownCircleIcon, ArrowDownIcon, ArrowDownUpIcon, ArrowLeftIcon, ArrowRightIcon, ArrowSquareRightFillIcon, ArrowSquareRightIcon, ArrowUpIcon, AssistantIcon, CalendarBoldIcon, CalendarIcon, CallIcon, CaretDownFillIcon, CaretDownIcon, CaretUpFillIcon, CaretUpIcon, CategoryFillIcon, CategoryIcon, ChartIcon, ChatIcon, ClockIcon, CloseCircleIcon, CloseSquareIcon, CondizioniAtmosfericheIcon, CoperturaSuoloIcon, DangerIcon, DatabaseFillIcon, DatabaseIcon, DistribuzionePopolazioneIcon, DistribuzioneSpecieIcon, DocumentCopyIcon, DocumentDownloadBoldIcon, DocumentDownloadIcon, DocumentFilterFillIcon, DocumentFilterIcon, DocumentTextIcon, DocumentUploadIcon, DoorClosedIcon, DoorOpenIcon, DragHandleDotsIcon, EdificiIcon, EditIcon, ElementiMeteorologiciIcon, ElementiOceanograficiIcon, ElevazioneIcon, EllipsysIcon, EmojiSadIcon, EyeIcon, FacebookIcon, FirstlineIcon, FirstlineWhiteIcon, FolderAddIcon, FolderIcon, FolderMinusIcon, FolderSimpleIcon, GalleryIcon, GeologiaIcon, GlobalSearchIcon, GlobeAmericasIcon, Grid3x3Icon, GriglieGeograficheIcon, HabitatBiotipiIcon, HelpCircleIcon, HomeIcon, IdrografiaIcon, ImpiantiAgricoliAcquacolturaIcon, ImpiantiIndustrialiIcon, IndirizziIcon, InfoCircleIcon, InfoIcon, InformationIcon, InstagramIcon, LineArrowDownIcon, LineArrowUpIcon, LinkedinIcon, ListIcon, LoadingIcon, LogoRepubblicaItalianaIcon, LogoutIcon, MailIcon, MapBoldIcon, MapIcon, MaximizeIcon, MaximizeSingleFillIcon, MaximizeSingleIcon, MeteoGeografiaIcon, MinimizeSingleFillIcon, MinusCirlceIcon, MonitoraggioAmbientaleIcon, MoreSquareFillIcon, MoreSquareIcon, MountainBoldIcon, MountainIcon, NewTabIcon, NomiGeograficiIcon, NotificationIcon, OGCIcon, OrtoImmaginiIcon, ParcelleCatastaliIcon, PenFillIcon, PenIcon, PenToolIcon, PeopleIcon, PersonFillIcon, PinMapFillIcon, PlaceholderIcon, ProfileCircleIcon, ReceiptSearchIcon, RefreshIcon, RegioniBiogeograficheIcon, RegioniMarineIcon, RetiTrasportoIcon, RischioNaturaleIcon, RisorseEnergeticheIcon, RisorseMinerarieIcon, SaluteUmanaIcon, ScanningIcon, SearchIcon, SearchNormalIcon, SearchZoomInFillIcon, SearchZoomInIcon, SearchZoomOutFillIcon, SearchZoomOutIcon, SendSquareIcon, ServiziPubbliciIcon, SettingsFillIcon, SettingsIcon, ShareIcon, ShieldIcon, ShoppingCartIcon, SistemaRiferimentoIcon, SitiProtettiIcon, SlashIcon, StarFillIcon, StarIcon, StickerIcon, StickynoteBoldIcon, StickynoteIcon, SuoloIcon, TickCircleIcon, TimerIcon, TrashIcon, TreeBoldIcon, TreeIcon, TwitterIcon, UnitaAmministrativeIcon, UnitaStatisticheIcon, UserIcon, UtilizzoTerritorioIcon, VectorIcon, XIcon, YouTubeIcon, ZoneRegolamentateIcon.

Per l’elenco completo e i tipi TypeScript: `node_modules/dxc-webkit/dist/components/icons/tsx/index.d.ts`.

---

## Utilizzo

- Utilizza sempre le icone tramite il componente Icona (export da `icons`).
- Affianca l’icona al testo o fornisci una descrizione/`title` per l’accessibilità.

---

## Varianti

### Primary

```tsx
<HomeIcon
  fill="transparent"
  size="md"
  stroke="primary"
  title="SVG title"
/>
```

### Esempio di dimensioni

`size`: **xs** (20×20), **sm**, **md** (40×40), **lg**, **xl** (80×80).

```tsx
<div className="d-flex justify-content-center align-items-center">
  <HomeIcon color="primary" size="xs" title="Small (20x20)" />
  <HomeIcon color="primary" size="sm" title="Small (20x20)" />
  <HomeIcon color="primary" size="md" title="Medium (40x40)" />
  <HomeIcon color="primary" size="lg" title="Large (80x80)" />
  <HomeIcon color="primary" size="xl" title="Large (80x80)" />
</div>
```

### Dark mode

Le icone rispettano il tema; in contesti dark usare `stroke`/`fill` adatti (es. `stroke="white"` o varianti primary del tema dark).

```tsx
<div
  className="d-flex justify-content-center align-items-center dark-theme"
  style={{ backgroundColor: "#000203", padding: "20px" }}
>
  <HomeIcon
    fill="transparent"
    size="md"
    stroke="primary"
    title="SVG title"
  />
</div>
```

---

Per import, tipi e props dettagliate vedi [Icone (08)](08-icons.md).
