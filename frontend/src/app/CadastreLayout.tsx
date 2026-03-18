/**
 * Layout: InfoPanel only when the map table accordion is open (green areas / sub-areas).
 */
import { useState } from 'react'
import { BaseLayout } from '@/widgets/layout/BaseLayout'
import { Sidebar } from '@/widgets/layout/sidebar/Sidebar'
import { Breadcrumb } from '@/widgets/layout/breadcrumb/Breadcrumb'
import { InfoPanelContent } from '@/widgets/layout/info-panel'
import { TerritoryMapWidget } from '@/widgets/territory-map-widget'
import { useGreenTablePanel } from '@/features/territory/context/GreenTablePanelContext'

export function CadastreLayout() {
  const [isSidebarCollapsed, setSidebarCollapsed] = useState(false)
  const { mapTableAccordionVisible } = useGreenTablePanel()

  return (
    <BaseLayout
      isSidebarCollapsed={isSidebarCollapsed}
      sidebar={
        <Sidebar
          collapsed={isSidebarCollapsed}
          toggleCollapse={() => setSidebarCollapsed((c) => !c)}
        />
      }
      infoPanel={mapTableAccordionVisible ? <InfoPanelContent /> : undefined}
      breadcrumb={<Breadcrumb />}
    >
      <TerritoryMapWidget />
    </BaseLayout>
  )
}
