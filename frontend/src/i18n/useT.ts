import { useCallback } from 'react';
import { useSelector } from 'react-redux';
import { translate } from './index';

export type TranslationVars = Record<string, string | number>;

/** Returns a `t(key, vars)` function bound to the currently selected language. */
export default function useT() {
  const lang = useSelector((state: any) => state.language.lang);
  return useCallback((key: string, vars?: TranslationVars) => translate(lang, key, vars), [lang]);
}
