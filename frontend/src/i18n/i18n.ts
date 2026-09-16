/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from './locales/en/translation.json';
import hi from './locales/hi/translation.json';

export const SUPPORTED_LANGUAGES = [
  { code: 'en', label: 'English', nativeLabel: 'English' },
  { code: 'hi', label: 'Hindi', nativeLabel: 'हिन्दी' },
] as const;

export type LanguageCode = (typeof SUPPORTED_LANGUAGES)[number]['code'];

const STORAGE_KEY = 'fln_language';

function getInitialLanguage(): LanguageCode {
  if (typeof window === 'undefined') return 'en';
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored && SUPPORTED_LANGUAGES.some((l) => l.code === stored)) {
      return stored as LanguageCode;
    }
  } catch {
    return 'en';
  }
  return 'en';
}

void i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      hi: { translation: hi },
    },
    lng: getInitialLanguage(),
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false,
    },
    returnNull: false,
  })
  .then(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = i18n.language || 'en';
    }
  });

i18n.on('languageChanged', (lang) => {
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      return;
    }
  }
  if (typeof document !== 'undefined') {
    document.documentElement.lang = lang;
  }
});

export default i18n;