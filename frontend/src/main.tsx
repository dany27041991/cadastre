import ReactDOM from 'react-dom/client'
import App from './app'
import '@/shared/styles/globals.css'
import { i18nReady } from '@/shared/i18n'
import { initMockAuth } from '@/app/auth/mockAuth'
import { initGeoinsightModule } from '@/vendor/mase-commons-geoinsight'

initMockAuth()

Promise.all([i18nReady, initGeoinsightModule()]).then(() => {
  ReactDOM.createRoot(document.getElementById('root')!).render(<App />)
})
