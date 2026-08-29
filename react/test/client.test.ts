import { describe, expect, it, vi } from 'vitest';

import {
  SlangAbortError,
  SlangHttpError,
  createClient,
  unwrapDictionary,
  unwrapResources,
} from '../src/client.js';

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

function stubFetch(handler: (url: string, init: RequestInit) => Response | Promise<Response>) {
  return vi.fn((input: RequestInfo | URL, init?: RequestInit) =>
    Promise.resolve(handler(String(input), init ?? {})),
  ) as unknown as typeof fetch;
}

/** `mock.calls[n]` is `T | undefined` under noUncheckedIndexedAccess. */
function callArgs(fetchImpl: typeof fetch, index = 0): [string, RequestInit] {
  const call = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[index];
  if (!call) throw new Error(`fetch was not called ${index + 1} time(s)`);
  return [String(call[0]), (call[1] ?? {}) as RequestInit];
}

describe('unwrapDictionary', () => {
  it('unwraps the locale-namespaced shape the API returns', () => {
    expect(unwrapDictionary({ en: { hello: 'Hello' } }, 'en')).toEqual({ hello: 'Hello' });
  });

  it('accepts an already-flat body, as written by the CLI', () => {
    expect(unwrapDictionary({ hello: 'Hello' }, 'en')).toEqual({ hello: 'Hello' });
  });

  it('drops non-string values', () => {
    expect(unwrapDictionary({ en: { ok: 'yes', bad: null, nested: { a: 'b' } } }, 'en')).toEqual({
      ok: 'yes',
    });
  });

  it('survives nonsense bodies', () => {
    expect(unwrapDictionary(null, 'en')).toEqual({});
    expect(unwrapDictionary('string', 'en')).toEqual({});
  });
});

describe('unwrapResources', () => {
  it('keeps every locale', () => {
    expect(unwrapResources({ en: { a: '1' }, ru: { a: '2' }, junk: 'no' })).toEqual({
      en: { a: '1' },
      ru: { a: '2' },
    });
  });
});

describe('createClient', () => {
  it('sends x-api-key only when a key is configured', async () => {
    const withKey = stubFetch(() => jsonResponse({ en: {} }));
    await createClient({ fetchImpl: withKey, apiKey: 'secret' }).fetchDictionary('en');
    expect(callArgs(withKey)[1].headers).toMatchObject({ 'x-api-key': 'secret' });

    const withoutKey = stubFetch(() => jsonResponse({ en: {} }));
    await createClient({ fetchImpl: withoutKey }).fetchDictionary('en');
    expect(callArgs(withoutKey)[1].headers).not.toHaveProperty('x-api-key');
  });

  it('builds the documented URLs and strips a trailing slash from apiUrl', async () => {
    const fetchImpl = stubFetch(() => jsonResponse({ data: '2026-01-01T00:00:00.000Z' }));
    await createClient({ apiUrl: 'https://example.test/slang/', fetchImpl }).fetchState('en');
    expect(callArgs(fetchImpl)[0]).toBe(
      'https://example.test/slang/api/translations/state?locale=en',
    );

    const dict = stubFetch(() => jsonResponse({ en: {} }));
    await createClient({ apiUrl: 'https://example.test/slang', fetchImpl: dict }).fetchDictionary(
      'en',
    );
    expect(callArgs(dict)[0]).toBe(
      'https://example.test/slang/api/translations?locale=en&format=i18next',
    );
  });

  it('reads the timestamp out of the { data } envelope', async () => {
    const client = createClient({
      fetchImpl: stubFetch(() => jsonResponse({ data: '2026-01-01T00:00:00.000Z' })),
    });
    expect(await client.fetchState('en')).toBe('2026-01-01T00:00:00.000Z');
  });

  it('returns null when the envelope carries no date', async () => {
    const client = createClient({
      fetchImpl: stubFetch(() => jsonResponse({ data: null, error: { message: 'auth_error' } })),
    });
    expect(await client.fetchState('en')).toBeNull();
  });

  // The live /state endpoint answers 404 on an auth failure, so callers must be
  // able to tell "could not check" apart from a real answer.
  it('throws SlangHttpError on a non-2xx, including the 404 /state returns on auth failure', async () => {
    const client = createClient({
      fetchImpl: stubFetch(() => jsonResponse({ data: null }, 404)),
    });
    await expect(client.fetchState('en')).rejects.toBeInstanceOf(SlangHttpError);
    await expect(client.fetchState('en')).rejects.toMatchObject({ status: 404 });
  });

  it('aborts a slow request once fetchTimeoutMs elapses', async () => {
    vi.useFakeTimers();
    try {
      const fetchImpl = vi.fn(
        (_input: RequestInfo | URL, init?: RequestInit) =>
          new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
          }),
      ) as unknown as typeof fetch;

      const client = createClient({ fetchImpl, fetchTimeoutMs: 50 });
      const pending = client.fetchDictionary('en');
      const assertion = expect(pending).rejects.toThrow('aborted');
      await vi.advanceTimersByTimeAsync(60);
      await assertion;
    } finally {
      vi.useRealTimers();
    }
  });

  it('shares one in-flight request between concurrent callers', async () => {
    const fetchImpl = stubFetch(() => jsonResponse({ en: { hello: 'Hello' } }));
    const client = createClient({ fetchImpl });
    const [a, b] = await Promise.all([client.fetchDictionary('en'), client.fetchDictionary('en')]);
    expect(a).toEqual(b);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('does not share between different locales', async () => {
    const fetchImpl = stubFetch((url) =>
      jsonResponse(url.includes('locale=ru') ? { ru: { a: 'Р' } } : { en: { a: 'E' } }),
    );
    const client = createClient({ fetchImpl });
    const [en, ru] = await Promise.all([client.fetchDictionary('en'), client.fetchDictionary('ru')]);
    expect(en).toEqual({ a: 'E' });
    expect(ru).toEqual({ a: 'Р' });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('starts a fresh request once the previous one has settled', async () => {
    const fetchImpl = stubFetch(() => jsonResponse({ en: {} }));
    const client = createClient({ fetchImpl });
    await client.fetchDictionary('en');
    await client.fetchDictionary('en');
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  // StrictMode unmounts and remounts: the first caller's abort must detach only
  // itself, leaving the shared request alive for the remount to join.
  it('lets one caller abort without cancelling the shared request', async () => {
    let release!: (response: Response) => void;
    const fetchImpl = vi.fn(
      () => new Promise<Response>((resolvePromise) => (release = resolvePromise)),
    ) as unknown as typeof fetch;
    const client = createClient({ fetchImpl });

    const first = new AbortController();
    const abandoned = client.fetchDictionary('en', { signal: first.signal });
    const rejection = expect(abandoned).rejects.toBeInstanceOf(SlangAbortError);
    first.abort();
    await rejection;

    const second = client.fetchDictionary('en', { signal: new AbortController().signal });
    release(jsonResponse({ en: { hello: 'Hello' } }));

    expect(await second).toEqual({ hello: 'Hello' });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('fetchAll asks for every locale at once', async () => {
    const fetchImpl = stubFetch(() => jsonResponse({ en: { a: '1' }, ru: { a: '2' } }));
    const client = createClient({ fetchImpl });
    expect(await client.fetchAll()).toEqual({ en: { a: '1' }, ru: { a: '2' } });
    expect(callArgs(fetchImpl)[0]).toContain('/api/translations?format=i18next');
  });

  it('pushLocale posts the dictionary to /api/translations/push', async () => {
    const fetchImpl = stubFetch(() => jsonResponse({ data: { keys: 2 }, error: null }));
    const client = createClient({ fetchImpl, apiKey: 'secret' });

    const result = await client.pushLocale('en', { hello: 'Hello', bye: 'Bye' });
    expect(result).toEqual({ keys: 2 });

    const [url, init] = callArgs(fetchImpl);
    expect(url).toContain('/api/translations/push');
    expect(init.method).toBe('POST');
    expect(init.headers).toMatchObject({
      'x-api-key': 'secret',
      'content-type': 'application/json',
    });
    expect(JSON.parse(String(init.body))).toEqual({
      locale: 'en',
      translations: { hello: 'Hello', bye: 'Bye' },
    });
  });

  it('pushLocale only includes namespace when given', async () => {
    const fetchImpl = stubFetch(() => jsonResponse({ data: { keys: 1 }, error: null }));
    const client = createClient({ fetchImpl });

    await client.pushLocale('en', { a: 'b' });
    expect(JSON.parse(String(callArgs(fetchImpl, 0)[1].body))).toEqual({
      locale: 'en',
      translations: { a: 'b' },
    });

    await client.pushLocale('en', { a: 'b' }, { namespace: 'common' });
    expect(JSON.parse(String(callArgs(fetchImpl, 1)[1].body))).toEqual({
      locale: 'en',
      translations: { a: 'b' },
      namespace: 'common',
    });
  });

  it('pushLocale surfaces non-2xx as SlangHttpError', async () => {
    const client = createClient({
      fetchImpl: stubFetch(() =>
        jsonResponse({ data: null, error: { message: 'locale_not_found' } }, 400),
      ),
    });
    await expect(client.pushLocale('xx', { a: 'b' })).rejects.toMatchObject({ status: 400 });
  });
});
