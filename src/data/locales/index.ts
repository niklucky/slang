export type SystemLocale = 'en' | 'ru'

import en from './en'
import ru from './ru'

const translations: Record<SystemLocale, Record<string, string>> = {
  en,
  ru
}

export default translations