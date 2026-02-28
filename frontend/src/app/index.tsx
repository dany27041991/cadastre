/**
 * App root: providers + router + main content.
 */
import { Providers } from './providers'
import App from './App'

export default function AppRoot() {
  return (
    <Providers>
      <App />
    </Providers>
  )
}
