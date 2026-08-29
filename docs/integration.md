# Integrating Slang — guide for AI agents

You are integrating [Slang](https://slang.warpunit.com), a translation service, into this
project. This guide is written for AI coding agents: follow it top to bottom. It covers the
React SDK and the CLI. Full reference: the `@warpunit/slang-react` README.

## What you need from the user

- A Slang **project API key**, created in the Slang web UI. Ask for it; never invent one.
- Which locales the app ships. Default assumption: `en` as the fallback locale.

## 1. Install

```bash
npm install @warpunit/slang-react   # or pnpm add / yarn add
```

Zero runtime dependencies; React is a peer. Works in the browser, in React Native and in Node.

## 2. Locale files

Translations are flat `key => string` maps — no namespaces, no nesting, no plurals.
One file per locale, e.g. `src/locales/en.json`:

```json
{
  "welcome_title": "Welcome",
  "greeting": "Hello, {{name}}!"
}
```

If the project already keeps its translations on the server, pull them instead (step 6).

## 3. Provider

```tsx
import { SlangProvider } from '@warpunit/slang-react';
import en from './locales/en.json';
import ru from './locales/ru.json';

<SlangProvider locale="en" fallbackLocale="en" resources={{ en, ru }}>
  <App />
</SlangProvider>
```

The provider **never blocks rendering**: bundled resources are on screen from the first
paint; the cache and then the network top them up in the background.

| Prop | Default | Effect |
| --- | --- | --- |
| `apiUrl` | `https://slang.warpunit.com` | API origin; point at your own proxy to hide the key |
| `apiKey` | — | Sent as `x-api-key`; omit when the proxy injects it |
| `checkForUpdate` | `true` | Poll `/state` and refresh in the background; `false` means zero network calls |
| `storage` | `localStorage` if present | React Native: pass `AsyncStorage`; `null` disables caching |
| `storageKey` | `'slang'` | Cache key in the storage |
| `fetchTimeoutMs` | `3000` | |
| `maxCacheAgeMs` | 24h | Refetch a cache this old when the freshness check cannot be completed |
| `onError` | `console.warn` | Every failure is swallowed and reported here |

## 4. Translate

```tsx
import { useTranslation } from '@warpunit/slang-react';

const { t, locale, setLocale } = useTranslation();

t('welcome_title');                  // active locale's string
t('missing_key');                    // falls back to fallbackLocale, else echoes the key
t('greeting', { name: 'Nikita' });   // replaces {{name}}
```

`useTranslation` is an alias of `useSlang` (full context: `t`, `locale`, `setLocale`,
`ready`, `refresh`, `resources`); `useT()` returns just `t`. `setLocale('ru')` switches at
runtime and persists through the storage adapter.

## 5. Pick the startup locale

```ts
import { negotiateLocale } from '@warpunit/slang-react';

const SUPPORTED = ['en', 'ru', 'zh-Hans', 'es-ES', 'es-MX'] as const;
const locale = negotiateLocale(SUPPORTED, navigator.languages, 'en');
```

Always pass the **full** preference list (`navigator.languages`, not just its first entry).
In React Native, read the device locales and pass them the same way.

## 6. Sync with the server (CLI)

The `slang` CLI ships with the package. It reads `SLANG_API_URL` and `SLANG_API_KEY` from
the environment; `--url` / `--key` override.

```bash
npx slang push --in ./src/locales          # upload every <locale>.json (first push)
npx slang pull --all --out ./src/locales   # download every locale the project has
```

`push` upserts: existing keys keep their other locales; empty values are skipped.
`pull` writes flat, key-sorted JSON so diffs stay readable. Commit pulled files like
source — they are the bundle fallback for offline and first paint.

## 7. Never ship the API key in a client bundle

Anything in a web bundle or an IPA is public. Proxy the two runtime endpoints from your own
backend, inject the key there, then point `apiUrl` at the proxy and leave `apiKey` unset:

```
GET {apiUrl}/api/translations?locale=<locale>&format=i18next
GET {apiUrl}/api/translations/state?locale=<locale>
```

The CLI runs at build/CI time, so `SLANG_API_KEY` in the CI environment is fine.

## Behavior you must not "fix"

- A missing key renders **the key itself**, not a blank — gaps are meant to be visible.
- A failed `/state` freshness check is not evidence of staleness: the cache stands until it
  exceeds `maxCacheAgeMs`. Do not add refetch-on-error.
- `t(null)` / `t(undefined)` / `t('')` return `''`.
- Interpolation leaves `{{name}}` verbatim when no matching variable is passed.

## Verify the integration

1. `npx slang push --in ./src/locales` (with the key configured) logs
   `Locale <code> pushed to server` for every locale.
2. The app renders bundled strings with the network disabled.
3. With `checkForUpdate` on, `/state` fires on mount and `/api/translations` only when the
   server copy is newer.
4. `setLocale` to another locale, reload — the choice persists.
