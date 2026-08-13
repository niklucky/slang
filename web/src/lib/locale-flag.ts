// Maps a locale code (e.g. "en", "en_ca", "en-CA") to a flag emoji using
// regional indicator symbols. Falls back to a white flag when the code
// cannot be mapped to an ISO country.

// Language codes with no region of their own, mapped to the country most
// associated with the language. Only consulted when the code carries no
// region part.
const REGION_OVERRIDES: Record<string, string> = {
  aa: 'et', // Afar
  ab: 'ge', // Abkhaz
  ae: 'ir', // Avestan
  ak: 'gh', // Akan
  am: 'et', // Amharic
  an: 'es', // Aragonese
  ar: 'sa', // Arabic
  as: 'in', // Assamese
  av: 'ru', // Avaric
  ay: 'bo', // Aymara
  az: 'az',
  ba: 'ru', // Bashkir
  be: 'by',
  bh: 'in', // Bihari
  bi: 'vu', // Bislama
  bn: 'bd', // Bengali
  bo: 'cn', // Tibetan
  ca: 'es', // Catalan
  cs: 'cz', // Czech
  cv: 'ru', // Chuvash
  cy: 'gb', // Welsh
  da: 'dk', // Danish
  dv: 'mv', // Divehi
  dz: 'bt', // Dzongkha
  el: 'gr', // Greek
  en: 'gb', // English
  eo: 'eu', // Esperanto
  et: 'ee', // Estonian
  eu: 'es', // Basque
  fa: 'ir', // Persian
  ff: 'sn', // Fulah
  ga: 'ie', // Irish
  gd: 'gb', // Scottish Gaelic
  gl: 'es', // Galician
  gn: 'py', // Guarani
  gu: 'in', // Gujarati
  ha: 'ng', // Hausa
  he: 'il', // Hebrew
  hi: 'in', // Hindi
  hy: 'am', // Armenian
  ia: 'eu', // Interlingua
  ja: 'jp', // Japanese
  jv: 'id', // Javanese
  ka: 'ge', // Georgian
  kk: 'kz', // Kazakh
  km: 'kh', // Khmer
  kn: 'in', // Kannada
  ko: 'kr', // Korean
  ku: 'tr', // Kurdish
  ky: 'kg', // Kirghiz
  ln: 'cd', // Lingala
  lo: 'la', // Lao
  lv: 'lv',
  mg: 'mg', // Malagasy
  mi: 'nz', // Maori
  mk: 'mk',
  ml: 'in', // Malayalam
  mn: 'mn', // Mongolian
  mr: 'in', // Marathi
  ms: 'my', // Malay
  my: 'mm', // Burmese
  ne: 'np', // Nepali
  or: 'in', // Oriya
  pa: 'in', // Punjabi
  ps: 'af', // Pashto
  qu: 'pe', // Quechua
  sq: 'al', // Albanian
  sr: 'rs', // Serbian
  su: 'id', // Sundanese
  sv: 'se', // Swedish
  sw: 'ke', // Swahili
  ta: 'in', // Tamil
  te: 'in', // Telugu
  tg: 'tj', // Tajik
  tk: 'tm', // Turkmen
  uk: 'ua', // Ukrainian
  ur: 'pk', // Urdu
  uz: 'uz',
  vi: 'vn', // Vietnamese
  zh: 'cn', // Chinese
};

export function localeFlag(code: string): string {
  const parts = code.toLowerCase().split(/[_-]/);
  // An explicit region part ("en_ca", "en-CA", "zh-Hant-TW") always wins
  // over the language overrides: "ca" alone is Catalan, but "en-CA" is
  // Canada. Scan from the end to skip script/variant subtags.
  let region: string | undefined;
  for (let i = parts.length - 1; i > 0; i -= 1) {
    const part = parts[i];
    if (part != null && /^[a-z]{2}$/.test(part)) {
      region = part;
      break;
    }
  }
  const language = parts[0] ?? '';
  region ??= REGION_OVERRIDES[language] ?? language;
  if (!/^[a-z]{2}$/.test(region)) return '🏳️';
  return String.fromCodePoint(
    ...[...region.toUpperCase()].map((char) => 0x1f1e6 + char.charCodeAt(0) - 65),
  );
}
