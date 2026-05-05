import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import ar from '../locales/ar.json'
import en from '../locales/en.json'

const STORAGE_KEY = 'app:lang'

const initialLang = (typeof window !== 'undefined' && localStorage.getItem(STORAGE_KEY)) || 'ar'

void i18n.use(initReactI18next).init({
  resources: {
    ar: { translation: ar },
    en: { translation: en }
  },
  lng: initialLang,
  fallbackLng: 'ar',
  interpolation: {
    escapeValue: false
  }
})

function applyDirection(lang: string): void {
  const dir = lang === 'ar' ? 'rtl' : 'ltr'
  document.documentElement.lang = lang
  document.documentElement.dir = dir
}

applyDirection(initialLang)

export function setLanguage(lang: 'ar' | 'en'): void {
  void i18n.changeLanguage(lang)
  localStorage.setItem(STORAGE_KEY, lang)
  applyDirection(lang)
}

export default i18n
