export { SlangProvider, type SlangProviderProps } from './provider.js';
export { SlangContext, type SlangContextValue } from './context.js';
export { useSlang, useT, useTranslation } from './hooks.js';

export { interpolate, resolve } from './resolve.js';
export { negotiateLocale, type NegotiateOptions } from './negotiate.js';
export {
  DEFAULT_API_URL,
  DEFAULT_TIMEOUT_MS,
  SlangAbortError,
  SlangHttpError,
  createClient,
  normalizeDictionary,
  unwrapDictionary,
  unwrapResources,
  type ClientOptions,
  type SlangClient,
} from './client.js';
export {
  CACHE_VERSION,
  DEFAULT_MAX_CACHE_AGE_MS,
  DEFAULT_STORAGE_KEY,
  defaultStorage,
  parseCache,
  shouldRefetch,
} from './cache.js';

export type {
  CachedLocale,
  CacheShape,
  Dictionary,
  Resources,
  SlangConfig,
  StorageAdapter,
  TranslateFn,
  TranslationVars,
} from './types.js';
