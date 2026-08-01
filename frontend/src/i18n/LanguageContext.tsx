/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';
import { translations, LanguageCode, SUPPORTED_LANGUAGES } from './translations';

const STORAGE_KEY = 'fln_language';

interface LanguageContextValue {
  lang: LanguageCode;
  setLang: (lang: LanguageCode) => void;
  t: (key: keyof (typeof translations)['en']) => string;
}

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);

function getInitialLanguage(): LanguageCode {
  if (typeof window === 'undefined') return 'en';
  const stored = window.localStorage.getItem(STORAGE_KEY) as LanguageCode | null;
  if (stored && SUPPORTED_LANGUAGES.some((l) => l.code === stored)) return stored;
  return 'en';
}

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLangState] = useState<LanguageCode>(getInitialLanguage);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((next: LanguageCode) => {
    setLangState(next);
    window.localStorage.setItem(STORAGE_KEY, next);
  }, []);

  const t = useCallback(
    (key: keyof (typeof translations)['en']) => {
      return translations[lang][key] ?? translations.en[key] ?? key;
    },
    [lang]
  );

  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
};

// Usage: const { t, lang, setLang } = useLanguage();
export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error('useLanguage() must be called within a <LanguageProvider>');
  }
  return ctx;
}
