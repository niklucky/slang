import { describe, expect, it } from 'vitest';

import {
  CACHE_VERSION,
  DEFAULT_MAX_CACHE_AGE_MS,
  parseCache,
  readCache,
  shouldRefetch,
  writeCache,
} from '../src/cache.js';
import type { CachedLocale, StorageAdapter } from '../src/types.js';

function syncStorage(initial: Record<string, string> = {}): StorageAdapter & {
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

function asyncStorage(initial: Record<string, string> = {}): StorageAdapter {
  const inner = syncStorage(initial);
  return {
    getItem: async (key) => inner.getItem(key) as string | null,
    setItem: async (key, value) => {
      inner.setItem(key, value);
    },
  };
}

const entry = (over: Partial<CachedLocale> = {}): CachedLocale => ({
  locale: 'en',
  translation: { hello: 'Hello' },
  updatedAt: '2026-01-01T00:00:00.000Z',
  fetchedAt: '2026-01-01T00:00:00.000Z',
  ...over,
});

describe('parseCache', () => {
  it('returns an empty cache for null, garbage and non-objects', () => {
    for (const raw of [null, 'not json', '[]', 'null', '42']) {
      expect(parseCache(raw as string | null).locales).toEqual({});
    }
  });

  it('discards a cache written by a different version', () => {
    const raw = JSON.stringify({ version: CACHE_VERSION + 1, locales: { en: entry() } });
    expect(parseCache(raw).locales).toEqual({});
  });

  it('round-trips a well-formed cache', () => {
    const raw = JSON.stringify({ version: CACHE_VERSION, locale: 'ru', locales: { en: entry() } });
    const parsed = parseCache(raw);
    expect(parsed.locale).toBe('ru');
    expect(parsed.locales['en']?.translation).toEqual({ hello: 'Hello' });
  });

  it('drops non-string translation values', () => {
    const raw = JSON.stringify({
      version: CACHE_VERSION,
      locales: { en: { ...entry(), translation: { ok: 'yes', bad: null, n: 3 } } },
    });
    expect(parseCache(raw).locales['en']?.translation).toEqual({ ok: 'yes' });
  });

  it('defaults a missing fetchedAt to the epoch, so the entry reads as stale', () => {
    const raw = JSON.stringify({
      version: CACHE_VERSION,
      locales: { en: { locale: 'en', translation: {} } },
    });
    const parsed = parseCache(raw).locales['en'];
    expect(parsed?.fetchedAt).toBe(new Date(0).toISOString());
    expect(shouldRefetch(parsed, null, DEFAULT_MAX_CACHE_AGE_MS)).toBe(true);
  });
});

describe('readCache / writeCache', () => {
  it('round-trips through a synchronous storage', async () => {
    const storage = syncStorage();
    await writeCache(storage, 'slang', { version: CACHE_VERSION, locales: { en: entry() } });
    expect((await readCache(storage, 'slang')).locales['en']?.translation).toEqual({
      hello: 'Hello',
    });
  });

  it('round-trips through a promise-returning storage', async () => {
    const storage = asyncStorage();
    await writeCache(storage, 'slang', { version: CACHE_VERSION, locales: { en: entry() } });
    expect((await readCache(storage, 'slang')).locales['en']?.translation).toEqual({
      hello: 'Hello',
    });
  });

  it('is a no-op without a storage', async () => {
    await writeCache(null, 'slang', { version: CACHE_VERSION, locales: {} });
    expect((await readCache(null, 'slang')).locales).toEqual({});
  });
});

describe('shouldRefetch', () => {
  const day = DEFAULT_MAX_CACHE_AGE_MS;
  const now = Date.parse('2026-01-02T00:00:00.000Z');

  it('fetches when nothing is cached', () => {
    expect(shouldRefetch(undefined, null, day, now)).toBe(true);
  });

  it('fetches when the server copy is newer', () => {
    expect(shouldRefetch(entry(), '2026-01-01T00:00:01.000Z', day, now)).toBe(true);
  });

  it('skips when the server copy is not newer', () => {
    expect(shouldRefetch(entry(), '2026-01-01T00:00:00.000Z', day, now)).toBe(false);
    expect(shouldRefetch(entry(), '2025-12-31T00:00:00.000Z', day, now)).toBe(false);
  });

  it('fetches when the server has a timestamp and the cache does not', () => {
    const noStamp = entry();
    delete noStamp.updatedAt;
    expect(shouldRefetch(noStamp, '2026-01-01T00:00:00.000Z', day, now)).toBe(true);
  });

  // The whole point of the maxCacheAge escape hatch: a failed freshness check
  // must not turn into a full download on every launch.
  it('keeps a fresh cache when the freshness check could not be completed', () => {
    const fresh = entry({ fetchedAt: '2026-01-01T23:00:00.000Z' });
    expect(shouldRefetch(fresh, null, day, now)).toBe(false);
  });

  it('refetches an unchecked cache once it exceeds maxCacheAgeMs', () => {
    const old = entry({ fetchedAt: '2025-12-30T00:00:00.000Z' });
    expect(shouldRefetch(old, null, day, now)).toBe(true);
  });

  it('refetches when a timestamp is unparsable', () => {
    expect(shouldRefetch(entry({ updatedAt: 'nonsense' }), '2026-01-01T00:00:00.000Z', day, now)).toBe(
      true,
    );
    expect(shouldRefetch(entry({ fetchedAt: 'nonsense' }), null, day, now)).toBe(true);
  });
});
