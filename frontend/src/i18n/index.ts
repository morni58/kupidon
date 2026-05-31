import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import ru from './ru'

// Stubs for en and uk
const en = { translation: {} }
const uk = { translation: {} }

i18n.use(initReactI18next).init({
  resources: { ru, en, uk },
  lng: (window as any).Telegram?.WebApp?.initDataUnsafe?.user?.language_code || 'ru',
  fallbackLng: 'ru',
  interpolation: { escapeValue: false },
})

export default i18n
