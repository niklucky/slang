# @slang/react

React and React Native client for the [Slang](https://slang.hgdev.me) translation service.

**No runtime dependencies.** React is a peer. Works in the browser, in React Native and in
Node (the CLI), because it imports nothing platform-specific.

```bash
pnpm add @slang/react
```

## Quick start

```tsx
import { SlangProvider, useTranslation } from '@slang/react';
import en from './locales/en.json';
import ru from './locales/ru.json';

function App() {
  return (
    <SlangProvider locale="en" fallbackLocale="en" resources={{ en, ru }}>
      <Screen />
    </SlangProvider>
  );
}

function Screen() {
  const { t, locale, setLocale } = useTranslation();
  return (
    <>
      <h1>{t('welcome_title')}</h1>
      <p>{t('greeting', { name: 'Nikita' })}</p>
      <button onClick={() => setLocale(locale === 'en' ? 'ru' : 'en')}>{t('a_switch')}</button>
    </>
  );
}
```

`SlangProvider` **never blocks rendering.** Bundled `resources` are on screen from the first
paint; the cache and then the network top them up in the background.

### React Native

`AsyncStorage` already satisfies the `StorageAdapter` interface — pass it straight in.

```tsx
import AsyncStorage from '@react-native-async-storage/async-storage';

<SlangProvider locale={deviceLocale()} fallbackLocale="en" resources={{ en }} storage={AsyncStorage}>
```

## `t(key, vars?)`

| Call | Result |
| --- | --- |
| `t('hello')` | the string for `hello` in the active locale |
| `t('hello')` when the active locale lacks it | the string from `fallbackLocale` |
| `t('hello')` when nobody has it | `'hello'` — the key, so gaps are visible rather than blank |
| `t(null)` / `t(undefined)` / `t('')` | `''` |
| `t('greet', { name: 'Nikita' })` | `{{name}}` and `{{ name }}` replaced |
| `t('greet', {})` with no matching var | `{{name}}` left verbatim |

Translations are flat `key => string`. No namespaces, no nesting, no plurals.

## Configuration

| Option | Default | |
| --- | --- | --- |
| `locale` | — | Locale to start with. A locale previously chosen with `setLocale` wins over it. |
| `fallbackLocale` | — | Consulted when a key is missing. Also fetched, so it works unbundled. |
| `resources` | — | Bundled translations. Read once, at mount. |
| `apiUrl` | `https://slang.hgdev.me` | Point at your own proxy to keep the key server-side. |
| `apiKey` | — | Sent as `x-api-key`. Omit when a proxy adds it. |
| `checkForUpdate` | `true` | Poll `/state` and refresh in the background. `false` means zero network calls. |
| `storage` | `localStorage`, else none | `AsyncStorage` on RN; `null` to disable caching. |
| `storageKey` | `'slang'` | |
| `fetchTimeoutMs` | `3000` | |
| `maxCacheAgeMs` | 24h | Refetch this old a cache when the freshness check cannot be completed. |
| `onError` | `console.warn` | Every failure is swallowed and reported here. |

### Hiding the API key

Anything in a web bundle or an IPA is public. Proxy the two endpoints from your own server
and inject the key there, then point `apiUrl` at the proxy and leave `apiKey` unset:

```
GET  {apiUrl}/api/translations?locale=<locale>&format=i18next
GET  {apiUrl}/api/translations/state?locale=<locale>
```

## CLI

```bash
slang pull en ru --out ./src/locales     # one file per locale
slang pull --all --out ./src/locales     # every locale the project has
```

Reads `SLANG_API_URL` and `SLANG_API_KEY` from the environment; `--url` and `--key` override.
Writes flat, unwrapped, key-sorted JSON so the diff stays readable when one string changes.

## How refresh works

1. **Mount** — bundled `resources` render synchronously. With `localStorage` the cache is
   read synchronously too, so a returning user sees their saved locale on the first paint.
2. **Cache** — the persisted dictionary merges in.
3. **Freshness** — `GET /state` returns the locale's last-updated timestamp.
4. **Download** — only if the server's timestamp is newer than the cached one.

A failed freshness check is not treated as evidence of staleness. `/state` answers **404** on
an auth failure, and refetching whenever the check fails — which every hand-rolled client of
this API does — turns one unhealthy endpoint into a full dictionary download on every launch.
Instead the cache stands until it exceeds `maxCacheAgeMs`.

Concurrent callers share one in-flight request, and a caller walking away (unmount) detaches
only itself rather than cancelling the shared request. Without that, React 19 StrictMode's
unmount/remount cycle would abort the very request the remount is about to join.

## License

MIT
