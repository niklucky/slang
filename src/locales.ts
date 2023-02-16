export type i18Locale = 'en' | 'ru' | 'uk'
const translations: Record<i18Locale, Record<string, string>> = {
  en: {
    "h_dashboard": "Hi! This is your dashboard",
    "a_create_project": 'Create project',
    "h_projects": 'Projects',
    "name": 'Name',
    "#": '#',
    "url": 'Project url',
    "keys_count": 'Keys count',
    "menu_projects": 'Projects',
    "menu_dashboard": 'Dasboard',
  },
  ru: {
    "h_dashboard": "Привет!",
    "a_create_project": 'Создать проект',
    "h_projects": 'Проекты',
    "name": 'Название',
    "#": '№',
    "url": 'Адрес проекта',
    "keys_count": 'Кол-во ключей',
    "menu_projects": 'Проекты',
    "menu_dashboard": 'Главная',
  },
  uk: {
    "h_dashboard": "Привiт!",
  }
}

export default translations