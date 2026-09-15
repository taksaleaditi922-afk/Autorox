import { useCallback } from 'react';
import { useSelector } from 'react-redux';
import { translate } from './index';

/** Returns a `t(key, vars)` function bound to the currently selected language. */
export default function useT() {
  const lang = useSelector((state) => state.language.lang);
  return useCallback((key, vars) => translate(lang, key, vars), [lang]);
}
