import { describe, expect, it } from 'vitest';

import { negotiateLocale } from '../src/negotiate.js';

/** A realistic shipping list: bare languages, regional variants, two scripts. */
const AVAILABLE = [
  'en',
  'en-AU',
  'en-GB',
  'ar',
  'zh-Hans',
  'zh-Hant',
  'fr',
  'fr-CA',
  'de',
  'pt-BR',
  'pt-PT',
  'es-MX',
  'es-ES',
] as const;

const negotiate = (
  preferences: string | readonly string[] | null | undefined,
  languageDefaults?: Partial<Record<string, (typeof AVAILABLE)[number]>>,
) =>
  negotiateLocale(
    AVAILABLE,
    preferences,
    'en',
    languageDefaults ? { languageDefaults } : {},
  );

describe('negotiateLocale', () => {
  it('takes an exact match', () => {
    expect(negotiate('fr-CA')).toBe('fr-CA');
    expect(negotiate('en')).toBe('en');
  });

  it('reads a platform tag with an underscore', () => {
    expect(negotiate('fr_CA')).toBe('fr-CA');
  });

  it('matches regardless of case, keeping the code as written', () => {
    expect(negotiate('ZH-HANT')).toBe('zh-Hant');
    expect(negotiate('pt-br')).toBe('pt-BR');
  });

  it('falls back to the base language when the region is not shipped', () => {
    expect(negotiate('fr-BE')).toBe('fr');
    expect(negotiate('de-AT')).toBe('de');
  });

  it('gives up on a language it does not have at all', () => {
    expect(negotiate('sv-SE')).toBe('en');
  });

  // The bug this replaced, seen in two apps: `new Set('ru').has('ru')` is
  // false, because the string was spread into the characters `r` and `u`.
  // Matching whole subtags cannot do that.
  it('never half-matches a locale that only shares letters', () => {
    expect(negotiate('fro')).toBe('en');
    expect(negotiate('e')).toBe('en');
  });

  it('handles empty and absent input', () => {
    expect(negotiate(undefined)).toBe('en');
    expect(negotiate(null)).toBe('en');
    expect(negotiate([])).toBe('en');
    expect(negotiate('')).toBe('en');
  });
});

describe('negotiateLocale, ranked preferences', () => {
  // The whole reason this takes a list. A phone set to German-then-French, on
  // an app that ships French but not German, used to land on English because
  // only the first preference was ever read.
  it('moves down the list when the first cannot be served', () => {
    expect(negotiate(['de-AT', 'fr'])).toBe('de'); // de is shipped
    expect(negotiate(['sv', 'fr-CA'])).toBe('fr-CA');
    expect(negotiate(['sv', 'nb', 'ar'])).toBe('ar');
  });

  // A worse match for someone's first language still beats an exact match for
  // their second — which is what both Apple and Android mean by a ranked list.
  it('exhausts a preference before moving on', () => {
    expect(negotiate(['fr-BE', 'en-GB'])).toBe('fr');
  });

  it('falls back only once every preference has failed', () => {
    expect(negotiate(['sv', 'nb', 'fi'])).toBe('en');
  });
});

describe('negotiateLocale, script inference', () => {
  // Region implies script as a matter of fact: someone in Taiwan reads
  // Traditional. Truncation alone cannot do this — `zh-TW` shortens to `zh`,
  // which is not in the list.
  it('reads the script from the region for Chinese', () => {
    expect(negotiate('zh-TW')).toBe('zh-Hant');
    expect(negotiate('zh-HK')).toBe('zh-Hant');
    expect(negotiate('zh-MO')).toBe('zh-Hant');
    expect(negotiate('zh-CN')).toBe('zh-Hans');
    expect(negotiate('zh-SG')).toBe('zh-Hans');
  });

  it('treats a bare or unknown-region zh as Simplified', () => {
    expect(negotiate('zh')).toBe('zh-Hans');
    expect(negotiate('zh-XX')).toBe('zh-Hans');
  });

  it('keeps an explicit script over anything inferred from the region', () => {
    expect(negotiate('zh-Hant-HK')).toBe('zh-Hant');
    // Simplified explicitly, in a region that would otherwise imply Traditional.
    expect(negotiate('zh-Hans-HK')).toBe('zh-Hans');
  });

  it('leaves languages with no script table alone', () => {
    expect(negotiate('en-US')).toBe('en');
  });
});

describe('negotiateLocale, language defaults', () => {
  // Which regional variant wins is a product decision, so it stays with the
  // product: `es-AR` could reasonably resolve either way.
  it('uses the caller’s preferred variant', () => {
    expect(negotiate('es-AR', { es: 'es-ES' })).toBe('es-ES');
    expect(negotiate('es-AR', { es: 'es-MX' })).toBe('es-MX');
  });

  it('falls back to the first shipped variant when none is named', () => {
    expect(negotiate('es-AR')).toBe('es-MX'); // first es-* in AVAILABLE
    expect(negotiate('pt-AO')).toBe('pt-BR');
  });

  // Pinned explicitly: left to inference, `T` would widen to include the bad
  // default and the type error this is about would disappear.
  it('ignores a default naming a locale that is not shipped', () => {
    expect(
      negotiateLocale<'en' | 'fr'>(['en', 'fr'], 'fr-BE', 'en', {
        // @ts-expect-error deliberately naming a locale outside `available`
        languageDefaults: { fr: 'fr-CA' },
      }),
    ).toBe('fr');
  });

  it('does not let a default override an exact match', () => {
    expect(negotiate('es-MX', { es: 'es-ES' })).toBe('es-MX');
  });
});
