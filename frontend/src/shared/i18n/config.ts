/**
 * i18n: IT / EN bundled with the app so translations work in single-spa (host /assets/i18n
 * would otherwise override and miss keys like territory.panel.*).
 * Edit strings in ./locales/it.json and en.json.
 */
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from './locales/en.json'
import it from './locales/it.json'

export const defaultNS = 'translation'

export type Locale = 'it' | 'en'

/** Resolves when i18n is ready. */
export const i18nReady = i18n.use(initReactI18next).init({
  lng: 'it',
  fallbackLng: 'en',
  defaultNS,
  resources: {
    it: { translation: it },
    en: { translation: en },
  },
  interpolation: {
    escapeValue: false,
  },
})

/** Change app language (e.g. for a language switcher). */
export const changeLanguage = i18n.changeLanguage.bind(i18n)
export default i18n
