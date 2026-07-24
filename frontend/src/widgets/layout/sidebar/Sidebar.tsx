/**
 * dxc-webkit sidebar: header (logo + label) and map navigation entry.
 * Width is controlled by the layout (collapse narrows sidebar column, widens main).
 */
import {
  Sidebar as DxcSidebar,
  SidebarItem as DxcSidebarItem,
  icons,
} from 'dxc-webkit'

const SIDEBAR_HEADER_LOGO = { img: '/logo-mase.png', alt: 'MASE' }

export interface SidebarProps {
  collapsed?: boolean
  toggleCollapse?: () => void
}

export function Sidebar({ collapsed = false, toggleCollapse = () => {} }: SidebarProps) {
  return (
    <div style={{ width: '100%', height: '100%' }}>
      <DxcSidebar
        variant="light"
        collapsed={collapsed}
        toggleCollapse={toggleCollapse}
        headerConfig={{
          label: 'SIV',
          logoConfig1: SIDEBAR_HEADER_LOGO,
          toggleCollapse,
          color: 'primary',
        }}
        hideFooter
        style={{ height: '100%' }}
      >
        <DxcSidebarItem Icon={icons.MapIcon} label="Mappa" isActive onClick={() => {}} />
      </DxcSidebar>
    </div>
  )
}
