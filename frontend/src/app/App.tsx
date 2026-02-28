/**
 * Main app content: router outlet / default view.
 */
import { Router } from './router/router'
import { TerritoryMapWidget } from '@/widgets/territory-map-widget'

export default function App() {
  return (
    <Router>
      <TerritoryMapWidget />
    </Router>
  )
}
