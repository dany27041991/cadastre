import ReactDOM from 'react-dom/client'
import App from './app'
import '@/shared/styles/globals.css'
import { i18nReady } from '@/shared/i18n'
import { initMockAuth } from '@/app/auth/mockAuth'
import { initGeoinsightModule } from '@/vendor/mase-commons-geoinsight'

initMockAuth()

async function bootstrap(): Promise<void> {
  await i18nReady
  try {
    await initGeoinsightModule()
  } catch (error) {
    console.error('[bootstrap] Geoinsight init failed — mounting app anyway', error)
  }
  ReactDOM.createRoot(document.getElementById('root')!).render(<App />)
}

void bootstrap()
