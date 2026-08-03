import { useContext } from 'react';

import { SlangContext, type SlangContextValue } from './context.js';
import type { TranslateFn } from './types.js';

/** Full context: `t`, `locale`, `setLocale`, `ready`, `refresh`, `resources`. */
export function useSlang(): SlangContextValue {
  const context = useContext(SlangContext);
  if (!context) throw new Error('useSlang must be used within a SlangProvider');
  return context;
}

/** Alias of {@link useSlang}, named for familiarity with react-i18next call sites. */
export const useTranslation = useSlang;

/** Just the translate function, for components that need nothing else. */
export function useT(): TranslateFn {
  return useSlang().t;
}
