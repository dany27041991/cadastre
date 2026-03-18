/**
 * Main app content: BaseLayout (sidebar, optional InfoPanel, breadcrumb, map).
 */
import { Router } from './router/router'
import { GreenTablePanelProvider } from '@/features/territory/context/GreenTablePanelContext'
import { CadastreLayout } from './CadastreLayout'

export default function App() {
  return (
    <Router>
      <GreenTablePanelProvider>
        <CadastreLayout />
      </GreenTablePanelProvider>
    </Router>
  )
}
