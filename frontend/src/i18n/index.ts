import { DEFAULT_LANGUAGE } from './languages';
import en from './locales/en';
import enUS from './locales/en-US';
import ar from './locales/ar';
import ka from './locales/ka';
import kn from './locales/kn';
import pt from './locales/pt';
import fr from './locales/fr';
import hi from './locales/hi';
import ta from './locales/ta';
import te from './locales/te';

export const dictionaries = {
  en,
  'en-US': enUS,
  ar,
  ka,
  kn,
  pt,
  fr,
  hi,
  ta,
  te,
};

export const STORAGE_KEY = 'autogarage.language';

export function getStoredLanguage() {
  if (typeof window === 'undefined') return DEFAULT_LANGUAGE;
  return window.localStorage.getItem(STORAGE_KEY) || DEFAULT_LANGUAGE;
}

/**
 * Look up `key` for `lang`, falling back to English and finally to the key
 * itself so missing translations never render as blanks.
 * Supports `{placeholder}` interpolation via `vars`.
 */
export function translate(
  lang: string,
  key: string,
  vars?: Record<string, string | number>
): string {
  const dict = dictionaries[lang as keyof typeof dictionaries] || dictionaries[DEFAULT_LANGUAGE];
  let str = dict[key] ?? dictionaries[DEFAULT_LANGUAGE][key] ?? key;
  if (vars) {
    Object.keys(vars).forEach((name) => {
      str = str.replace(new RegExp(`\\{${name}\\}`, 'g'), String(vars[name]));
    });
  }
  return str;
}
