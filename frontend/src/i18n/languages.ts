// Supported UI languages. `dir` drives document direction (rtl for Arabic).
export const LANGUAGES = [
  { code: 'en', label: 'ENGLISH', dir: 'ltr' },
  { code: 'en-US', label: 'ENGLISH (US)', dir: 'ltr' },
  { code: 'ar', label: 'ARABIC', dir: 'rtl' },
  { code: 'ka', label: 'GEORGIAN', dir: 'ltr' },
  { code: 'kn', label: 'KANNADA', dir: 'ltr' },
  { code: 'pt', label: 'PORTUGUESE', dir: 'ltr' },
  { code: 'fr', label: 'FRENCH', dir: 'ltr' },
  { code: 'hi', label: 'HINDI', dir: 'ltr' },
  { code: 'ta', label: 'TAMIL', dir: 'ltr' },
  { code: 'te', label: 'TELUGU', dir: 'ltr' },
];

export const DEFAULT_LANGUAGE = 'en';

export const LANGUAGE_CODES = LANGUAGES.map((l) => l.code);
