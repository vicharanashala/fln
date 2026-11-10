# i18n

## Overview
i18next setup for English and Hindi. `locales/en` and `locales/hi` hold the `translation.json` resource bundles (data only, not documented separately).

## Interface
- `i18n.ts` (`export default i18n`; `fallbackLng: 'en'`, `interpolation.escapeValue: false`): default i18n instance (imported once for side effects in `../main.tsx`), `SUPPORTED_LANGUAGES`, type `LanguageCode`.
- Consumed by `../components/LanguageSwitcher.tsx` and `useTranslation` callers.

## Invariants
- Supported codes are `en` and `hi`; anything else stored is ignored and falls back to `en`.
- Every key added to one locale file should exist in both. Not met today: `locales/en/translation.json` has 100 keys and `locales/hi/translation.json` only 30, so Hindi falls back to English for the other 70.

## Side Effects
- Reads the `fln_language` key from `localStorage` at init (failures fall back to English); initialises global i18next state. It also writes `fln_language` and sets `document.documentElement.lang` on every `languageChanged` event (`i18n.ts:54-63`).

## Verification
- Run: `npm test --workspace @fln/frontend` (vitest run, from repo root)
