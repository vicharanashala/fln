/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { Check, Languages } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { SUPPORTED_LANGUAGES, type LanguageCode } from '../i18n/i18n';

interface LanguageSwitcherProps {
  variant?: 'auto' | 'dark';
}

export const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({ variant = 'auto' }) => {
  const { i18n, t } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const current = (i18n.resolvedLanguage || i18n.language || 'en') as LanguageCode;
  const currentOption = SUPPORTED_LANGUAGES.find((l) => l.code === current) ?? SUPPORTED_LANGUAGES[0];
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
        {currentOption.nativeLabel}
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
              aria-selected={option.code === current}
              onClick={() => {
                void i18n.changeLanguage(option.code);
                setOpen(false);
              }}
              className="w-full flex items-center justify-between px-3 py-1.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 text-left"
            >
              <span>{option.nativeLabel}</span>
              {option.code === current && <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};