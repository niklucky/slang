export type i18Locale = 'en' | 'ru' | 'uk'
const translations: Record<i18Locale, Record<string, string>> = {
  en: {
    "h_dashboard": "Hi! This is your dashboard",
  },
  ru: {
    "h_dashboard": "Привет!",
  },
  uk: {
    "h_dashboard": "Привiт!",
  }
}

export default translations