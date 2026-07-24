/**
 * Layout: InfoPanel is always visible on the map view.
 */
import { useState } from 'react'
import { BaseLayout } from '@/widgets/layout/BaseLayout'
import { Sidebar } from '@/widgets/layout/sidebar/Sidebar'
import { Breadcrumb } from '@/widgets/layout/breadcrumb/Breadcrumb'
import { InfoPanelContent } from '@/widgets/layout/info-panel'
import { TerritoryMapWidget } from '@/widgets/territory-map-widget'

export function CadastreLayout() {
  const [isSidebarCollapsed, setSidebarCollapsed] = useState(false)

  return (
    <BaseLayout
      isSidebarCollapsed={isSidebarCollapsed}
      sidebar={
        <Sidebar
          collapsed={isSidebarCollapsed}
          toggleCollapse={() => setSidebarCollapsed((c) => !c)}
        />
      }
      infoPanel={<InfoPanelContent />}
      breadcrumb={<Breadcrumb />}
    >
      <TerritoryMapWidget />
    </BaseLayout>
  )
}
