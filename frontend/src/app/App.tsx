/**
 * Main app content: BaseLayout (sidebar, optional InfoPanel, breadcrumb, map).
 */
import { ToastContainer } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'
import { Router } from './router/router'
import { GreenTablePanelProvider } from '@/features/territory/context/GreenTablePanelContext'
import { CadastreLayout } from './CadastreLayout'

export default function App() {
  return (
    <Router>
      <GreenTablePanelProvider>
        <CadastreLayout />
        <ToastContainer position="top-right" autoClose={3000} />
      </GreenTablePanelProvider>
    </Router>
  )
}
