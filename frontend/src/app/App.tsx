/**
 * Main app content: BaseLayout (sidebar + infoPanel + breadcrumb + main) e widget mappa.
 * Layout allineato a CU 1.5 con componenti dxc-webkit; collapse sidebar espande la main.
 */
import { useState } from 'react'
import { Router } from './router/router'
import { TerritoryMapWidget } from '@/widgets/territory-map-widget'
import { BaseLayout } from '@/widgets/layout/BaseLayout'
import { Sidebar } from '@/widgets/layout/sidebar/Sidebar'
import { Breadcrumb } from '@/widgets/layout/breadcrumb/Breadcrumb'
import { InfoPanelContent } from '@/widgets/layout/info-panel'

export default function App() {
  const [isSidebarCollapsed, setSidebarCollapsed] = useState(false)

  return (
    <Router>
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
    </Router>
  )
}
