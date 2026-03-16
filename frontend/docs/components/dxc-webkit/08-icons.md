# Icone (icons)

Le icone sono esportate come oggetto **`icons`**: ogni chiave è il nome del componente (es. `HomeIcon`, `MapIcon`). Ogni icona è un `FC<SVGRProps>` e accetta dimensioni, colore (fill/stroke) e titolo per l’accessibilità.

---

## Import

```tsx
import { icons } from "dxc-webkit";

// Uso
const HomeIcon = icons.HomeIcon;
<icons.MapIcon size="xs" title="Mappa" />
```

## SVGRProps

Props condivise dalle icone (estendono `SVGProps<SVGSVGElement>` senza `stroke`):

| Prop | Tipo | Descrizione |
|------|------|-------------|
| `title` | `string` | Accessibilità / tooltip. |
| `titleId` | `string` | Id per titolo. |
| `fill` | `Colors` | Colore riempimento. |
| `stroke` | `Colors` | Colore tratto. |
| `size` | `Sizes` | `'xs' \| 'sm' \| 'md' \| 'lg' \| 'xl' \| 'auto'`. |

## Esempio

```tsx
<icons.HomeIcon fill="primary" size="xs" title="Home" />
<icons.MapIcon size="sm" title="Mappa" />
<icons.TrashIcon size="md" title="Elimina" />
```

## Elenco icone (export da `icons/tsx`)

AccountBalanceIcon, AddCircleIcon, ArrowCircleDownIcon, ArrowCircleLeftIcon, ArrowCircleRightIcon, ArrowCircleUpIcon, ArrowDownCircleIcon, ArrowDownIcon, ArrowDownUpIcon, ArrowLeftIcon, ArrowRightIcon, ArrowSquareRightFillIcon, ArrowSquareRightIcon, ArrowUpIcon, AssistantIcon, CalendarBoldIcon, CalendarIcon, CallIcon, CaretDownFillIcon, CaretDownIcon, CaretUpFillIcon, CaretUpIcon, CategoryFillIcon, CategoryIcon, ChartIcon, ChatIcon, ClockIcon, CloseCircleIcon, CloseSquareIcon, CondizioniAtmosfericheIcon, CoperturaSuoloIcon, DangerIcon, DatabaseFillIcon, DatabaseIcon, DistribuzionePopolazioneIcon, DistribuzioneSpecieIcon, DocumentCopyIcon, DocumentDownloadBoldIcon, DocumentDownloadIcon, DocumentFilterFillIcon, DocumentFilterIcon, DocumentTextIcon, DocumentUploadIcon, DoorClosedIcon, DoorOpenIcon, DragHandleDotsIcon, EdificiIcon, EditIcon, ElementiMeteorologiciIcon, ElementiOceanograficiIcon, ElevazioneIcon, EllipsysIcon, EmojiSadIcon, EyeIcon, FacebookIcon, FirstlineIcon, FirstlineWhiteIcon, FolderAddIcon, FolderIcon, FolderMinusIcon, FolderSimpleIcon, GalleryIcon, GeologiaIcon, GlobalSearchIcon, GlobeAmericasIcon, Grid3x3Icon, GriglieGeograficheIcon, HabitatBiotipiIcon, HelpCircleIcon, **HomeIcon**, IdrografiaIcon, ImpiantiAgricoliAcquacolturaIcon, ImpiantiIndustrialiIcon, IndirizziIcon, InfoCircleIcon, InfoIcon, InformationIcon, InstagramIcon, LineArrowDownIcon, LineArrowUpIcon, LinkedinIcon, ListIcon, LoadingIcon, LogoRepubblicaItalianaIcon, LogoutIcon, MailIcon, MapBoldIcon, **MapIcon**, MaximizeIcon, MaximizeSingleFillIcon, MaximizeSingleIcon, MeteoGeografiaIcon, MinimizeSingleFillIcon, MinusCirlceIcon, MonitoraggioAmbientaleIcon, MoreSquareFillIcon, MoreSquareIcon, MountainBoldIcon, MountainIcon, NewTabIcon, NomiGeograficiIcon, NotificationIcon, OGCIcon, OrtoImmaginiIcon, ParcelleCatastaliIcon, PenFillIcon, PenIcon, PenToolIcon, PeopleIcon, PersonFillIcon, PinMapFillIcon, PlaceholderIcon, ProfileCircleIcon, ReceiptSearchIcon, RefreshIcon, RegioniBiogeograficheIcon, RegioniMarineIcon, RetiTrasportoIcon, RischioNaturaleIcon, RisorseEnergeticheIcon, RisorseMinerarieIcon, SaluteUmanaIcon, ScanningIcon, SearchIcon, SearchNormalIcon, SearchZoomInFillIcon, SearchZoomInIcon, SearchZoomOutFillIcon, SearchZoomOutIcon, SendSquareIcon, ServiziPubbliciIcon, SettingsFillIcon, SettingsIcon, ShareIcon, ShieldIcon, ShoppingCartIcon, SistemaRiferimentoIcon, SitiProtettiIcon, SlashIcon, StarFillIcon, StarIcon, StickerIcon, StickynoteBoldIcon, StickynoteIcon, SuoloIcon, TickCircleIcon, TimerIcon, TrashIcon, TreeBoldIcon, TreeIcon, TwitterIcon, UnitaAmministrativeIcon, UnitaStatisticheIcon, UserIcon, UtilizzoTerritorioIcon, VectorIcon, XIcon, YouTubeIcon, ZoneRegolamentateIcon.

Per nuovi nomi verificare `node_modules/dxc-webkit/dist/components/icons/tsx/index.d.ts`.
