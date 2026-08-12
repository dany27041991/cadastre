/**
 * dxc-webkit sidebar — CU menu (Menù + Dashboard).
 * Collapse behaviour aligned with cu1.5-fe: fixed widths, hide section labels,
 * icon-only items with Tooltip on the right.
 */
import { useId, useMemo, useState, type ComponentType } from 'react'
import {
  Box,
  Text,
  Tooltip,
  Sidebar as DxcSidebar,
  SidebarItem as DxcSidebarItem,
  SidebarGroupItem as DxcSidebarGroupItem,
  icons,
} from 'dxc-webkit'
import { Line } from '@/shared/ui'

const SIDEBAR_HEADER_LOGO = { img: '/logo-mase.png', alt: 'MASE' }

/** cu1.5-fe Sidebar.tsx widths */
const SIDEBAR_WIDTH_EXPANDED = '330px'
const SIDEBAR_WIDTH_COLLAPSED = '85px'

type SidebarIcon = ComponentType<{ stroke?: string; size?: string; title?: string }>

function SidebarSection({
  label,
  collapsed,
}: {
  readonly label: string
  readonly collapsed: boolean
}) {
  return (
    <Box as="div" className="sidebar-section" style={{ marginBottom: '0.25rem', marginTop: '0.5rem' }}>
      <Box
        as="div"
        display="flex"
        justify={collapsed ? 'center' : 'between'}
        align="center"
      >
        {!collapsed && (
          <Text
            font="f1-style-h5-semibold"
            color="text-primary"
            as="h2"
            style={{ margin: 0, lineHeight: 1.2 }}
          >
            {label}
          </Text>
        )}
      </Box>
      <Line />
    </Box>
  )
}

function MenuSidebarItem({
  Icon,
  label,
  isActive,
  onClick,
  collapsed,
}: {
  readonly Icon: SidebarIcon
  readonly label: string
  readonly isActive?: boolean
  readonly onClick?: () => void
  readonly collapsed: boolean
}) {
  const reactId = useId()
  const targetId = useMemo(() => `sidebar-item-${reactId.replace(/:/g, '')}`, [reactId])
  const [tooltipOpen, setTooltipOpen] = useState(false)

  return (
    <Box as="div" id={targetId}>
      {collapsed && (
        <Tooltip
          color="dark"
          isOpen={tooltipOpen}
          toggle={() => setTooltipOpen((open) => !open)}
          placement="right"
          target={targetId}
          title={label}
        />
      )}
      <DxcSidebarItem Icon={Icon} label={label} isActive={isActive} onClick={onClick} />
    </Box>
  )
}

export interface SidebarProps {
  collapsed?: boolean
  toggleCollapse?: () => void
}

export function Sidebar({ collapsed = false, toggleCollapse = () => {} }: SidebarProps) {
  const [activeId, setActiveId] = useState('mappa')
  const groupReactId = useId()
  const groupTargetId = useMemo(
    () => `sidebar-group-${groupReactId.replace(/:/g, '')}`,
    [groupReactId]
  )
  const [groupTooltipOpen, setGroupTooltipOpen] = useState(false)

  return (
    <Box as="div" style={{ width: '100%', height: '100%' }}>
      <DxcSidebar
        variant="light"
        collapsed={collapsed}
        toggleCollapse={toggleCollapse}
        headerConfig={{
          label: 'CU 8.0',
          logoConfig1: SIDEBAR_HEADER_LOGO,
          toggleCollapse,
          color: 'primary',
        }}
        hideFooter
        style={{
          width: collapsed ? SIDEBAR_WIDTH_COLLAPSED : SIDEBAR_WIDTH_EXPANDED,
          height: '100%',
        }}
      >
        <SidebarSection label="Menù" collapsed={collapsed} />
        <MenuSidebarItem
          Icon={icons.MapIcon}
          label="Mappa"
          collapsed={collapsed}
          isActive={activeId === 'mappa'}
          onClick={() => setActiveId('mappa')}
        />
        <MenuSidebarItem
          Icon={icons.DocumentTextIcon}
          label="Glossario"
          collapsed={collapsed}
          isActive={activeId === 'glossario'}
          onClick={() => setActiveId('glossario')}
        />

        <SidebarSection label="Dashboard" collapsed={collapsed} />
        <Box as="div" id={groupTargetId}>
          {collapsed && (
            <Tooltip
              color="dark"
              isOpen={groupTooltipOpen}
              toggle={() => setGroupTooltipOpen((open) => !open)}
              placement="right"
              target={groupTargetId}
              title="Patrimonio verde"
            />
          )}
          <DxcSidebarGroupItem IconGroup={icons.TreeIcon} labelGroup="Patrimonio verde">
            <DxcSidebarItem
              Icon={icons.PlaceholderIcon}
              label="Patrimonio arboreo"
              isActive={activeId === 'patrimonio-arboreo'}
              onClick={() => setActiveId('patrimonio-arboreo')}
            />
            <DxcSidebarItem
              Icon={icons.PlaceholderIcon}
              label="Aree Gestite"
              isActive={activeId === 'aree-gestite-dash'}
              onClick={() => setActiveId('aree-gestite-dash')}
            />
            <DxcSidebarItem
              Icon={icons.PlaceholderIcon}
              label="Destinazione d'uso"
              isActive={activeId === 'destinazione-uso'}
              onClick={() => setActiveId('destinazione-uso')}
            />
            <DxcSidebarItem
              Icon={icons.PlaceholderIcon}
              label="Indice di densità"
              isActive={activeId === 'indice-densita'}
              onClick={() => setActiveId('indice-densita')}
            />
            <DxcSidebarItem
              Icon={icons.PlaceholderIcon}
              label="Mappa della densità"
              isActive={activeId === 'mappa-densita'}
              onClick={() => setActiveId('mappa-densita')}
            />
          </DxcSidebarGroupItem>
        </Box>
        <MenuSidebarItem
          Icon={icons.HabitatBiotipiIcon}
          label="Biodiversità"
          collapsed={collapsed}
          isActive={activeId === 'biodiversita'}
          onClick={() => setActiveId('biodiversita')}
        />
        <MenuSidebarItem
          Icon={icons.ImpiantiAgricoliAcquacolturaIcon}
          label="Servizi ecosistemici"
          collapsed={collapsed}
          isActive={activeId === 'servizi-ecosistemici'}
          onClick={() => setActiveId('servizi-ecosistemici')}
        />
        <MenuSidebarItem
          Icon={icons.EdificiIcon}
          label="Governance"
          collapsed={collapsed}
          isActive={activeId === 'governance'}
          onClick={() => setActiveId('governance')}
        />
      </DxcSidebar>
    </Box>
  )
}
