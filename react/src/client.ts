import type { Dictionary, Resources } from './types.js';

export const DEFAULT_API_URL = 'https://slang.hgdev.me';
export const DEFAULT_TIMEOUT_MS = 3000;

export interface ClientOptions {
  apiUrl?: string;
  apiKey?: string;
  fetchTimeoutMs?: number;
  /** Injectable for tests; defaults to the global `fetch`. */
  fetchImpl?: typeof fetch;
}

export interface RequestOptions {
  /** Caller's cancellation (component unmount, locale switched again). */
  signal?: AbortSignal;
}

/** Thrown for any non-2xx response so callers can see the status. */
export class SlangHttpError extends Error {
  constructor(
    readonly status: number,
    readonly url: string,
  ) {
    super(`Slang request failed: ${status} ${url}`);
    this.name = 'SlangHttpError';
  }
}

export class SlangAbortError extends Error {
  constructor() {
    super('Slang request aborted');
    this.name = 'SlangAbortError';
  }
}

/**
 * Rejects when the caller's signal aborts, so a caller can walk away from a
 * shared request without cancelling it for everyone else.
 */
function rejectOnAbort(signal: AbortSignal): { promise: Promise<never>; cleanup: () => void } {
  let onAbort!: () => void;
  const promise = new Promise<never>((_resolve, reject) => {
    onAbort = () => reject(new SlangAbortError());
    if (signal.aborted) onAbort();
    else signal.addEventListener('abort', onAbort, { once: true });
  });
  return { promise, cleanup: () => signal.removeEventListener('abort', onAbort) };
}

/** Keeps only string values; the server has been known to emit nulls. */
export function normalizeDictionary(value: unknown): Dictionary {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const out: Dictionary = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (typeof entry === 'string') out[key] = entry;
  }
  return out;
}

/**
 * `/api/translations?locale=en` answers `{ "en": { ... } }`, but the same
 * payload gets saved to disk unwrapped by some tooling. Accept both so a
 * locale file written either way still loads.
 */
export function unwrapDictionary(body: unknown, locale: string): Dictionary {
  if (!body || typeof body !== 'object') return {};
  const nested = (body as Record<string, unknown>)[locale];
  if (nested && typeof nested === 'object') return normalizeDictionary(nested);
  return normalizeDictionary(body);
}

/** Omitting `locale` makes the API return every locale at once. */
export function unwrapResources(body: unknown): Resources {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return {};
  const out: Resources = {};
  for (const [locale, entry] of Object.entries(body as Record<string, unknown>)) {
    if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
      out[locale] = normalizeDictionary(entry);
    }
  }
  return out;
}

export interface SlangClient {
  /**
   * Last-updated timestamp for a locale, ISO-8601, or `null` when the server
   * declines to say.
   *
   * Note that `/api/translations/state` answers **404** on an auth failure, so
   * a 404 here means "could not check", never "no such locale".
   */
  fetchState(locale: string, options?: RequestOptions): Promise<string | null>;
  /** The dictionary for one locale. */
  fetchDictionary(locale: string, options?: RequestOptions): Promise<Dictionary>;
  /** Every locale the project has. Used by the CLI's `--all`. */
  fetchAll(options?: RequestOptions): Promise<Resources>;
}

export function createClient(options: ClientOptions = {}): SlangClient {
  const {
    apiUrl = DEFAULT_API_URL,
    apiKey,
    fetchTimeoutMs = DEFAULT_TIMEOUT_MS,
    fetchImpl = globalThis.fetch,
  } = options;

  const base = apiUrl.replace(/\/+$/, '');
  // Concurrent callers asking for the same thing share one request. React 19's
  // StrictMode double-invokes effects, so without this every mount fetches twice.
  const inFlight = new Map<string, Promise<unknown>>();

  async function request(path: string): Promise<unknown> {
    const url = `${base}${path}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(new Error('timeout')), fetchTimeoutMs);
    try {
      const response = await fetchImpl(url, {
        method: 'GET',
        headers: {
          accept: 'application/json',
          ...(apiKey ? { 'x-api-key': apiKey } : {}),
        },
        signal: controller.signal,
      });
      if (!response.ok) throw new SlangHttpError(response.status, url);
      return await response.json();
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Shares one request between concurrent callers.
   *
   * A caller's `signal` detaches *that caller* from the result; it never
   * aborts the underlying request. Cancelling the shared fetch would make
   * StrictMode's unmount/remount cycle abort the very request the remount is
   * about to join, so both attempts would fail.
   */
  function dedupe<T>(key: string, run: () => Promise<T>, signal?: AbortSignal): Promise<T> {
    let shared = inFlight.get(key) as Promise<T> | undefined;
    if (!shared) {
      shared = run().finally(() => inFlight.delete(key));
      inFlight.set(key, shared);
      // Keep a rejected shared promise from surfacing as an unhandled rejection
      // when every caller has already detached.
      shared.catch(() => {});
    }
    if (!signal) return shared;

    const abort = rejectOnAbort(signal);
    return Promise.race([shared, abort.promise]).finally(abort.cleanup);
  }

  return {
    fetchState(locale, requestOptions) {
      return dedupe(
        `state:${locale}`,
        async () => {
          const body = await request(
            `/api/translations/state?locale=${encodeURIComponent(locale)}`,
          );
          const data = (body as { data?: unknown } | null)?.data;
          return typeof data === 'string' && data.length > 0 ? data : null;
        },
        requestOptions?.signal,
      );
    },

    fetchDictionary(locale, requestOptions) {
      return dedupe(
        `dict:${locale}`,
        async () => {
          const body = await request(
            `/api/translations?locale=${encodeURIComponent(locale)}&format=i18next`,
          );
          return unwrapDictionary(body, locale);
        },
        requestOptions?.signal,
      );
    },

    fetchAll(requestOptions) {
      return dedupe(
        'dict:*',
        async () => unwrapResources(await request('/api/translations?format=i18next')),
        requestOptions?.signal,
      );
    },
  };
}
