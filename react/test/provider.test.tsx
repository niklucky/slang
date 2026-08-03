import { StrictMode } from 'react';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CACHE_VERSION } from '../src/cache.js';
import { useSlang } from '../src/hooks.js';
import { SlangProvider, type SlangProviderProps } from '../src/provider.js';
import type { StorageAdapter } from '../src/types.js';

const NEWER = '2026-02-01T00:00:00.000Z';

function memoryStorage(initial: Record<string, string> = {}): StorageAdapter & {
  data: Record<string, string>;
} {
  const data = { ...initial };
  return {
    data,
    getItem: (key) => data[key] ?? null,
    setItem: (key, value) => {
      data[key] = value;
    },
  };
}

function asyncMemoryStorage(initial: Record<string, string> = {}) {
  const inner = memoryStorage(initial);
  return {
    data: inner.data,
    getItem: async (key: string) => inner.getItem(key) as string | null,
    setItem: async (key: string, value: string) => {
      inner.setItem(key, value);
    },
  } satisfies StorageAdapter & { data: Record<string, string> };
}

/** Answers both endpoints from a dictionary, counting the calls to each. */
function serverStub(dictionaries: Record<string, Record<string, string>>, updatedAt = NEWER) {
  const calls = { state: 0, translations: 0 };
  const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    const locale = new URL(url, 'https://slang.test').searchParams.get('locale') ?? 'en';
    if (url.includes('/state')) {
      calls.state += 1;
      return { ok: true, status: 200, json: async () => ({ data: updatedAt }) } as Response;
    }
    calls.translations += 1;
    return {
      ok: true,
      status: 200,
      json: async () => ({ [locale]: dictionaries[locale] ?? {} }),
    } as Response;
  });
  return { calls, fetchImpl: fetchImpl as unknown as typeof fetch };
}

function Probe() {
  const { t, locale, setLocale, ready } = useSlang();
  return (
    <div>
      <span data-testid="hello">{t('hello')}</span>
      <span data-testid="greet">{t('greet', { name: 'Nikita' })}</span>
      <span data-testid="locale">{locale}</span>
      <span data-testid="ready">{String(ready)}</span>
      <button onClick={() => setLocale('ru')}>ru</button>
    </div>
  );
}

function renderProvider(props: Partial<SlangProviderProps> = {}, strict = false) {
  const tree = (
    <SlangProvider locale="en" storage={null} checkForUpdate={false} {...props}>
      <Probe />
    </SlangProvider>
  );
  return render(strict ? <StrictMode>{tree}</StrictMode> : tree);
}

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  // No `globals: true` in the vitest config, so testing-library's automatic
  // cleanup never registers — unmount by hand or the DOM accumulates.
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('SlangProvider', () => {
  it('renders bundled copy on the first paint, without waiting for anything', () => {
    renderProvider({ resources: { en: { hello: 'Hello' } } });
    expect(screen.getByTestId('hello').textContent).toBe('Hello');
    expect(screen.getByTestId('ready').textContent).toBe('true');
  });

  it('echoes the key when nothing is bundled and reports not ready', () => {
    renderProvider();
    expect(screen.getByTestId('hello').textContent).toBe('hello');
    expect(screen.getByTestId('ready').textContent).toBe('false');
  });

  it('interpolates', () => {
    renderProvider({ resources: { en: { greet: 'Hi, {{name}}' } } });
    expect(screen.getByTestId('greet').textContent).toBe('Hi, Nikita');
  });

  it('uses the fallback locale for keys the active locale lacks', () => {
    renderProvider({
      locale: 'ru',
      fallbackLocale: 'en',
      resources: { en: { hello: 'Hello' }, ru: {} },
    });
    expect(screen.getByTestId('hello').textContent).toBe('Hello');
  });

  it('makes no network calls at all when checkForUpdate is false', async () => {
    const { calls, fetchImpl } = serverStub({ en: { hello: 'Remote' } });
    vi.stubGlobal('fetch', fetchImpl);
    renderProvider({ resources: { en: { hello: 'Bundled' } }, checkForUpdate: false });
    await act(async () => {});
    expect(calls).toEqual({ state: 0, translations: 0 });
    expect(screen.getByTestId('hello').textContent).toBe('Bundled');
  });

  it('upgrades bundled copy with the server copy in the background', async () => {
    const { fetchImpl } = serverStub({ en: { hello: 'Remote' } });
    vi.stubGlobal('fetch', fetchImpl);
    renderProvider({ resources: { en: { hello: 'Bundled' } }, checkForUpdate: true });

    expect(screen.getByTestId('hello').textContent).toBe('Bundled');
    await waitFor(() => expect(screen.getByTestId('hello').textContent).toBe('Remote'));
  });

  it('keeps rendering bundled copy when the network fails', async () => {
    const onError = vi.fn();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('offline');
      }),
    );
    renderProvider({ resources: { en: { hello: 'Bundled' } }, checkForUpdate: true, onError });

    await waitFor(() => expect(onError).toHaveBeenCalled());
    expect(screen.getByTestId('hello').textContent).toBe('Bundled');
    expect(screen.getByTestId('ready').textContent).toBe('true');
  });

  it('persists what it fetched and serves it from cache on the next mount', async () => {
    const storage = memoryStorage();
    const first = serverStub({ en: { hello: 'Remote' } });
    vi.stubGlobal('fetch', first.fetchImpl);

    const view = renderProvider({ storage, checkForUpdate: true });
    await waitFor(() => expect(screen.getByTestId('hello').textContent).toBe('Remote'));
    view.unmount();

    // Same timestamp from /state means the cached copy is current: no download.
    const second = serverStub({ en: { hello: 'Remote' } });
    vi.stubGlobal('fetch', second.fetchImpl);
    renderProvider({ storage, checkForUpdate: true });

    // Synchronous storage means the cache is on screen from the first paint.
    expect(screen.getByTestId('hello').textContent).toBe('Remote');
    await waitFor(() => expect(second.calls.state).toBe(1));
    expect(second.calls.translations).toBe(0);
  });

  it('refetches when the server reports a newer timestamp', async () => {
    const storage = memoryStorage();
    const stale = serverStub({ en: { hello: 'Old' } }, '2026-01-01T00:00:00.000Z');
    vi.stubGlobal('fetch', stale.fetchImpl);
    const view = renderProvider({ storage, checkForUpdate: true });
    await waitFor(() => expect(screen.getByTestId('hello').textContent).toBe('Old'));
    view.unmount();

    const fresh = serverStub({ en: { hello: 'New' } }, '2026-03-01T00:00:00.000Z');
    vi.stubGlobal('fetch', fresh.fetchImpl);
    renderProvider({ storage, checkForUpdate: true });
    await waitFor(() => expect(screen.getByTestId('hello').textContent).toBe('New'));
    expect(fresh.calls.translations).toBe(1);
  });

  it('loads the cache a tick later with an async storage', async () => {
    const cached = JSON.stringify({
      version: CACHE_VERSION,
      locales: {
        en: {
          locale: 'en',
          translation: { hello: 'Cached' },
          updatedAt: NEWER,
          fetchedAt: new Date().toISOString(),
        },
      },
    });
    const storage = asyncMemoryStorage({ slang: cached });
    renderProvider({ storage, checkForUpdate: false });

    expect(screen.getByTestId('hello').textContent).toBe('hello');
    await waitFor(() => expect(screen.getByTestId('hello').textContent).toBe('Cached'));
  });

  it('switches locale instantly for a bundled locale and persists the choice', async () => {
    const storage = memoryStorage();
    renderProvider({
      storage,
      resources: { en: { hello: 'Hello' }, ru: { hello: 'Привет' } },
      checkForUpdate: false,
    });

    await act(async () => {
      screen.getByRole('button', { name: 'ru' }).click();
    });

    expect(screen.getByTestId('locale').textContent).toBe('ru');
    expect(screen.getByTestId('hello').textContent).toBe('Привет');
    await waitFor(() => expect(JSON.parse(storage.data['slang'] ?? '{}').locale).toBe('ru'));
  });

  it('restores a persisted locale on the next mount', () => {
    const storage = memoryStorage({
      slang: JSON.stringify({ version: CACHE_VERSION, locale: 'ru', locales: {} }),
    });
    renderProvider({
      storage,
      resources: { en: { hello: 'Hello' }, ru: { hello: 'Привет' } },
      checkForUpdate: false,
    });
    expect(screen.getByTestId('locale').textContent).toBe('ru');
    expect(screen.getByTestId('hello').textContent).toBe('Привет');
  });

  it('fetches the fallback locale too, so it works unbundled', async () => {
    const { fetchImpl } = serverStub({ ru: {}, en: { hello: 'Hello' } });
    vi.stubGlobal('fetch', fetchImpl);
    renderProvider({ locale: 'ru', fallbackLocale: 'en', checkForUpdate: true });
    await waitFor(() => expect(screen.getByTestId('hello').textContent).toBe('Hello'));
  });

  it('issues one request per endpoint under StrictMode', async () => {
    const { calls, fetchImpl } = serverStub({ en: { hello: 'Remote' } });
    vi.stubGlobal('fetch', fetchImpl);
    renderProvider({ checkForUpdate: true }, true);

    await waitFor(() => expect(screen.getByTestId('hello').textContent).toBe('Remote'));
    expect(calls).toEqual({ state: 1, translations: 1 });
  });

  it('throws a useful error when the hook is used outside the provider', () => {
    expect(() => render(<Probe />)).toThrow(/must be used within a SlangProvider/);
  });
});
