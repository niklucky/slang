/**
 * Picking which of the locales you ship to show someone.
 *
 * Every platform hands you a *ranked* list — `navigator.languages`,
 * `AppleLanguages`, Android's `LocaleList` — and the naive version of this
 * function throws all but the first away, so a phone set to German-then-French
 * lands on English in an app that ships French. Taking the list is most of the
 * value here.
 *
 * Pure data work: no DOM, no React Native, nothing platform-specific. Reading
 * the preferences off the platform is the caller's job, because that is the
 * part that differs; deciding what they mean is not.
 */

/**
 * Region implies script, as a matter of fact rather than preference.
 *
 * Someone in Taiwan reads Traditional Chinese; this is not a product decision
 * an app gets to have an opinion about, so it is built in rather than left to
 * every caller to rediscover. Chinese is the split that matters in practice —
 * for the rarer ones (`sr-Latn`, `uz-Cyrl`) pass an already-normalized tag.
 */
const LIKELY_SCRIPTS: Record<string, Record<string, string>> = {
  zh: {
    tw: 'Hant',
    hk: 'Hant',
    mo: 'Hant',
    cn: 'Hans',
    sg: 'Hans',
    my: 'Hans',
    // A bare `zh`, or any region we do not list, is Simplified: it is what the
    // large majority of Chinese readers use.
    '': 'Hans',
  },
};

export interface NegotiateOptions<T extends string> {
  /**
   * Which regional variant wins when a language matches but no variant does —
   * `es` when you ship `es-ES` and `es-MX`.
   *
   * This one *is* a product decision, so it stays with the product. Left
   * unset, the first variant in `available` wins, which makes the order of
   * your supported-locales list the answer.
   */
  languageDefaults?: Partial<Record<string, T>>;
}

/** `fr_CA` and `fr-CA` are the same request; platforms disagree on which they send. */
function normalize(tag: string): string {
  return tag.replaceAll('_', '-').toLowerCase();
}

/**
 * Rewrites a Chinese tag to carry its script, so `zh-TW` can meet `zh-Hant`.
 * Returns the tag unchanged when nothing is known about it.
 */
function withLikelyScript(tag: string): string {
  const [language, ...rest] = tag.split('-');
  const scripts = LIKELY_SCRIPTS[language!];
  if (!scripts) return tag;
  // Already carries a script subtag (`zh-hant-hk`) — nothing to infer.
  if (rest.some((part) => part.length === 4)) return tag;

  const region = rest.find((part) => part.length === 2) ?? '';
  const script = scripts[region] ?? scripts[''];
  return script ? `${language}-${script}`.toLowerCase() : tag;
}

/**
 * One preference, matched as well as it can be. `undefined` when this
 * preference cannot be served at all and the next one should be tried.
 */
function matchOne<T extends string>(
  available: readonly T[],
  lookup: Map<string, T>,
  preference: string,
  languageDefaults: Partial<Record<string, T>> | undefined,
): T | undefined {
  const tag = normalize(preference);
  if (!tag) return undefined;

  // Exact: `fr-CA` when we ship `fr-CA`.
  const exact = lookup.get(tag);
  if (exact) return exact;

  // Script inferred from region: `zh-TW` meets `zh-Hant`.
  const scripted = lookup.get(withLikelyScript(tag));
  if (scripted) return scripted;

  // RFC 4647 lookup: drop subtags from the right. `zh-Hant-HK` finds
  // `zh-Hant`, `en-US-posix` finds `en-US` and then `en`.
  const parts = tag.split('-');
  for (let end = parts.length - 1; end > 0; end -= 1) {
    const truncated = lookup.get(parts.slice(0, end).join('-'));
    if (truncated) return truncated;
  }

  // The language is one we speak, but not in the region asked for: `fr-BE`
  // against `fr`, or `es-AR` against `es-ES` and `es-MX`.
  const base = parts[0]!;
  const preferred = languageDefaults?.[base];
  if (preferred && available.includes(preferred)) return preferred;

  return available.find((code) => normalize(code).split('-')[0] === base);
}

/**
 * The first locale in `available` that serves the user's preferences, or
 * `fallback` when none of them can be.
 *
 * Preferences are exhausted in order: a worse match for someone's *first*
 * language beats an exact match for their second, which is what both Apple and
 * Android mean by a ranked list.
 *
 * ```ts
 * negotiateLocale(['en', 'fr', 'zh-Hans', 'zh-Hant'], ['zh-TW', 'fr'], 'en');
 * // -> 'zh-Hant'
 * ```
 */
export function negotiateLocale<T extends string>(
  available: readonly T[],
  preferences: string | readonly string[] | null | undefined,
  fallback: T,
  options: NegotiateOptions<T> = {},
): T {
  if (preferences == null) return fallback;
  const ranked = typeof preferences === 'string' ? [preferences] : preferences;

  // Built once per call rather than per preference, and case-folded so that
  // `available` can be written the way it is displayed (`zh-Hant`, `pt-BR`).
  // First writing wins, so a duplicate cannot shadow the earlier entry.
  const lookup = new Map<string, T>();
  for (const code of available) {
    const key = normalize(code);
    if (!lookup.has(key)) lookup.set(key, code);
  }

  for (const preference of ranked) {
    const match = matchOne(available, lookup, preference, options.languageDefaults);
    if (match) return match;
  }

  return fallback;
}
