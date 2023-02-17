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
    "a_add_translation": 'Add translation',
    "a_create": 'Create',
    "a_add": 'Add',
    "createdAt": 'Created at',
    "key": 'Key',
    "namespaces": 'Namespaces',
    "translations": 'Translations',
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
    "a_add_translation": 'Добавить перевод',
    "a_create": 'Создать',
    "a_add": 'Добавить',
    "createdAt": 'Создано',
    "key": 'Ключ',
    "namespaces": 'Пространство',
    "translations": 'Переводы',
  },
  uk: {
    "h_dashboard": "Привiт!",
  }
}

export default translations