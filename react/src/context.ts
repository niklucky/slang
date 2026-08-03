import { createContext } from 'react';

import type { Resources, TranslateFn } from './types.js';

export interface SlangContextValue {
  /** Translate a key. See {@link TranslateFn}. */
  t: TranslateFn;
  /** Active locale. */
  locale: string;
  /** Switch locale. Bundled and cached copies apply immediately; the network tops up after. */
  setLocale: (locale: string) => void;
  /** True once a dictionary for the active locale is in memory — bundled copies count. */
  ready: boolean;
  /** Force a freshness check and refetch of the active locale. */
  refresh: () => Promise<void>;
  /** Every dictionary currently in memory. Exposed for debugging and tests. */
  resources: Resources;
}

export const SlangContext = createContext<SlangContextValue | null>(null);
