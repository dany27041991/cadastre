/**
 * dxc-webkit sidebar: header (logo + label) and menu entries.
 * Width is controlled by the layout (collapse narrows sidebar column, widens main).
 * Workaround: in dxc-webkit only SidebarItem toggles group expand, not the arrow (.sidebar-arrow-icon);
 * forward arrow clicks to the first item so the row still expands.
 */
import { useEffect, useRef } from 'react'
import {
  Box,
  Sidebar as DxcSidebar,
  SidebarItem as DxcSidebarItem,
  SidebarGroupItem as DxcSidebarGroupItem,
  icons,
} from 'dxc-webkit'

const SIDEBAR_HEADER_LOGO = { img: '/logo-mase.png', alt: 'MASE' }

export interface SidebarProps {
  collapsed?: boolean
  toggleCollapse?: () => void
}

export function Sidebar({ collapsed = false, toggleCollapse = () => {} }: SidebarProps) {
  const wrapperRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const wrapper = wrapperRef.current
    if (!wrapper) return
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (target.closest?.('.sidebar-arrow-icon')) {
        const container = target.closest('.sidebar-group-first-item-container')
        const firstItem = container?.querySelector<HTMLElement>('.sidebar-group-first-item')
        if (firstItem) {
          e.preventDefault()
          e.stopPropagation()
          firstItem.click()
        }
      }
    }
    wrapper.addEventListener('click', handleClick, true)
    return () => wrapper.removeEventListener('click', handleClick, true)
  }, [])

  return (
    <div ref={wrapperRef} style={{ width: '100%', height: '100%' }}>
      <DxcSidebar
        variant="light"
        collapsed={collapsed}
        toggleCollapse={toggleCollapse}
        headerConfig={{
          label: 'SIV',
          logoConfig1: SIDEBAR_HEADER_LOGO,
          toggleCollapse,
          color: 'primary'
        }}
        hideFooter
        style={{ height: '100%' }}
      >
        <DxcSidebarItem Icon={icons.MapIcon} label="Label" onClick={() => {}} />
        <DxcSidebarItem Icon={icons.HomeIcon} label="Label" onClick={() => {}} />
        <DxcSidebarItem Icon={icons.SettingsIcon} label="Label" onClick={() => {}} />
        <DxcSidebarGroupItem IconGroup={icons.FolderIcon} labelGroup="Label text">
          <DxcSidebarItem Icon={icons.MapIcon} label="Colors" onClick={() => {}} />
          <DxcSidebarItem Icon={icons.MapIcon} label="Colors" onClick={() => {}} />
        </DxcSidebarGroupItem>
        <Box as="div" padding="xs" color="primary">
          Title
        </Box>
        <DxcSidebarGroupItem IconGroup={icons.FolderIcon} labelGroup="Label text">
          <DxcSidebarItem Icon={icons.MapIcon} label="Colors" onClick={() => {}} />
          <DxcSidebarItem Icon={icons.MapIcon} label="Colors" onClick={() => {}} />
          <DxcSidebarItem Icon={icons.MapIcon} label="Colors" onClick={() => {}} />
          <DxcSidebarItem Icon={icons.MapIcon} label="Colors" onClick={() => {}} />
        </DxcSidebarGroupItem>
        <DxcSidebarItem Icon={icons.InfoCircleIcon} label="Label" onClick={() => {}} />
      </DxcSidebar>
    </div>
  )
}
