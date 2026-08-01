/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { Languages, Check } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';
import { SUPPORTED_LANGUAGES } from '../i18n/translations';

interface LanguageSwitcherProps {
  /** 'dark' is for placement on the always-dark top strip of the landing page. */
  variant?: 'auto' | 'dark';
}

export const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({ variant = 'auto' }) => {
  const { lang, setLang, t } = useLanguage();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const isDark = variant === 'dark';

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={t('language.select')}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`flex items-center gap-1.5 text-[10px] md:text-xs font-bold transition hover:underline ${
          isDark
            ? 'text-gray-300 hover:text-white'
            : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
        }`}
      >
        <Languages className="h-3.5 w-3.5" />
        {SUPPORTED_LANGUAGES.find((l) => l.code === lang)?.nativeLabel}
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute right-0 mt-2 w-36 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg dark:shadow-slate-950/50 py-1 z-50"
        >
          {SUPPORTED_LANGUAGES.map((option) => (
            <button
              key={option.code}
              role="option"
              aria-selected={option.code === lang}
              onClick={() => {
                setLang(option.code);
                setOpen(false);
              }}
              className="w-full flex items-center justify-between px-3 py-1.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 text-left"
            >
              <span>{option.nativeLabel}</span>
              {option.code === lang && <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
