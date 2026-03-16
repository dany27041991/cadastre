# Sidebar

Barra laterale con header, footer, voci e gruppi; variante chiara/scura e stato collassabile.

---

## Overview

**Sidebar** è un pannello laterale con **SidebarHeader** (logo, label, toggle collapse), **SidebarFooter** (avatar, testo), **SidebarItem** (icona, label, stato attivo), **SidebarGroupItem** (gruppo con sottovoci), **SidebarSectionTitle** e **SidebarDivider**. Supporta `variant` (light/dark), `collapsed` e `toggleCollapse`, dimensioni `width`/`height`.

---

## Import

```tsx
import {
  Sidebar,
  SidebarHeader,
  SidebarFooter,
  SidebarItem,
  SidebarGroupItem,
  SidebarSectionTitle,
  SidebarDivider,
} from "dxc-webkit";
```

---

## Tipi

- **SidebarColorsType:** `'light' | 'dark'`

---

## Sidebar – SidebarProps

Estende `HTMLAttributes<HTMLElement>`.

| Prop | Tipo | Default | Descrizione |
|------|------|---------|-------------|
| `variant` | `SidebarColorsType` | — | Tema: `'light'` o `'dark'`. |
| `headerConfig` | `SidebarHeaderProps` | — | Configurazione header. |
| `footerConfig` | `SidebarFooterProps` | — | Configurazione footer. |
| `hideHeader` | `boolean` | — | Nasconde l'header. |
| `hideFooter` | `boolean` | — | Nasconde il footer. |
| `collapsed` | `boolean` | — | Sidebar compressa. |
| `toggleCollapse` | `() => void` | — | Callback toggle collapse. |
| `width` | `string \| number` | — | Larghezza. |
| `height` | `string \| number` | — | Altezza. |
| `children` | `ReactElement \| ReactElement[]` | — | Contenuto (item, group, divider). |
| `className` | `string` | — | Classi CSS. |

---

## SidebarHeader – SidebarHeaderProps

| Prop | Tipo | Default | Descrizione |
|------|------|---------|-------------|
| `label` | `string` | — | Testo header. |
| `logoConfig1` | `AvatarProps` | — | Configurazione logo/avatar. |
| `toggleCollapse` | `() => void` | — | Toggle collapse. |
| `variant` | `SidebarColorsType` | — | Tema. |
| `className` | `string` | — | Classi CSS. |

---

## SidebarFooter – SidebarFooterProps

| Prop | Tipo | Default | Descrizione |
|------|------|---------|-------------|
| `text` | `string` | — | Testo principale. |
| `collapsedText` | `string` | — | Testo quando collapsed. |
| `name` | `string` | — | Nome (es. utente). |
| `subtitle` | `string` | — | Sottotitolo. |
| `avatarConfig` | `AvatarProps` | — | Avatar. |
| `className` | `string` | — | Classi CSS. |

---

## SidebarItem – SidebarItemProps

Polimorfico (`as`). Estende `HTMLAttributes<HTMLElement>`.

| Prop | Tipo | Default | Descrizione |
|------|------|---------|-------------|
| `Icon` | `FC<SVGRProps>` | — | Icona (obbligatorio). |
| `label` | `string` | — | Testo voce. |
| `hideIcon` | `boolean` | — | Nasconde l'icona. |
| `isActive` | `boolean` | — | Voce attiva. |
| `disabled` | `boolean` | — | Disabilitata. |
| `className` | `string` | — | Classi CSS. |

---

## SidebarGroupItem – SidebarGroupItemProps

| Prop | Tipo | Default | Descrizione |
|------|------|---------|-------------|
| `IconGroup` | `FC<SVGRProps>` | — | Icona del gruppo. |
| `labelGroup` | `string` | — | Etichetta gruppo. |
| `children` | `ReactNode` | — | Sotto-voci. |
| `onClick` | `() => void` | — | Click sul gruppo. |
| `className` | `string` | — | Classi CSS. |

---

## SidebarSectionTitle – SidebarSectionTitleProps

| Prop | Tipo | Default | Descrizione |
|------|------|---------|-------------|
| `labelSection` | `string` | — | Titolo sezione. |
| `IconSection` | `FC<SVGRProps>` | — | Icona opzionale. |
| `className` | `string` | — | Classi CSS. |

---

## SidebarDivider

Componente senza props: linea di separazione.

---

## Esempio

```tsx
<Sidebar
  variant="dark"
  collapsed={collapsed}
  toggleCollapse={() => setCollapsed(!collapsed)}
  headerConfig={{ label: "App", toggleCollapse: () => setCollapsed((c) => !c) }}
  footerConfig={{ name: "Utente", avatarConfig: { alt: "Avatar" } }}
>
  <SidebarItem Icon={icons.Home} label="Home" isActive />
  <SidebarSectionTitle labelSection="Sezione" />
  <SidebarGroupItem IconGroup={icons.Folder} labelGroup="Gruppo">
    <SidebarItem Icon={icons.File} label="Voce 1" />
  </SidebarGroupItem>
  <SidebarDivider />
</Sidebar>
```
