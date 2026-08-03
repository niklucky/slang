import type { CachedLocale, CacheShape, StorageAdapter } from './types.js';
import { normalizeDictionary } from './client.js';

export const DEFAULT_STORAGE_KEY = 'slang';
export const DEFAULT_MAX_CACHE_AGE_MS = 24 * 60 * 60 * 1000;

/** Bump to invalidate every client's cache after a layout change. */
export const CACHE_VERSION = 1;

const EMPTY: CacheShape = { version: CACHE_VERSION, locales: {} };

/**
 * `localStorage` where it exists, otherwise nothing. React Native has no
 * default — pass `AsyncStorage` explicitly, it already fits `StorageAdapter`.
 */
export function defaultStorage(): StorageAdapter | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    // Safari throws on access when cookies are blocked.
    return null;
  }
}

/**
 * Anything unparsable, wrong-shaped or written by an older version reads as an
 * empty cache. A corrupt cache must never be able to break startup — the
 * bundled locale is always there to fall back on.
 */
export function parseCache(raw: string | null): CacheShape {
  if (!raw) return { ...EMPTY, locales: {} };
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return { ...EMPTY, locales: {} };
    const candidate = parsed as Partial<CacheShape>;
    if (candidate.version !== CACHE_VERSION) return { ...EMPTY, locales: {} };

    const locales: Record<string, CachedLocale> = {};
    for (const [locale, entry] of Object.entries(candidate.locales ?? {})) {
      if (!entry || typeof entry !== 'object') continue;
      locales[locale] = {
        locale,
        translation: normalizeDictionary(entry.translation),
        ...(typeof entry.updatedAt === 'string' ? { updatedAt: entry.updatedAt } : {}),
        fetchedAt: typeof entry.fetchedAt === 'string' ? entry.fetchedAt : new Date(0).toISOString(),
      };
    }

    return {
      version: CACHE_VERSION,
      ...(typeof candidate.locale === 'string' ? { locale: candidate.locale } : {}),
      locales,
    };
  } catch {
    return { ...EMPTY, locales: {} };
  }
}

export async function readCache(
  storage: StorageAdapter | null,
  storageKey: string,
): Promise<CacheShape> {
  if (!storage) return { ...EMPTY, locales: {} };
  const raw = await storage.getItem(storageKey);
  return parseCache(raw);
}

export async function writeCache(
  storage: StorageAdapter | null,
  storageKey: string,
  cache: CacheShape,
): Promise<void> {
  if (!storage) return;
  await storage.setItem(storageKey, JSON.stringify(cache));
}

/**
 * Decides whether a cached locale needs re-downloading.
 *
 * `serverUpdatedAt` of `null` means the freshness check did not complete — the
 * request failed, timed out, or the endpoint returned its 404-on-auth-error.
 * That is not evidence of staleness, so the cache stands until it exceeds
 * `maxCacheAgeMs`. Refetching on every failed check, as the hand-rolled
 * clients do, re-downloads the whole dictionary on every launch for as long as
 * `/state` is unhealthy.
 */
export function shouldRefetch(
  cached: CachedLocale | undefined,
  serverUpdatedAt: string | null,
  maxCacheAgeMs: number,
  now: number = Date.now(),
): boolean {
  if (!cached) return true;

  if (serverUpdatedAt) {
    if (!cached.updatedAt) return true;
    const server = Date.parse(serverUpdatedAt);
    const local = Date.parse(cached.updatedAt);
    if (Number.isNaN(server) || Number.isNaN(local)) return true;
    return server > local;
  }

  const fetchedAt = Date.parse(cached.fetchedAt);
  if (Number.isNaN(fetchedAt)) return true;
  return now - fetchedAt > maxCacheAgeMs;
}
