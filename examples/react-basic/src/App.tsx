import { SlangProvider, useTranslation } from '@warpunit/slang-react';

import en from './locales/en.json';
import ru from './locales/ru.json';

function Screen() {
  const { t, locale, setLocale, ready, refresh } = useTranslation();

  return (
    <main className="page">
      <h1>{t('app_title')}</h1>
      <p>{t('intro')}</p>

      <p className="welcome">{t('welcome', { name: 'Nikita' })}</p>

      {/* This key exists only in en.json, so the Russian UI falls back to it. */}
      <p className="fallback">{t('fallback_demo')}</p>

      <p>
        {t('locale_label')}: <code>{locale}</code> · {ready ? t('ready_yes') : '…'}
      </p>

      <div className="controls">
        <button onClick={() => setLocale('en')} disabled={locale === 'en'}>
          English
        </button>
        <button onClick={() => setLocale('ru')} disabled={locale === 'ru'}>
          Русский
        </button>
        <button onClick={() => void refresh()}>{t('refresh')}</button>
      </div>
    </main>
  );
}

const envApiUrl = import.meta.env.VITE_SLANG_API_URL as string | undefined;
const apiKey = import.meta.env.VITE_SLANG_API_KEY as string | undefined;

// Same-origin by default so Vite's /api proxy forwards to the local slang
// server without CORS. Point VITE_SLANG_API_URL elsewhere to override.
const apiUrl = envApiUrl ?? window.location.origin;

export function App() {
  return (
    <SlangProvider
      locale="en"
      fallbackLocale="en"
      resources={{ en, ru }}
      apiUrl={apiUrl}
      {...(apiKey ? { apiKey } : {})}
      // Without a key there is nothing to fetch; skip the network entirely.
      checkForUpdate={Boolean(apiKey)}
    >
      <Screen />
    </SlangProvider>
  );
}
