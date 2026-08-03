import type { Dictionary, Resources, TranslationVars } from './types.js';

/** Matches `{{name}}`, tolerating inner whitespace: `{{ name }}`. */
const PLACEHOLDER = /\{\{\s*([\w.-]+)\s*\}\}/g;

/**
 * Substitutes `{{name}}` placeholders. Unknown names are left verbatim rather
 * than blanked, so a missing variable shows up in the UI instead of silently
 * eating a word.
 */
export function interpolate(template: string, vars?: TranslationVars): string {
  if (!vars) return template;
  return template.replace(PLACEHOLDER, (match, name: string) => {
    const value = vars[name];
    return value === undefined ? match : String(value);
  });
}

/**
 * Looks a key up across the active locale, then the fallback locale, then
 * gives up and echoes the key.
 *
 * Echoing is deliberate: an untranslated screen reads as `checkout_title`
 * rather than going blank, which makes the gap obvious in review instead of
 * invisible.
 */
export function resolve(
  resources: Resources,
  locale: string,
  fallbackLocale: string | undefined,
  key: string | null | undefined,
  vars?: TranslationVars,
): string {
  if (key === null || key === undefined || key === '') return '';

  const active: Dictionary | undefined = resources[locale];
  const hit = active?.[key];
  if (hit !== undefined) return interpolate(hit, vars);

  if (fallbackLocale && fallbackLocale !== locale) {
    const fallbackHit = resources[fallbackLocale]?.[key];
    if (fallbackHit !== undefined) return interpolate(fallbackHit, vars);
  }

  return interpolate(key, vars);
}
