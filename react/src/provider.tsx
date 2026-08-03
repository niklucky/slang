import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import {
  CACHE_VERSION,
  DEFAULT_MAX_CACHE_AGE_MS,
  DEFAULT_STORAGE_KEY,
  defaultStorage,
  parseCache,
  readCache,
  shouldRefetch,
  writeCache,
} from './cache.js';
import { createClient } from './client.js';
import { SlangContext, type SlangContextValue } from './context.js';
import { resolve } from './resolve.js';
import type { CacheShape, Dictionary, Resources, SlangConfig, StorageAdapter } from './types.js';

export type SlangProviderProps = SlangConfig & { children?: ReactNode };

/**
 * Reads the cache without awaiting, for synchronous storages only.
 *
 * `localStorage` can answer during the first render, which puts a returning
 * user's saved locale and cached copy on screen from the first paint. An async
 * storage (React Native's AsyncStorage) returns a thenable here; we bail and
 * let the effect pick it up a tick later.
 */
function readCacheSync(storage: StorageAdapter | null, storageKey: string): CacheShape | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(storageKey);
    if (raw !== null && typeof raw !== 'string') return null;
    return parseCache(raw);
  } catch {
    return null;
  }
}

/** Incoming copy wins per key; the bundled copy backstops keys the server no longer has. */
function mergeLocale(resources: Resources, locale: string, incoming: Dictionary): Resources {
  return { ...resources, [locale]: { ...resources[locale], ...incoming } };
}

export function SlangProvider(props: SlangProviderProps) {
  const {
    children,
    locale: initialLocale,
    fallbackLocale,
    resources: bundled,
    apiUrl,
    apiKey,
    checkForUpdate = true,
    storage: storageProp,
    storageKey = DEFAULT_STORAGE_KEY,
    fetchTimeoutMs,
    maxCacheAgeMs = DEFAULT_MAX_CACHE_AGE_MS,
    onError,
  } = props;

  // Resolved once: swapping storage backends mid-session is not a thing.
  const [storage] = useState<StorageAdapter | null>(() =>
    storageProp === undefined ? defaultStorage() : storageProp,
  );

  const [seed] = useState(() => readCacheSync(storage, storageKey));
  const [locale, setLocaleState] = useState<string>(() => seed?.locale ?? initialLocale);

  const [resources, setResources] = useState<Resources>(() => {
    const initial: Resources = { ...bundled };
    for (const entry of Object.values(seed?.locales ?? {})) {
      initial[entry.locale] = { ...initial[entry.locale], ...entry.translation };
    }
    return initial;
  });

  // Config the sync loop reads without wanting to re-run when its identity changes.
  // Refreshed in an effect declared *before* the sync effect, so the sync effect
  // always sees current values without a write during render.
  const latest = useRef({
    fallbackLocale,
    checkForUpdate,
    maxCacheAgeMs,
    onError,
    storage,
    storageKey,
  });
  useEffect(() => {
    latest.current = { fallbackLocale, checkForUpdate, maxCacheAgeMs, onError, storage, storageKey };
  });

  const client = useMemo(
    () =>
      createClient({
        ...(apiUrl ? { apiUrl } : {}),
        ...(apiKey ? { apiKey } : {}),
        ...(fetchTimeoutMs ? { fetchTimeoutMs } : {}),
      }),
    [apiUrl, apiKey, fetchTimeoutMs],
  );

  const report = useCallback((error: unknown) => {
    const handler = latest.current.onError;
    if (handler) handler(error);
    else console.warn('[slang]', error);
  }, []);

  /**
   * Brings one locale up to date: cached copy first, then a freshness check,
   * then a download only when the check calls for one.
   *
   * Every failure is swallowed. Remote translations are an enhancement over
   * the bundled copy, never a reason to fail a render.
   */
  const syncLocale = useCallback(
    async (target: string, signal: AbortSignal, force: boolean) => {
      const config = latest.current;

      let cache: CacheShape;
      try {
        cache = await readCache(config.storage, config.storageKey);
      } catch (error) {
        report(error);
        cache = { version: CACHE_VERSION, locales: {} };
      }
      if (signal.aborted) return;

      const cached = cache.locales[target];
      if (cached) setResources((prev) => mergeLocale(prev, target, cached.translation));

      if (!config.checkForUpdate && !force) return;

      let serverUpdatedAt: string | null = null;
      try {
        serverUpdatedAt = await client.fetchState(target, { signal });
      } catch (error) {
        if (signal.aborted) return;
        report(error);
      }
      if (signal.aborted) return;

      if (!force && !shouldRefetch(cached, serverUpdatedAt, config.maxCacheAgeMs)) return;

      let dictionary: Dictionary;
      try {
        dictionary = await client.fetchDictionary(target, { signal });
      } catch (error) {
        if (signal.aborted) return;
        report(error);
        return;
      }
      if (signal.aborted) return;

      setResources((prev) => mergeLocale(prev, target, dictionary));

      try {
        // Re-read: another locale's sync may have written since we started.
        const fresh = await readCache(config.storage, config.storageKey);
        await writeCache(config.storage, config.storageKey, {
          ...fresh,
          locales: {
            ...fresh.locales,
            [target]: {
              locale: target,
              translation: dictionary,
              ...(serverUpdatedAt ? { updatedAt: serverUpdatedAt } : {}),
              fetchedAt: new Date().toISOString(),
            },
          },
        });
      } catch (error) {
        report(error);
      }
    },
    [client, report],
  );

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;

    void (async () => {
      await syncLocale(locale, signal, false);
      // The fallback needs its own copy, otherwise it only ever works for
      // locales that happen to ship bundled with the app.
      const fallback = latest.current.fallbackLocale;
      if (!signal.aborted && fallback && fallback !== locale) {
        await syncLocale(fallback, signal, false);
      }
    })();

    return () => controller.abort();
  }, [locale, syncLocale]);

  const setLocale = useCallback(
    (next: string) => {
      setLocaleState(next);
      const config = latest.current;
      void (async () => {
        try {
          const fresh = await readCache(config.storage, config.storageKey);
          await writeCache(config.storage, config.storageKey, { ...fresh, locale: next });
        } catch (error) {
          report(error);
        }
      })();
    },
    [report],
  );

  const refresh = useCallback(async () => {
    await syncLocale(locale, new AbortController().signal, true);
  }, [locale, syncLocale]);

  const value = useMemo<SlangContextValue>(() => {
    // Derived, not state: a locale we already hold a dictionary for is usable
    // on the render that introduces it, with no intermediate not-ready frame.
    const ready = Boolean(
      resources[locale] ?? (fallbackLocale ? resources[fallbackLocale] : undefined),
    );
    return {
      t: (key, vars) => resolve(resources, locale, fallbackLocale, key, vars),
      locale,
      setLocale,
      ready,
      refresh,
      resources,
    };
  }, [resources, locale, fallbackLocale, setLocale, refresh]);

  return <SlangContext.Provider value={value}>{children}</SlangContext.Provider>;
}
