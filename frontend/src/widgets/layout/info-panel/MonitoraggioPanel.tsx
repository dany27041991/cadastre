/**
 * Monitoraggio — dxc-webkit Text + List/ListItem + icons (CU reference colors).
 */
import type { FC } from 'react'
import { useTranslation } from 'react-i18next'
import { Box, List, ListItem, Text, icons } from 'dxc-webkit'

export type MonitoraggioActionId =
  | 'area-italia'
  | 'draw-on-map'
  | 'upload-file'
  | 'search-managed-areas'
  | 'search-green-assets'

type IconComponent = (typeof icons)[keyof typeof icons]

/** Italy silhouette uses fill paths; ListItem only passes stroke. */
const AreaItaliaIcon: FC<{ stroke?: string; title?: string }> = ({ stroke, title }) => (
  <icons.UnitaAmministrativeIcon
    fill={stroke === 'disabled' ? 'disabled' : 'primary'}
    stroke="transparent"
    size="xs"
    title={title}
  />
)

type ActionDef = {
  id: MonitoraggioActionId
  Icon: IconComponent | typeof AreaItaliaIcon
  labelKey: string
}

const ACTIONS: ActionDef[] = [
  {
    id: 'area-italia',
    Icon: AreaItaliaIcon,
    labelKey: 'territory.panel.monitoraggio.areaItalia',
  },
  {
    id: 'draw-on-map',
    Icon: icons.PenToolIcon,
    labelKey: 'territory.panel.monitoraggio.drawOnMap',
  },
  {
    id: 'upload-file',
    Icon: icons.DocumentTextIcon,
    labelKey: 'territory.panel.monitoraggio.uploadFile',
  },
  {
    id: 'search-managed-areas',
    Icon: icons.GlobalSearchIcon,
    labelKey: 'territory.panel.monitoraggio.searchManagedAreas',
  },
  {
    id: 'search-green-assets',
    Icon: icons.ScanningIcon,
    labelKey: 'territory.panel.monitoraggio.searchGreenAssets',
  },
]

type MonitoraggioPanelProps = {
  selectedId: MonitoraggioActionId | null
  onSelect: (id: MonitoraggioActionId) => void
  onClearSelection: () => void
}

export function MonitoraggioPanel({ selectedId, onSelect, onClearSelection }: MonitoraggioPanelProps) {
  const { t } = useTranslation()

  const clearSelection = () => {
    onClearSelection()
    const focused = document.activeElement
    if (focused instanceof HTMLElement && focused.classList.contains('list-item')) {
      focused.blur()
    }
  }

  return (
    <Box
      as="div"
      className="mb-5 monitoraggio-panel"
      onClick={clearSelection}
      role="presentation"
    >
      <Text
        font="f1-style-h1-bold"
        style={{ fontSize: '20px', fontWeight: 600 }}
        className="mt-1"
        color="text-primary"
        as="h2"
      >
        {t('territory.panel.monitoraggio.title')}
      </Text>

      <Text
        as="p"
        font="f1-body-sm"
        color="text-black"
        className="monitoraggio-panel__description"
      >
        {t('territory.panel.monitoraggio.description')}
      </Text>

      <List className="monitoraggio-panel__list" label={t('territory.panel.monitoraggio.title')}>
        {ACTIONS.map((action) => (
          <ListItem
            key={action.id}
            label={t(action.labelKey)}
            Icon={action.Icon}
            isActive={selectedId === action.id}
            onClick={(e) => {
              e.stopPropagation()
              onSelect(action.id)
            }}
          />
        ))}
      </List>
    </Box>
  )
}
