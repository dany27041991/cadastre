/**
 * i18n config: Italian and English. Locales loaded at runtime from public/assets/i18n/ (en.json, it.json, …).
 * Import in main before React; wait for i18nReady before rendering.
 */
import i18n from 'i18next'
import HttpBackend from 'i18next-http-backend'
import { initReactI18next } from 'react-i18next'

export const defaultNS = 'translation'

export type Locale = 'it' | 'en'

/** Resolves when i18n and the default language are loaded. Use before first render to avoid key flash. */
export const i18nReady = i18n
  .use(HttpBackend)
  .use(initReactI18next)
  .init({
    backend: {
      loadPath: '/assets/i18n/{{lng}}.json',
    },
    lng: 'it',
    fallbackLng: 'en',
    defaultNS,
    interpolation: {
      escapeValue: false,
    },
  })

/** Change app language (e.g. for a language switcher). */
export const changeLanguage = i18n.changeLanguage.bind(i18n)
export default i18n
