import { createSlice } from '@reduxjs/toolkit';
import { getStoredLanguage } from '../i18n';
import { DEFAULT_LANGUAGE, LANGUAGE_CODES } from '../i18n/languages';

const languageSlice = createSlice({
  name: 'language',
  initialState: {
    lang: getStoredLanguage(),
  },
  reducers: {
    setLanguage(state, action) {
      state.lang = LANGUAGE_CODES.includes(action.payload) ? action.payload : DEFAULT_LANGUAGE;
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('autogarage.language', state.lang);
      }
    },
  },
});

export const { setLanguage } = languageSlice.actions;
export default languageSlice.reducer;
