import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './app'
import '@/shared/styles/globals.css'
import { i18nReady } from '@/shared/i18n'

i18nReady.then(() => {
  ReactDOM.createRoot(document.getElementById('root')!).render(<App />)
})
