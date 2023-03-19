export type SystemLocale = 'en' | 'ru'

import en from './en'
import ru from './ru'

export const systemLocales: Record<SystemLocale, { flag: string, title: string }> = {
  ru: {
    flag: '🇷🇺',
    title: 'Русский'
  },
  en: {
    flag: '🇺🇸',
    title: 'English'
  }
}

const translations: Record<SystemLocale, Record<string, string>> = {
  en,
  ru
}

export default translations