/**
 * Public types for @slang/react.
 *
 * Everything here is plain data. The package has no runtime dependencies and
 * imports nothing platform-specific, so the same types describe the browser,
 * React Native and Node (the CLI) alike.
 */

/** A single locale's translations: flat `key -> string`. No nesting, no namespaces. */
export type Dictionary = Record<string, string>;

/** Several locales at once, keyed by locale code — the shape the API returns. */
export type Resources = Record<string, Dictionary>;

/** Values substituted into `{{placeholders}}` by `t()`. */
export type TranslationVars = Record<string, string | number>;

/**
 * The `t()` function handed out by {@link useTranslation}.
 *
 * `null`/`undefined` yields an empty string so that call sites can pass a
 * possibly-absent key straight through without a guard.
 */
export type TranslateFn = (key: string | null | undefined, vars?: TranslationVars) => string;

/**
 * Where cached translations are persisted between launches.
 *
 * The signature is deliberately the intersection of the two storages that
 * matter: `window.localStorage` (synchronous) and React Native's
 * `AsyncStorage` (promise-returning) both satisfy it as-is, so neither
 * platform needs an adapter written for it.
 */
export interface StorageAdapter {
  getItem(key: string): string | null | Promise<string | null>;
  setItem(key: string, value: string): void | Promise<void>;
}

/** One locale as it sits in persistent storage. */
export interface CachedLocale {
  locale: string;
  translation: Dictionary;
  /** Server's `updatedAt` for this locale, ISO-8601. Absent when the server never told us. */
  updatedAt?: string;
  /** When we last wrote this entry, ISO-8601. Drives {@link SlangConfig.maxCacheAgeMs}. */
  fetchedAt: string;
}

/** The whole persisted blob, under a single storage key. */
export interface CacheShape {
  /** Bumped when the on-disk layout changes; a mismatch discards the cache. */
  version: number;
  /** Last locale explicitly selected via `setLocale`, restored on next launch. */
  locale?: string;
  locales: Record<string, CachedLocale>;
}

export interface SlangConfig {
  /** Locale to start with. A persisted `setLocale` choice wins over this on later launches. */
  locale: string;
  /**
   * Consulted when a key is missing from the active locale. Leave unset to
   * fall straight through to echoing the key back.
   */
  fallbackLocale?: string;
  /**
   * Translations bundled with the app (`import en from './locales/en.json'`).
   * These render on the very first paint, before storage or the network are
   * consulted, which is what keeps the provider from having to block.
   */
  resources?: Resources;
  /** Slang API origin. Point this at your own proxy to keep the key server-side. */
  apiUrl?: string;
  /** Sent as `x-api-key`. Omit when a proxy adds it — anything shipped in a bundle is public. */
  apiKey?: string;
  /** Poll `/state` and refresh in the background. Default `true`. */
  checkForUpdate?: boolean;
  /**
   * Persistence for fetched translations. Defaults to `localStorage` where it
   * exists, otherwise nothing. Pass `AsyncStorage` on React Native, or `null`
   * to disable caching entirely.
   */
  storage?: StorageAdapter | null;
  /** Storage key holding the cache. Default `'slang'`. */
  storageKey?: string;
  /** Per-request timeout in ms. Default `3000`. */
  fetchTimeoutMs?: number;
  /**
   * Refetch a cached locale once it is this old even if the freshness check
   * could not be completed. Default 24h.
   *
   * This exists because `/state` failing is not evidence that the cache is
   * stale. Treating it as such — which the hand-rolled clients this package
   * replaces all do — turns one broken endpoint into a full dictionary
   * download on every single app launch.
   */
  maxCacheAgeMs?: number;
  /** Called for every swallowed failure. Defaults to `console.warn`. */
  onError?: (error: unknown) => void;
}
